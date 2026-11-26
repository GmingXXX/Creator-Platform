import {pluginDeniedReason,registeredPlugin,taskLimitReached} from './creation-plugins';
import {canAdmin,catalogIsHidden} from './admin-management';
import {productionStagePrompt,productionStageOf} from './production-stage';
import {clarificationNeeded,confirmedIntent,creationPrompt} from './intent-clarification';
import {prepareAssetAdoption} from './asset-adoption-context';
import {prepareSkillSave,prepareSkillAdoption} from './skill-store';
import {skillCanManage,skillAvailableToActor,skillHasActiveScope} from './skill-access';
import {transferWorkToWorkspace} from './workspace-transfer';
import {restoreWorkspaceSession} from './workspace-session';
import {retainCreativeMetadata} from './work-creative-metadata';
import {publicWorkSnapshot,publicAssetSnapshot} from './creative-publication';
import {referencesFromPrompt,validateReferences} from './exhibit-references';
import {migrateWorkspaceDemos} from './workspace-demo-seeds';
import {migrateCatalogComponents} from './catalog-components';
import {selectTaskSkills} from './skill-matching';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Asset, ComposerDraft, ConversationTurn, Run, Skill, StudioStore, Submission, Template } from './types';
import { createDraft, createInitialData } from './fixtures';
import { createSceneWork, now, uid } from './scenes';
import { cloneWork, resolveIntent, validateWork } from './logic';
import { generateArtifact, isAssetReferenced } from './generation';
import { reviseScene } from './conversation';
import { isWorkspace, workspaceOf } from './workspaces';
import {workspaceCanEdit,workspaceRole,normalizeWorkspaceState} from './workspace-management';
import {createWorkspaceActions} from './workspace-actions';
import {createWorkspaceLifecycleActions,removeCreationDraftCaches} from './workspace-lifecycle';
import {isProjectWork, reconcileWorkOutputs, snapshotMaterialAsset} from './work-outputs';
import {assetAvailableForAI, assetAvailableForInsertion, assetAvailableInSpace} from './asset-access';
import {getAssetMetadata, validBusinessMetadata} from './asset-metadata';
import {adoptWorkResources} from './resource-adoption';
import {assetDependencyError, packageDependencyError, workDependencyError} from './resource-permissions';
import {getWorkPurposes,publicationCategoryError} from './project-taxonomy';
import {migrateResourcesV15} from './seeds-v15';
import {canCopyResource,pinWorkSkills} from './resource-sharing';
import {skillIsValid,publicSkillSnapshot} from './skill-publication';
const memory = new Map<string, string>();
const fallback = { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => {
        memory.set(key, value);
    }, removeItem: (key: string) => {
        memory.delete(key);
    } };

const writePermissionMessage='当前空间为只读，只有负责人和编辑者可以修改。';
function requireWorkspaceWrite(state:StudioStore,id:string){if(!workspaceCanEdit(state,id))throw new Error(writePermissionMessage);}

function aiResourceError(state:Pick<StudioStore,'assets'>,ids:string[],workspaceId:string,sourceId?:string):string|undefined {
    const references=[...new Set([...ids,...(sourceId?[sourceId]:[])])];
    const invalid=references.find(id=>{const asset=state.assets.find(item=>item.id===id);return !asset||!assetAvailableForAI(asset,workspaceId);});
    if(invalid)return '部分参考素材已不可用、属于其他空间或已关闭 AI 调用，请移除或重新选择后继续。';
    for(const id of references){const error=assetDependencyError(state.assets,state.assets.find(item=>item.id===id)!,workspaceId,'ai');if(error)return error;}
}

function submittedLegacyDraft(draft:ComposerDraft,runs:Run[]):boolean {
    const time=(value:string)=>/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)?Date.parse(value):NaN;
    const updated=time(draft.updatedAt);
    if(!Number.isFinite(updated)||!draft.text.trim())return false;
    return runs.some(run=>Number.isFinite(time(run.createdAt))&&updated<=time(run.createdAt)&&workspaceOf(run)===workspaceOf(draft)
        &&run.prompt===draft.text.trim()&&run.model===draft.model&&run.styleId===draft.styleId
        &&JSON.stringify(run.skillIds)===JSON.stringify(draft.skillIds)&&JSON.stringify(run.attachmentIds)===JSON.stringify(draft.attachmentIds)
        &&JSON.stringify(run.reference)===JSON.stringify(draft.reference));
}
export const useStudio = create<StudioStore>()(persist((set, get) => ({
    ...createInitialData(),
    ...createWorkspaceActions(set,get),
    ...createWorkspaceLifecycleActions(set,get),
    resourceSchemaVersion:3,
    projectSchemaVersion:1,
    composerSchemaVersion:1,
    login: (username, password) => {
        const ok = username.trim() === 'jiming' && password === '123456';
        if (ok)
            set({ loggedIn: true });
        return ok;
    },
    logout: () => set({ loggedIn: false }),
    setRole: role => set({ role }),
    setWorkspace: id => {
        const state = get();
        if (!isWorkspace(id,state.workspaces)||!workspaceRole(state,id)) return;
        const existing = state.drafts.find(draft => workspaceOf(draft) === id);
        const draft = existing || createDraft({workspaceId:id});
        set({workspaceRestoreNotice:undefined,activeWorkspaceId:id, activeDraftId:draft.id, drafts:existing ? state.drafts : [draft,...state.drafts]});
    },
    moveWorkToWorkspace: (id,targetWorkspaceId) => {
        const next=transferWorkToWorkspace(get(),id,targetWorkspaceId);
        set(reconcileWorkOutputs({...next,workspaceRestoreNotice:undefined}));
        return get().works.find(work=>work.id===id)!;
    },
    saveWork: work => {
        const exists = get().works.find(x => x.id === work.id);
        requireWorkspaceWrite(get(),exists?workspaceOf(exists):(work.workspaceId||get().activeWorkspaceId));
        if(exists&&workspaceOf(work)!==workspaceOf(exists))throw new Error('作品已移动到其他空间，请重新打开后继续编辑。');
        validateWork(work);
        if (exists?.deletedAt) throw new Error('作品已在回收站，请恢复后再保存。');
        const dependencyError=workDependencyError(get().assets,work,exists?workspaceOf(exists):(work.workspaceId||get().activeWorkspaceId));
        if(dependencyError)throw new Error(dependencyError);
        const saved = {
            ...pinWorkSkills(adoptWorkResources(structuredClone(exists?retainCreativeMetadata(work,exists):work),get().assets,exists?workspaceOf(exists):(work.workspaceId||get().activeWorkspaceId),get().adoptAsset,true),get().skills,exists?workspaceOf(exists):(work.workspaceId||get().activeWorkspaceId),get().copySkillToSpace), workspaceId:exists ? workspaceOf(exists) : (work.workspaceId || get().activeWorkspaceId), productionStage:work.productionStage||(productionStageOf(work)==='delivery'?'delivery':undefined), title: work.title.trim(), updatedAt: now(), revision: (exists?.revision || 0) + 1
        };
        set(s => reconcileWorkOutputs({...s, works: exists ? s.works.map(x => x.id === work.id ? saved : x) : [saved, ...s.works]}));
    },
    createWork: options => {
        requireWorkspaceWrite(get(),options.workspaceId||get().activeWorkspaceId);
        const disabled=pluginDeniedReason(options.kind||'exhibit',options.workspaceId||get().activeWorkspaceId);
        if(disabled)throw new Error(disabled);
        validateWork(options);
        const work = {...createSceneWork({ ...options, styleId:options.styleId || '', title: options.title.trim(), blank: !options.kind || options.kind === 'exhibit' }),displayForm:options.displayForm,contentPurposes:options.contentPurposes ? getWorkPurposes({title:options.title,type:options.type,contentPurposes:options.contentPurposes}) : [],workspaceId:options.workspaceId || get().activeWorkspaceId};
        set(s => reconcileWorkOutputs({...s, works: [work, ...s.works]}));
        return work;
    },
    cloneTemplate: id => {
        if(!workspaceCanEdit(get(),get().activeWorkspaceId)){set({creationError:writePermissionMessage});return;}
        const template = get().templates.find(x => x.id === id);
        if (!template||catalogIsHidden('template',id)){set({creationError:'模板已不可用，请刷新后重新选择。'});return;}
        const workspaceId=get().activeWorkspaceId;
        const error=pluginDeniedReason(template.work.kind,workspaceId)||workDependencyError(get().assets,template.work,workspaceId);
        if(error){set({creationError:error});return;}
        const cloned={...cloneWork(template.work, `${template.title} · 我的创作`),workspaceId,deletedAt:undefined};
        const work=adoptWorkResources(cloned,get().assets,workspaceId,get().adoptAsset);
        set(s => reconcileWorkOutputs({...s,creationError:undefined, works: [work, ...s.works], templates: s.templates.map(x => x.id === id ? { ...x, uses: x.uses + 1 } : x)}));
        return work;
    },
    duplicateWork: id => {
        const original = get().works.find(x => x.id === id);
        if (!original || original.deletedAt || !workspaceCanEdit(get(),workspaceOf(original)))
            return;
        const work = cloneWork(original);
        set(s => reconcileWorkOutputs({...s, works: [work, ...s.works]}));
        return work;
    },
    archiveWork: id => set(s => reconcileWorkOutputs({...s, works: s.works.map(x => x.id === id && !x.deletedAt && workspaceCanEdit(s,workspaceOf(x)) ? { ...x, archived: !x.archived, updatedAt: now(), revision:x.revision+1 } : x)})),
    deleteWork: id => {
        const work = get().works.find(item=>item.id===id && !item.deletedAt);
        if (!work || !workspaceCanEdit(get(),workspaceOf(work))) return false;
        set(state=>reconcileWorkOutputs({...state,works:state.works.map(item=>item.id===id ? {...item,deletedAt:now(),updatedAt:now(),revision:item.revision+1} : item)}));
        return true;
    },
    restoreWork: id => {
        const work = get().works.find(item=>item.id===id && item.deletedAt);
        if (!work || !workspaceCanEdit(get(),workspaceOf(work))) return false;
        set(state=>reconcileWorkOutputs({...state,works:state.works.map(item=>item.id===id ? {...item,deletedAt:undefined,updatedAt:now(),revision:item.revision+1} : item)}));
        return true;
    },
    addAsset: asset => {
        const state=get(),previous=state.assets.find(a=>a.id===asset.id);
        requireWorkspaceWrite(state,asset.workspaceId||state.activeWorkspaceId);
        if(previous)requireWorkspaceWrite(state,workspaceOf(previous));
        set(s=>({assets:[{...structuredClone(asset),workspaceId:asset.workspaceId||s.activeWorkspaceId},...s.assets.filter(x=>x.id!==asset.id)]}));
    },
    updateAssetMetadata: (id, patch) => {
        const state=get(),asset=state.assets.find(item=>item.id===id);
        if(!asset||!workspaceCanEdit(state,workspaceOf(asset))||asset.public||asset.deletedAt||(workspaceOf(asset)!=='personal'&&workspaceOf(asset)!==state.activeWorkspaceId)||asset.source==='builtin')return false;
        if(!patch||Object.keys(patch).some(key=>key!=='business')||!validBusinessMetadata(patch.business))return false;
        const business={...patch.business,note:patch.business.note.trim(),subject:patch.business.subject.trim()};
        const metadata={...getAssetMetadata(asset),business};
        set({assets:state.assets.map(item=>item.id===id?{...item,metadata,updatedAt:now()}:item)});
        return true;
    },
    adoptAsset: (id, workspaceId) => {
        const state=get(),asset=state.assets.find(item=>item.id===id);
        if(!isWorkspace(workspaceId,state.workspaces)||!workspaceCanEdit(state,workspaceId)||!asset||asset.deletedAt||asset.archived||!canCopyResource(asset,state.activeWorkspaceId,workspaceId)){set({creationError:'素材已不可用或不属于当前空间，请重新选择。'});return;}
        if((asset.source==='builtin'&&!asset.workspaceId)||(!asset.public&&workspaceOf(asset)===workspaceId)){set({creationError:undefined});return asset;}
        const dependencyError=assetDependencyError(state.assets,asset,asset.public?workspaceId:workspaceOf(asset));
        if(dependencyError){set({creationError:dependencyError});return;}
        let prepared:ReturnType<typeof prepareAssetAdoption>;
        try{prepared=prepareAssetAdoption(state,asset,workspaceId);}catch(error){set({creationError:error instanceof Error?error.message:'无法带入关联素材。'});return;}
        const copy=prepared.asset,snapshot=asset.public?copy.workSnapshot:undefined;
        if(snapshot&&isProjectWork(snapshot)){
            const cloned={...cloneWork(snapshot,asset.name),workspaceId,archived:false,deletedAt:undefined};
            const work=adoptWorkResources(cloned,prepared.assets,workspaceId,(id)=>prepared.assets.find(item=>item.id===id));
            const linked={...copy,sourceWorkId:work.id,workSnapshot:undefined};
            set(current=>reconcileWorkOutputs({...current,creationError:undefined,works:[work,...current.works],assets:prepared.assets.map(item=>item.id===copy.id?linked:item)}));
            return get().assets.find(item=>item.id===linked.id);
        }
        set({assets:prepared.assets,creationError:undefined});
        return copy;
    },
    removeAsset: id => {
        const state = get(), asset = state.assets.find(x => x.id === id);
        if(asset&&!workspaceCanEdit(state,workspaceOf(asset)))return false;
        if (asset?.sourceWorkId && !asset.public) return state.deleteWork(asset.sourceWorkId);
        if (!asset || isAssetReferenced(state, id, asset.src))
            return false;
        set({ assets: state.assets.filter(x => x.id !== id) });
        return true;
    },
    copyAssetToLibrary: id => get().adoptAsset(id,'personal')?.id,
    addSkill: skill => set(s => {
        const saved=prepareSkillSave(s,skill);
        return {skills:[saved,...s.skills.filter(item=>item.id!==skill.id)]};
    }),
    submitSkill: id => {
        const state=get(),skill=state.skills.find(item=>item.id===id);
        if(!skill||!skillCanManage(skill,state)||!skill.personal||skill.public||!skillIsValid(skill)){set({creationError:'请先完善自己的技能说明、输入与步骤，再提交社区。'});return;}
        const pending=state.submissions.find(sub=>sub.kind==='skill'&&sub.skill?.id===id&&sub.status==='pending');
        if(pending){set({creationError:undefined});return pending.id;}
        const revision=Math.max(0,...state.submissions.filter(sub=>sub.skill?.id===id).map(sub=>sub.revision))+1;
        const submission:Submission={id:uid('submission'),kind:'skill',name:skill.name,author:'纪鸣',createdAt:now(),status:'pending',revision,skill:publicSkillSnapshot(skill)};
        set({submissions:[submission,...state.submissions],creationError:undefined});return submission.id;
    },
    adoptSkill: (id,workspaceId='personal') => {
        const skill=get().skills.find(item=>item.id===id);
        if(!skill?.public){set({creationError:'该技能尚未发布或已不可用，请重新选择。'});return;}
        return get().copySkillToSpace(id,workspaceId);
    },
    copySkillToSpace: (id,workspaceId) => {
        const state=get();
        if(!isWorkspace(workspaceId,state.workspaces)||!workspaceCanEdit(state,workspaceId)){
            set({creationError:'目标空间不可访问。'});return;
        }
        const skill=prepareSkillAdoption(state,id);
        if(!skill){set({creationError:'技能不可用或当前身份无权使用。'});return;}
        set({skills:state.skills.some(item=>item.id===skill.id)?state.skills:[skill,...state.skills],creationError:undefined});
        return skill;
    },
    toggleFavorite: id => set(s => ({ favorites: s.favorites.includes(id) ? s.favorites.filter(x => x !== id) : [...s.favorites, id] })),
    updateDraft: patch => set(s => ({ drafts: s.drafts.map(d => d.id === s.activeDraftId && workspaceCanEdit(s,workspaceOf(d)) ? {
            ...d, ...structuredClone(patch), intentClarification:patch.text!==undefined&&patch.text!==d.text?structuredClone(patch.intentClarification?.sourcePrompt===patch.text?patch.intentClarification:undefined):('intentClarification' in patch?structuredClone(patch.intentClarification):d.intentClarification), id: d.id, workspaceId:workspaceOf(d), updatedAt: now()
        } : d) })),
    newDraft: patch => {
        requireWorkspaceWrite(get(),patch?.workspaceId||get().activeWorkspaceId);
        const draft = createDraft({workspaceId:get().activeWorkspaceId,...patch});
        set(s => ({ drafts: [draft, ...s.drafts], activeDraftId: draft.id, activeWorkspaceId:workspaceOf(draft) }));
        return draft;
    },
    selectDraft: id => {
        const draft = get().drafts.find(x => x.id === id);
        if (draft&&workspaceCanEdit(get(),workspaceOf(draft))) set({ activeDraftId: id, activeWorkspaceId:workspaceOf(draft) });
    },
    deleteDraft: id => {
        const state = get();
        const removing=state.drafts.find(draft=>draft.id===id);
        if (!removing || !workspaceCanEdit(state,workspaceOf(removing))) return;
        const remaining = state.drafts.filter(draft=>draft.id!==id);
        if (state.activeDraftId !== id) {set({drafts:remaining});return;}
        const existing = remaining.find(draft=>workspaceOf(draft)===state.activeWorkspaceId);
        const next = existing || createDraft({workspaceId:state.activeWorkspaceId});
        set({drafts:existing?remaining:[next,...remaining],activeDraftId:next.id});
    },
    referenceAsset: asset => {
        let state=get(),currentAsset=state.assets.find(item=>item.id===asset.id);
        if(!currentAsset){set({creationError:'素材已不可用。'});return;}
        const sourceSpace=currentAsset.public?state.activeWorkspaceId:workspaceOf(currentAsset);
        const sourceError=assetDependencyError(state.assets,currentAsset,sourceSpace,'ai');
        if(sourceError){set({creationError:sourceError});return;}
        const sourcePack=currentAsset.package;
        if(!sourcePack?.complete||sourcePack.skillIds.some(id=>!state.skills.some(skill=>skill.id===id&&skillAvailableToActor(skill,state)))){set({creationError:'创作资料包不完整或缺少可用 Skill，暂时无法生成同款。'});return;}
        const adopted=state.adoptAsset(currentAsset.id,state.activeWorkspaceId);if(!adopted)return;
        state=get();currentAsset=adopted;const pack=adopted.package!;
        const error=assetDependencyError(state.assets,adopted,state.activeWorkspaceId,'ai');
        if(error){set({creationError:error});return;}
        const current=state.drafts.find(d=>d.id===state.activeDraftId);
        set({creationError:undefined});
        return state.newDraft({workspaceId:state.activeWorkspaceId,text:`参考「${adopted.name}」的风格与制作方法，`,model:current?.model||'deepseek-flash',styleId:pack.styleId||current?.styleId||'',skillIds:[...pack.skillIds],reference:{...structuredClone(pack),sourceId:adopted.id}});
    },
    startRun: (pluginId,sessionDraft,assetKind) => {
        const s = get(), draft = sessionDraft ?? s.drafts.find(x => x.id === s.activeDraftId);
        if (!draft?.text.trim() || !workspaceCanEdit(s,workspaceOf(draft)))
            return;
        const intent=confirmedIntent(draft);
        if(assetKind&&(pluginId||!['image','video','html','component'].includes(assetKind))){set({creationError:'请选择单一有效的创作类型。'});return;}
        if(!pluginId&&!assetKind&&clarificationNeeded(draft.text)&&!intent){set({creationError:'请先确认展示方式，再开始创作。'});return;}
        const basePrompt=creationPrompt(draft),outputKind=assetKind||pluginId||intent||resolveIntent(basePrompt).outputKind,prompt=productionStagePrompt(basePrompt,draft.productionStage);
        if(pluginId&&!registeredPlugin(pluginId)){set({creationError:'创作插件不存在'});return;}
        const disabled=pluginDeniedReason(outputKind,workspaceOf(draft));
        if(disabled){set({creationError:disabled});return;}
        if(taskLimitReached(s.runs,workspaceOf(draft))){set({creationError:'当前空间已达今日 Agent 创作任务上限，请稍后再试或联系管理员调整。'});return;}
        const error=aiResourceError(s,draft.attachmentIds,workspaceOf(draft),draft.reference?.sourceId)||packageDependencyError(s.assets,draft.reference,workspaceOf(draft));
        if(error){set({creationError:error});return;}
        let matched, references;
        try {references=validateReferences(referencesFromPrompt(draft.text,s,workspaceOf(draft),draft.references||[]),s,workspaceOf(draft));matched=selectTaskSkills({accessState:{...s,activeWorkspaceId:workspaceOf(draft)},skills:s.skills,prompt,outputKind,workspaceId:workspaceOf(draft),explicitSkillIds:draft.skillIds});}
        catch(error){set({creationError:error instanceof Error?error.message:'技能暂不可用'});return;}
        const plugin=registeredPlugin(outputKind);
        const dispatch=plugin?.startCreation({draft,explicit:Boolean(pluginId),exhibitType:resolveIntent(basePrompt).type})??{status:'running' as const,step:0,outputKind};
        const run = {
            creationPluginId:plugin?.id,
            productionStage:draft.productionStage||'presales', resourceStrategy:'reuse' as const, explicitSkillIds:[...draft.skillIds], skillSelections:matched.selections,
            id: uid('run'), references:structuredClone(references), workspaceId:workspaceOf(draft), prompt, model: draft.model, styleId: draft.styleId, skillIds: matched.skillIds, attachmentIds: [...draft.attachmentIds], reference: draft.reference ? structuredClone(draft.reference) : undefined, ...dispatch, createdAt: now(),
        };
        if(sessionDraft){set({runs:[{...run,draftId:draft.id},...s.runs],creationError:undefined});return run;}
        const next=createDraft({workspaceId:workspaceOf(draft),model:draft.model});
        set({runs:[{...run,draftId:draft.id},...s.runs],drafts:[next,...s.drafts.filter(item=>item.id!==draft.id)],activeDraftId:next.id,creationError:undefined});
        return run;
    },
    updateRun: (id, patch) => set(s => ({ runs: s.runs.map(r => r.id === id && r.status !== 'complete' && workspaceCanEdit(s,workspaceOf(r)) ? {
            ...r, ...patch, ...(r.creationPluginId?{outputKind:r.creationPluginId,creationPluginId:r.creationPluginId}:{}), id: r.id, workspaceId:workspaceOf(r), step: Math.max(0, Math.min(5, patch.step ?? r.step))
        } : r) })),
    completeRun: id => {
        const state = get(), run = state.runs.find(x => x.id === id);
        if (!run || run.status !== 'running' || !workspaceCanEdit(state,workspaceOf(run)))
            return;
        const background=run.backgroundAssetId?state.assets.find(asset=>asset.id===run.backgroundAssetId):undefined;
        const backgroundError=background&&(background.kind!=='image'||!assetAvailableForInsertion(background,workspaceOf(run))||getAssetMetadata(background).business.usage==='reference')?'所选素材仅供参考或不支持作为背景，请重新选择背景后继续。':undefined;
        const error=aiResourceError(state,[...run.attachmentIds,...(run.backgroundAssetId?[run.backgroundAssetId]:[])],workspaceOf(run),run.reference?.sourceId)||backgroundError||packageDependencyError(state.assets,run.reference,workspaceOf(run));
        if(error){set({runs:state.runs.map(item=>item.id===id?{...item,status:'failed',error}:item)});return;}
        try{validateReferences(run.references||[],state,workspaceOf(run));}catch(error){set({runs:state.runs.map(item=>item.id===id?{...item,status:'failed',error:error instanceof Error?error.message:'参考展项不可用'}:item)});return;}
        const { work:generatedWork, asset } = generateArtifact(run,state.assets);
        const work=generatedWork?pinWorkSkills(adoptWorkResources(generatedWork,get().assets,workspaceOf(run),get().adoptAsset,true),get().skills,workspaceOf(run),get().copySkillToSpace):undefined;
        set(s => reconcileWorkOutputs({...s, works: work ? [work, ...s.works] : s.works, assets: asset ? [asset, ...s.assets] : s.assets, runs: s.runs.map(r => r.id === id ? {
                ...r, status: 'complete', step: 5, workId: work?.id, assetId: asset?.id
            } : r) }));
    },
    reviseWork: (workId, prompt, target={scope:'work'}, attachmentIds=[]) => {
        const state = get(), work = state.works.find(item=>item.id===workId && !item.deletedAt);
        if (!work) return {ok:false,summary:'作品已删除或不存在，请先恢复作品。'};
        if(!workspaceCanEdit(state,workspaceOf(work)))return {ok:false,summary:writePermissionMessage};
        const resourceError=aiResourceError(state,attachmentIds,workspaceOf(work));
        if(resourceError)return {ok:false,summary:resourceError};
        const attachments = state.assets.filter(asset=>attachmentIds.includes(asset.id) && assetAvailableForAI(asset,workspaceOf(work)));
        const plugin=registeredPlugin(work.kind),disabled=pluginDeniedReason(work.kind,workspaceOf(work));
        if(disabled)return {ok:false,summary:disabled};
        const result = (plugin?.revise||reviseScene)(work,prompt,target,attachments);
        const revised=result.work?adoptWorkResources(result.work,get().assets,workspaceOf(work),get().adoptAsset,true):undefined;
        const revision = work.revision+1;
        const turn:ConversationTurn = {id:uid('turn'),workId,prompt:prompt.trim(),target:{...target},status:result.ok?'applied':'unsupported',summary:result.summary,createdAt:now(),...(result.ok?{before:structuredClone(work),afterRevision:revision}:{}),attachmentIds:attachments.map(asset=>asset.id)};
        set(current=>reconcileWorkOutputs({...current,works:revised ? current.works.map(item=>item.id===workId?{...revised,updatedAt:now(),revision}:item):current.works,conversationTurns:[...current.conversationTurns,turn].slice(-80)}));
        return {ok:result.ok,summary:result.summary,turnId:turn.id};
    },
    undoRevision: turnId => {
        const state = get(), turn = state.conversationTurns.find(item=>item.id===turnId);
        if (!turn || turn.status!=='applied' || !turn.before) return {ok:false,summary:'这次修改已撤销或无法撤销。'};
        const work = state.works.find(item=>item.id===turn.workId && !item.deletedAt);
        if(work&&!workspaceCanEdit(state,workspaceOf(work)))return {ok:false,summary:writePermissionMessage};
        const applied = state.conversationTurns.filter(item=>item.workId===turn.workId && item.status==='applied');
        if (!work || applied.at(-1)?.id!==turnId || work.revision!==turn.afterRevision) return {ok:false,summary:'作品已有后续修改，请先处理最新修改，避免覆盖当前内容。'};
        const revision=work.revision+1, previous=applied.at(-2);
        const restored={...retainCreativeMetadata(structuredClone(turn.before),work),revision,updatedAt:now()};
        set(reconcileWorkOutputs({...state,works:state.works.map(item=>item.id===work.id?restored:item),conversationTurns:state.conversationTurns.map(item=>item.id===turnId?{...item,status:'reverted' as const}:item.id===previous?.id&&previous.afterRevision===turn.before?.revision?{...item,afterRevision:revision}:item)}));
        return {ok:true,summary:'已撤销这次修改，其他内容已保留。',turnId};
    },
    submitWork: id => {
        const state = get(), work = state.works.find(x => x.id === id);
        if (!work || work.deletedAt || !workspaceCanEdit(state,workspaceOf(work)))
            return;
        const classificationError=publicationCategoryError(work);
        if(classificationError)throw new Error(classificationError);
        const existing = state.submissions.find(x => x.work?.id === id && x.revision === work.revision && x.status === 'pending');
        if (existing)
            return existing.id;
        const submission: Submission = {
            id: uid('submission'), kind: 'template', name: work.title, author: '纪鸣', createdAt: now(), status: 'pending', work: publicWorkSnapshot(work), revision: work.revision
        };
        set(s => ({ submissions: [submission, ...s.submissions] }));
        return submission.id;
    },
    submitAsset: id => {
        const state = get(), asset = state.assets.find(x => x.id === id);
        if (!asset || asset.deletedAt || asset.archived || !workspaceCanEdit(state,workspaceOf(asset)))
            return;
        const work=asset.sourceWorkId ? state.works.find(item=>item.id===asset.sourceWorkId) : undefined;
        if(work)return state.submitWork(work.id);
        const revision=1;
        const existing = state.submissions.find(x => x.asset?.id === id && x.status === 'pending' && x.revision===revision);
        if (existing)
            return existing.id;
        const submission: Submission = {
            id: uid('submission'), kind: 'asset', name: asset.name, author: '纪鸣', createdAt: now(), status: 'pending', asset: publicAssetSnapshot(snapshotMaterialAsset(asset,state.works)), revision
        };
        set(s => ({ submissions: [submission, ...s.submissions] }));
        return submission.id;
    },
    reviewSubmission: (id, status, reason) => {
        const state = reconcileWorkOutputs(get()), sub = state.submissions.find(x => x.id === id);
        if (!sub || sub.status !== 'pending' || (status !== 'withdrawn' && !canAdmin(state.role,'review')) || (status === 'rejected' && !reason?.trim()))
            return false;
        const targetSpace=sub.work?workspaceOf(sub.work):sub.asset?workspaceOf(sub.asset):sub.skill?workspaceOf(sub.skill):'personal';
        if(sub.skill){
            const original=state.skills.find(skill=>skill.id===sub.skill!.id);
            if(!original||!skillHasActiveScope(original,state))return false;
            if(status==='withdrawn'&&(!original||!skillCanManage(original,state)))return false;
        }else if(!workspaceCanEdit(state,targetSpace))return false;
        let templates = state.templates, assets = state.assets, skills = state.skills;
        if (status === 'approved' && sub.work) {
            if(publicationCategoryError(sub.work))return false;
            const previous=state.templates.find(template=>template.work.id===sub.work!.id);
            const template: Template = {
                id: previous?.id || `published-${sub.work.id}`, title: sub.name, type: sub.work.type, author: sub.author, tags: previous?.tags||['团队共创'], likes: previous?.likes||0, uses: previous?.uses||0, work: publicWorkSnapshot(sub.work)
            };
            templates = [template, ...templates.filter(x => x.id !== template.id)];
        }
        if (status === 'approved' && sub.asset) {
            const metadata=getAssetMetadata(sub.asset);
            const asset: Asset = {
                ...publicAssetSnapshot(sub.asset), knowledgeTarget:undefined, metadata:{...metadata,business:{...metadata.business,usage:metadata.business.usage==='project'?'reusable':metadata.business.usage}}, id: state.assets.find(asset=>asset.public&&sub.asset?.workSnapshot&&asset.workSnapshot?.id===sub.asset.workSnapshot.id)?.id || `published-${sub.asset.id}`, public: true, source: 'community'
            };
            assets = [asset, ...assets.filter(x => x.id !== asset.id)];
        }
        if (status === 'approved' && sub.skill) {
            const id=state.skills.find(skill=>skill.public&&skill.sourceSkillId===sub.skill!.id)?.id||`published-skill-${sub.skill.id}`;
            const published:Skill={...publicSkillSnapshot(sub.skill),id,personal:false,public:true,sourceSkillId:sub.skill.id,origin:undefined,revision:sub.revision};
            skills=[published,...skills.filter(skill=>skill.id!==id)];
        }
        set({
            templates, assets, skills, works:state.works,runs:state.runs,favorites:state.favorites,projectSchemaVersion:state.projectSchemaVersion,submissions: state.submissions.map(x => x.id === id ? { ...x, status, reason: reason?.trim() } : x)
        });
        return true;
    },
    resetDemo: () => {
        const state = get();
        state.workspaces.forEach(space=>requireWorkspaceWrite(state,space.id));
        try {
            if (typeof localStorage !== 'undefined')
                localStorage.setItem('zhichuang-studio-before-reset', JSON.stringify({ works: state.works, assets: state.assets, drafts: state.drafts }));
        }
        catch {
        }
        const seed = createInitialData();
        removeCreationDraftCaches(state);
        set({ ...seed, ...normalizeWorkspaceState(state), resourceSchemaVersion:3,projectSchemaVersion:1,composerSchemaVersion:1, loggedIn: state.loggedIn, assets: [...state.assets.filter(x => x.source === 'uploaded'), ...seed.assets] });
    }
}), { name: 'zhichuang-studio-v1', version: 1, storage: createJSONStorage(() => typeof localStorage !== 'undefined' ? localStorage : fallback), merge:(persisted,current)=>{
    const previous = persisted && typeof persisted==='object' ? persisted as Partial<StudioStore> : {};
    const restored = previous.resourceSchemaVersion===3 ? previous : {...previous,
        ...(previous.works?{works:previous.works.map(work=>work.archived?{...work,archived:false}:work)}:{}),
        ...(previous.assets?{assets:previous.assets.map(asset=>asset.archived?{...asset,archived:false}:asset)}:{}),
    };
    const workspaceState=normalizeWorkspaceState(previous,id=>typeof localStorage!=='undefined'?localStorage.getItem(`zhichuang.demo-members.v1.${id}`):null);
    const merged = migrateWorkspaceDemos(migrateCatalogComponents(migrateResourcesV15({...current,...restored,...workspaceState,workspaceDemoVersion:previous.workspaceDemoVersion,sharingSchemaVersion:previous.sharingSchemaVersion,resourceSchemaVersion:3,composerSchemaVersion:1})));
    const previousDrafts=Array.isArray(merged.drafts)?merged.drafts:[];
    const drafts=previous.composerSchemaVersion===1?previousDrafts:previousDrafts.filter(draft=>!submittedLegacyDraft(draft,Array.isArray(merged.runs)?merged.runs:[]));
    const session=restoreWorkspaceSession({...merged,drafts},previous);
    const creationSessions=Array.isArray(merged.creationSessions)?merged.creationSessions.filter(chat=>chat&&workspaceState.workspaces.some(space=>space.id===chat.workspaceId&&!space.purgedAt)):[];
    return reconcileWorkOutputs({...merged,...session,creationSessions,conversationTurns:Array.isArray(merged.conversationTurns)?merged.conversationTurns:[]});
} }));

export function attachAssetToDraft(draftId:string, asset:Asset):void {
    const state=useStudio.getState(),draft=state.drafts.find(item=>item.id===draftId);
    if(draft)requireWorkspaceWrite(state,workspaceOf(draft));
    requireWorkspaceWrite(state,asset.workspaceId||(draft?workspaceOf(draft):'personal'));
    const previous=state.assets.find(item=>item.id===asset.id);
    if(previous)requireWorkspaceWrite(state,workspaceOf(previous));
    useStudio.setState(state=>({
        assets:[{...structuredClone(asset),workspaceId:asset.workspaceId || (draft ? workspaceOf(draft) : 'personal')},...state.assets.filter(a=>a.id!==asset.id)],
        drafts:state.drafts.map(d=>d.id===draftId?{...d,attachmentIds:[...new Set([...d.attachmentIds,asset.id])],updatedAt:now()}:d),
    }));
}
