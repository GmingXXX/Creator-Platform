import {collectStoryPhotoTemplates} from './story-photo';
import {collectStoryAudio} from './story-audio';
import {buildAIWork} from './ai-plan';
import {applyCreationReferences,referenceExhibitType} from './reference-application';
import type { Asset, Run, StudioData, Work } from './types';
import { createSceneWork, createNode, now, uid } from './scenes';
import { makePackage } from './fixtures';
import { resolveIntent, resolveStyle, resolveDimensions } from './logic';
import { assetAvailableForInsertion } from './asset-access';
import { nativeComponentForPrompt } from './generation-resource';
export function generateArtifact(run: Run, assets:Asset[] = []): {
    work?: Work;
    asset?: Asset;
} {
    const resolved=resolveIntent(run.prompt),referenceType=referenceExhibitType(run.prompt,run.references||[],resolved.type),type=referenceType.type, styleId = resolveStyle(run.prompt,run.styleId);
    const binding = run.styleId || '';
    const bindWork = (work:Work):Work => applyCreationReferences({...work,productionStage:run.productionStage,references:structuredClone(run.references||[]),aiModel:'demo',styleId:binding,workspaceId:run.workspaceId || 'personal',creationPackage:{
        ...makePackage(work.title,binding,`/media/${styleId}.svg`,run.skillIds),references:structuredClone(run.references||[]),prompt:run.prompt,sourceId:run.reference?.sourceId||run.reference?.id,
        files:[...assets.filter(asset=>run.attachmentIds.includes(asset.id)).map(asset=>({name:`附件/${asset.name}`,type:asset.kind,src:asset.src})),...(run.reference?.files||[]).map(file=>({...file,name:`参考资源/${file.name}`}))],
        params:{model:run.model,resolution:`${work.width} × ${work.height}`,sourceVersion:run.reference?.version||'无'},
    }},run.references||[],{prompt:run.prompt,preserveColors:Boolean(run.styleId),interactionId:work.kind==='exhibit'?referenceType.referenceId:undefined});
    const {width,height}=resolveDimensions(run.prompt);
    const title = run.prompt.replace(/^(请|帮我|为我|生成|制作|设计|一个|一张|一份|基于|参考|采用)+/g, '').split(/[。！？\n]/)[0].slice(0, 28) || '新的创作';
    const componentType = run.outputKind === 'component' ? nativeComponentForPrompt(run.prompt) : undefined;
    const needsAdaptation = run.outputKind === 'component' && !componentType;
    const kind = needsAdaptation ? 'html' : run.outputKind;
    if (['exhibit', 'presentation', 'story'].includes(kind)) {
        const work = kind==='exhibit'&&run.structureConfirmed&&run.aiPlan?.mode==='create'?buildAIWork(run.aiPlan,run,assets):bindWork(createSceneWork({
            title, type, width, height, styleId, kind: kind === 'exhibit' ? 'exhibit' : kind as 'presentation' | 'story'
        }));
        if (kind === 'exhibit' && run.resourceStrategy === 'generate') {
            const background = generateArtifact({...run, outputKind:'image'}, assets).asset!;
            return {work:{...work,pages:work.pages.map((page,index)=>index===0?{...page,backgroundImage:background.src,backgroundAssetId:background.id}:page)}, asset:{...background,package:background.package?{...background.package,params:{...background.package.params,experienceWorkId:work.id},references:structuredClone(work.references||[])}:undefined, name:`${title} · 背景`, description:'为本次展项补齐的背景示例，已保存完整创作资料包。当前 Demo 使用匹配风格的示例媒体，未调用真实图像生成服务。'}};
        }
        if (kind === 'exhibit' && run.backgroundAssetId) {
            const background = assets.find(asset => asset.id === run.backgroundAssetId);
            if (!background || background.kind !== 'image' || !assetAvailableForInsertion(background,run.workspaceId || 'personal'))
                throw new Error('所选背景已不可用，请重新选择一张当前空间可使用的图片。');
            return {work:{...work,pages:work.pages.map((page,index)=>index===0?{...page,backgroundImage:background.src,backgroundAssetId:background.id}:page)}};
        }
        return {work};
    }
    const src = kind === 'video' ? '/media/demo-loop.mp4' : kind === 'html' ? '/media/interactive.html' : `/media/${styleId}.svg`;
    const basePackage = makePackage(title, binding, src, run.skillIds);
    const asset: Asset = {
        id: uid('asset'), workspaceId:run.workspaceId || 'personal', name: title, kind: kind === 'video' ? 'video' : kind === 'component' ? 'component' : kind === 'html' ? 'html' : 'image', src, preview: `/media/${styleId}.svg`, description: kind === 'video' ? '演示样片；脚本修改保存在工程中，示例媒体不代表重新渲染的成片。' : kind === 'component' ? '基于平台已适配的组件生成样式与配置，可在画布中编辑开放属性。当前演示未生成或适配新的组件代码。' : kind === 'html' ? '交互程序示例，可在画布中调整位置与尺寸；内部功能与属性需开发适配，不会自动拆分为原生组件。' : '根据当前需求生成的图片示例，保留本次提示词与参考资料；当前 Demo 未调用真实图像生成服务。', tags: ['我的生成', styleId, ...(needsAdaptation ? ['交互程序','待适配'] : [])], author: '纪鸣', createdAt: now(), source: 'generated', public: false, componentType, package: {
            ...basePackage, references:structuredClone(run.references||[]), prompt: run.prompt, sourceId: run.reference?.sourceId || run.reference?.id, files: [...basePackage.files,...assets.filter(a=>run.attachmentIds.includes(a.id)).map(a=>({name:`附件/${a.name}`,type:a.kind,src:a.src})), ...(run.reference?.files || []).map(f => ({ ...f, name: `参考资源/${f.name}` })), { name: '本次生成配置.json', type: 'config', content: JSON.stringify({ model: run.model, styleId, skillIds: run.skillIds }) }], params: { model: run.model, resolution: `${width} × ${height}`, sourceVersion: run.reference?.version || '无' }
        }
    };
    if (kind === 'component')
        return { asset: { ...asset, package: { ...asset.package!, files: [...asset.package!.files, { name: 'component.schema.json', type: 'component', content: JSON.stringify({ type: asset.componentType, editable: ['content', 'color', 'background', 'size', ...(componentType === 'bubble' ? ['state'] : ['items'])], ...(componentType === 'bubble' ? {states:['idle', 'listening', 'thinking', 'speaking']} : {}) }) }] } } };
    if (kind === 'html') {
        const work = bindWork(createSceneWork({
            title, type: '媒体叙事型', width, height, styleId
        }));
        return { asset: {...asset,presentationRole:needsAdaptation?'embedded-component':'project-source',sourceWorkId:needsAdaptation?undefined:work.id}, work: { ...work, creationPackage:asset.package, pages: [{ ...work.pages[0], nodes: [createNode('html', {
                                x: 0, y: 0, w: width, h: height, src, content: title
                            })] }] } };
    }
    if (kind === 'video')
        return { work: {...bindWork(createSceneWork({
                title, type: '媒体叙事型', width, height, styleId, kind: 'video'
            })),creationPackage:asset.package} };
    return { asset };
}
export function isAssetReferenced(data: Pick<StudioData, 'works' | 'drafts' | 'assets' | 'runs' | 'creationSessions'>, id: string, src: string): boolean {
    if(data.creationSessions?.some(session=>session.draft.attachmentIds.includes(id)||session.draft.reference?.files.some(file=>file.src===src)||[...session.messages,...session.queued||[]].some(entry=>entry.attachmentIds?.includes(id))))return true;
    if(data.runs.some(r=>r.backgroundAssetId===id||r.attachmentIds.includes(id)||r.reference?.files.some(f=>f.src===src)))return true;
    if (data.drafts.some(d => d.attachmentIds.includes(id) || d.reference?.files.some(f => f.src === src)))
        return true;
    const references=(referenceId:string|undefined,referenceSrc:string|undefined)=>referenceId?referenceId===id:referenceSrc===src;
    if (data.works.some(w => references(w.coverAssetId,w.cover) || [...collectStoryAudio(w),...collectStoryPhotoTemplates(w)].some(t=>references(t.assetId,t.src)) || w.pages.some(p => references(p.backgroundAssetId,p.backgroundImage) || p.nodes.some(n => references(n.assetId,n.src) || n.items?.some(x => references(x.assetId,x.image)))) || w.shots?.some(x => references(x.assetId,x.src)) || w.storyNodes?.some(x => references(x.mediaAssetId,x.media))))
        return true;
    // Fixed project copies own the same stored bytes; removing the personal catalog entry
    // does not remove those bytes or the independently versioned project record.
    const hasCopy=(workspaceId:string|undefined)=>data.assets.some(asset=>asset.id!==id&&!asset.deletedAt&&!asset.archived&&asset.src===src&&asset.origin?.assetId===id&&(asset.workspaceId||'personal')===(workspaceId||'personal'));
    if(data.works.some(work=>work.creationPackage?.sourceId===id||(!hasCopy(work.workspaceId)&&work.creationPackage?.files.some(file=>file.src===src))))return true;
    return data.assets.some(a => a.id !== id && a.package?.files.some(f => f.src === src&&!(a.origin?.assetId===id&&a.src===src)));

}
