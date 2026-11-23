import {beforeEach, describe, expect, it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {isMaterialWork, isProjectWork, reconcileWorkOutputs} from '../src/domain/work-outputs';
import {isLibraryAsset,resolveAssetProject} from '../src/domain/project-taxonomy';
import type {Asset} from '../src/domain/types';

beforeEach(()=>useStudio.setState(createInitialData()));
const presentation=()=>useStudio.getState().works.find(w=>w.kind==='presentation')!;
const legacyAlias=():Asset=>{
 const state=useStudio.getState(),work=presentation();
 return {...state.assets[0],id:'legacy-index',name:work.title,kind:'presentation',public:false,source:'generated',src:'',sourceWorkId:work.id,
  package:{...state.assets[0].package!,files:[{name:'可编辑工程.json',type:'config',content:JSON.stringify(work)}]}};
};

describe('canonical project output ownership',()=>{
 it('keeps all four editable work kinds in projects without synthetic material entries',()=>{
  const state=useStudio.getState();
  expect(state.works.filter(work=>isProjectWork(work)&&(!work.workspaceId||work.workspaceId==='personal')).map(w=>w.kind)).toEqual(['exhibit','exhibit','exhibit','presentation','video','story']);
  expect(state.works.filter(isMaterialWork)).toEqual([]);
  expect(state.assets.filter(a=>a.sourceWorkId)).toEqual([]);
 });
 it('preserves lifecycle and workspace during persisted migration without synthesizing assets',()=>{
  const state=useStudio.getState(),work={...presentation(),workspaceId:'xintai',archived:true,deletedAt:'2026-11-01'};
  const old={...state,resourceSchemaVersion:3,works:[work],assets:state.assets,runs:[]};
  const once=reconcileWorkOutputs(old),twice=reconcileWorkOutputs(once);
  expect(once.works).toEqual([work]);expect(twice).toEqual(once);expect(once.assets).toEqual(state.assets);
  const merged=useStudio.persist.getOptions().merge!(old,state);expect(merged.works).toEqual(once.works);
 });
 it('retains a real generated video independently from a completed editable video project',()=>{
  const state=useStudio.getState(),work=state.works.find(w=>w.kind==='video')!,oldAsset={...state.assets.find(a=>a.kind==='video')!,id:'old-video-result',public:false,source:'generated' as const};
  const run={id:'old-run',prompt:'生成视频',model:'GPT',styleId:'',skillIds:[],attachmentIds:[],status:'complete' as const,step:5,outputKind:'video' as const,workId:work.id,assetId:oldAsset.id,createdAt:work.createdAt};
  const migrated=reconcileWorkOutputs({...state,works:[work],assets:[oldAsset],runs:[run]});
  expect(migrated.assets).toEqual([oldAsset]);expect(isLibraryAsset(migrated.assets[0])).toBe(true);expect(migrated.runs[0]).toEqual(run);
 });
 it('saves the same project ID and space without adding an engineering asset',()=>{
  const state=useStudio.getState();state.setWorkspace('dongguan');const work=state.createWork({title:'博物馆讲解',kind:'presentation',type:'媒体叙事型',width:1920,height:1080});
  const before=useStudio.getState().assets;state.saveWork({...work,title:'博物馆讲解第二版',pages:work.pages.slice(0,2)});
  expect(useStudio.getState().works.find(w=>w.id===work.id)).toMatchObject({title:'博物馆讲解第二版',workspaceId:'dongguan'});
  expect(useStudio.getState().works.filter(w=>w.id===work.id)).toHaveLength(1);expect(useStudio.getState().assets).toEqual(before);
 });
 it('revises and undoes the project while preserving original assets',()=>{
  const state=useStudio.getState(),work=presentation(),assets=state.assets;
  const result=state.reviseWork(work.id,'标题改成创新成果展');expect(result.ok).toBe(true);
  expect(useStudio.getState().works.find(w=>w.id===work.id)?.pages[0].nodes[0].content).toBe('创新成果展');
  expect(state.undoRevision(result.turnId!).ok).toBe(true);expect(useStudio.getState().works.find(w=>w.id===work.id)?.pages).toEqual(work.pages);expect(useStudio.getState().assets).toEqual(assets);
 });
 it('retains legacy deep links across project deletion and restoration',()=>{
  const state=useStudio.getState(),work=presentation(),alias=legacyAlias();state.addAsset(alias);
  expect(state.removeAsset(alias.id)).toBe(true);expect(resolveAssetProject(alias,useStudio.getState().works)?.deletedAt).toBeTruthy();
  expect(state.removeAsset(alias.id)).toBe(false);expect(state.restoreWork(work.id)).toBe(true);expect(resolveAssetProject(alias,useStudio.getState().works)?.deletedAt).toBeUndefined();
  state.archiveWork(work.id);expect(resolveAssetProject(alias,useStudio.getState().works)?.archived).toBe(true);state.archiveWork(work.id);expect(resolveAssetProject(alias,useStudio.getState().works)?.archived).toBe(false);
 });
 it('routes legacy engine index submissions into reviewed template snapshots',()=>{
  const state=useStudio.getState(),work=presentation(),alias=legacyAlias();state.addAsset(alias);const submissionId=state.submitAsset(alias.id)!;
  const submitted=useStudio.getState().submissions.find(s=>s.id===submissionId)!;
  expect(submitted.kind).toBe('template');expect(submitted.work?.id).toBe(work.id);expect(submitted.asset).toBeUndefined();
  state.saveWork({...work,title:'后续私人修改'});state.setRole('reviewer');expect(state.reviewSubmission(submissionId,'approved')).toBe(true);
  const published=useStudio.getState().templates.find(t=>t.id===`published-${work.id}`)!;expect(published.work.title).toBe(work.title);
 });
 it('copies a published presentation template into an independent project in the active space',()=>{
  const state=useStudio.getState(),work=presentation(),submissionId=state.submitWork(work.id)!;state.setRole('reviewer');state.reviewSubmission(submissionId,'approved');state.setWorkspace('aitown');
  const pub=useStudio.getState().templates.find(t=>t.work.id===work.id)!,copy=state.cloneTemplate(pub.id)!;
  expect(copy.id).not.toBe(work.id);expect(copy.workspaceId).toBe('aitown');expect(copy.pages[0].id).not.toBe(work.pages[0].id);
  state.saveWork({...copy,title:'我的修改'});expect(useStudio.getState().templates.find(t=>t.id===pub.id)?.work.title).toBe(work.title);
 });
 it('copies ordinary materials and rejects missing or deleted legacy engineering sources',()=>{
  const state=useStudio.getState(),publicAsset=state.assets.find(a=>a.public&&!a.workSnapshot)!;const copyId=state.copyAssetToLibrary(publicAsset.id)!;
  expect(useStudio.getState().assets.find(a=>a.id===copyId)).toMatchObject({public:false,source:'community',workspaceId:'personal'});
  expect(state.copyAssetToLibrary('missing')).toBeUndefined();const work=presentation(),alias=legacyAlias();state.addAsset(alias);state.deleteWork(work.id);expect(state.submitAsset(alias.id)).toBeUndefined();
 });
 it.each([['制作企业创新讲解PPT','presentation'],['制作品牌讲解视频','video']])('saves generated %s to projects in the originating space', (prompt,kind)=>{
  const state=useStudio.getState();state.setWorkspace('xintai');state.updateDraft({text:prompt});const run=state.startRun()!;state.setWorkspace('personal');state.completeRun(run.id);
  const completed=useStudio.getState().runs.find(r=>r.id===run.id)!,work=useStudio.getState().works.find(w=>w.id===completed.workId)!;
  expect(work.kind).toBe(kind);expect(work.workspaceId).toBe('xintai');expect(completed.assetId).toBeUndefined();expect(useStudio.getState().assets.some(a=>a.sourceWorkId===work.id)).toBe(false);
 });
 it('recovers orphan engineering only from explicit legacy indexes without duplicating works',()=>{
  const state=useStudio.getState(),work=presentation(),alias={...legacyAlias(),workspaceId:'xintai',deletedAt:'2026-11-01',archived:true};
  const run={id:'orphan-run',prompt:'旧讲解',model:'GPT',styleId:'',skillIds:[],attachmentIds:[],status:'complete' as const,step:5,outputKind:'presentation' as const,assetId:alias.id,createdAt:work.createdAt};
  const migrated=reconcileWorkOutputs({...state,works:[],assets:[alias,{...alias,id:'second-index'}],runs:[run]});
  expect(migrated.works).toHaveLength(1);expect(migrated.works[0]).toMatchObject({id:work.id,workspaceId:'xintai',deletedAt:alias.deletedAt,archived:true});expect(migrated.runs[0].workId).toBe(work.id);expect(reconcileWorkOutputs(migrated)).toEqual(migrated);
  expect(reconcileWorkOutputs({...state,works:[],assets:[{...alias,sourceWorkId:undefined}],runs:[]}).works).toEqual([]);
 });
 it('normalizes legacy asset review snapshots even without a hydration pass',()=>{
  const state=useStudio.getState(),work=presentation(),asset={...legacyAlias(),sourceWorkId:undefined,workSnapshot:work};
  const sub={id:'old-sub',kind:'asset' as const,name:work.title,author:'纪鸣',createdAt:work.createdAt,status:'pending' as const,revision:work.revision,asset};
  useStudio.setState({submissions:[sub]});state.setRole('reviewer');expect(state.reviewSubmission(sub.id,'approved')).toBe(true);
  const next=useStudio.getState();expect(next.templates.some(t=>t.work.id===work.id)).toBe(true);expect(next.submissions[0].kind).toBe('template');expect(next.assets.some(a=>a.public&&a.workSnapshot?.id===work.id)).toBe(false);
 });
 it('retains incomplete legacy packages and invalid engineering files unchanged',()=>{
  const state=useStudio.getState(),asset=legacyAlias(),original={name:'工程素材/原始参考.png',type:'image',src:'/media/original.png'};
  const old={...asset,package:{...asset.package!,complete:false,files:[{name:'可编辑工程.json',type:'config',content:'invalid JSON'},original]}};
  const result=reconcileWorkOutputs({...state,works:[],assets:[old]});expect(result.assets).toEqual([old]);expect(result.works).toEqual([]);
 });
 it('never refreshes a public engineering snapshot from its private source',()=>{
  const work=presentation(),state=useStudio.getState(),pub:Asset={...legacyAlias(),id:'public-old',public:true,workSnapshot:structuredClone(work),sourceWorkId:undefined};
  const reconciled=reconcileWorkOutputs({...state,works:[{...work,title:'changed'}],assets:[pub]});expect(reconciled.assets[0]).toEqual(pub);expect(reconciled.templates.find(t=>t.id===pub.id)?.work.title).toBe(work.title);
 });
});
