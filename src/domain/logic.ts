import {collectStoryPhotoTemplates} from './story-photo';
import {mapConditionNode} from './story-events';
import {collectStoryAudio} from './story-audio';
import type {ExhibitReference} from './exhibit-references';
import type { ExhibitType, Run, VoiceCommand, Work } from './types';
import { now, uid, systems, resolutions } from './scenes';
export function validateWork(input: {
    title: string;
    width: number;
    height: number;
}): void {
    if (!input.title.trim())
        throw new Error('请输入展项名称');
    if (input.title.trim().length > 80)
        throw new Error('展项名称最多 80 个字符');
    if (![input.width, input.height].every(x => Number.isInteger(x) && x >= 320 && x <= 16384))
        throw new Error('分辨率需为 320–16384 之间的整数');
}
export function cloneWork(source: Work, title = `${source.title} · 副本`): Work {
    const copy = structuredClone(source), ids = new Map<string, string>();
    const map = (id: string) => {
        if (!ids.has(id))
            ids.set(id, uid('copy'));
        return ids.get(id)!;
    };
    for (const page of copy.pages) {
        map(page.id);
        for (const node of page.nodes) {
            map(node.id);
            node.items?.forEach(x => map(x.id));
            node.interactions?.forEach(x => map(x.id));
            node.commands?.forEach(x => map(x.id));
        }
    }
    copy.storyNodes?.forEach(n => {map(n.id);n.layers?.forEach(layer=>map(layer.id));});
    copy.storyEdges?.forEach(e => map(e.id));
    const ref = (id?: string) => id ? (ids.get(id) || id) : undefined;
    const workId=uid('work');
    const ownReferences=(references:ExhibitReference[]|undefined)=>references?.map(reference=>reference.transfer?.workId===source.id?{...reference,transfer:{...reference.transfer,workId}}:reference);
    return {
        ...copy, references:ownReferences(copy.references),referenceHistory:ownReferences(copy.referenceHistory),referenceSnapshots:ownReferences(copy.referenceSnapshots),experience:undefined, ...(copy.creationPackage?{creationPackage:{...copy.creationPackage,references:ownReferences(copy.creationPackage.references),referenceHistory:ownReferences(copy.creationPackage.referenceHistory),experience:undefined}}:{}), id: workId, projectId: uid('project'), title, revision: 1, archived: false, createdAt: now(), updatedAt: now(), pages: copy.pages.map(p => ({ ...p, id: map(p.id), nodes: p.nodes.map(n => ({
                ...n, id: map(n.id), items: n.items?.map(x => ({ ...x, id: map(x.id), parentId: ref(x.parentId) })), interactions: n.interactions?.map(x => ({ ...x, id: map(x.id), targetId: ref(x.targetId) })), commands: n.commands?.map(x => ({ ...x, id: map(x.id), targetId: ref(x.targetId) }))
            })) })), storyNodes: copy.storyNodes?.map(n => ({ ...n, id: map(n.id),...(n.layers?{layers:n.layers.map(l=>({...l,id:map(l.id)}))}:{}) })), storyEdges: copy.storyEdges?.map(e => ({
            ...e, label:mapConditionNode(e.label,ids), id: map(e.id), source: map(e.source), target: e.target?map(e.target):'', layerId:ref(e.layerId),effects:e.effects?.map(f=>({...f,id:map(f.id),layerId:map(f.layerId)}))
        })), shots: copy.shots?.map(x => ({ ...x, id: uid('shot') }))
    };
}
export function resolveIntent(prompt: string): {
    outputKind: Run['outputKind'];
    type: ExhibitType;
} {
    const p = prompt.toLowerCase();
    let outputKind: Run['outputKind'] = 'exhibit';
    if (/造梦|影游|互动影片|互动故事|分支故事/.test(p))
        outputKind = 'story';
    else if (/组件|气泡|声波|控件/.test(p))
        outputKind = 'component';
    else if (/html|网页|交互程序/.test(p))
        outputKind = 'html';
    else if (/视频|短片|分镜|成片/.test(p))
        outputKind = 'video';
    else if (/交互页面|时间轴展项/.test(p) && !/智能演示|幻灯片|ppt|讲稿/.test(p))
        outputKind = 'exhibit';
    else if (/演示|讲解|ppt|讲稿/.test(p))
        outputKind = 'presentation';
    else if (/背景|图片|海报|壁纸/.test(p) && !(/展项|大事记|时间轴/.test(p)))
        outputKind = 'image';
    const type: ExhibitType = /关系|图谱|技术树/.test(p) ? '关系图谱型' : /案例|荣誉|资质|卡片/.test(p) ? '卡片浏览型' : /地图|点位|分布/.test(p) ? '空间分布型' : /流程|工艺|架构/.test(p) ? '流程架构型' : /数据|指标|看板/.test(p) ? '数据总览型' : /视频|故事|影廊|媒体/.test(p) ? '媒体叙事型' : '时间演进型';
    return { outputKind, type };
}
export const normalizeCommand = (phrase: string) => phrase.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
export function validateCommands(commands: VoiceCommand[]): string {
    const seen = new Set<string>();
    for (const cmd of commands.filter(c => c.enabled)) {
        if (!normalizeCommand(cmd.phrase))
            return '请输入有效口令';
        for (const phrase of [cmd.phrase, ...cmd.aliases.split(/[，,;；\n]/)].map(normalizeCommand).filter(Boolean)) {
            const key = `${cmd.scope}:${phrase}`;
            if (seen.has(key))
                return `同一范围存在重复口令：${phrase}`;
            seen.add(key);
        }
    }
    return '';
}
export function collectAssetSources(work: Work): string[] {
    const sources = work.pages.flatMap(p => [p.backgroundImage, ...p.nodes.flatMap(n => [n.src, ...(n.items || []).map(x => x.image)])]);
    sources.push(work.cover,...[...collectStoryAudio(work),...collectStoryPhotoTemplates(work)].map(t=>t.src),...(work.shots || []).map(s => s.src), ...(work.storyNodes || []).flatMap(n => [n.media,...(n.layers||[]).map(l=>l.src)]));
    return [...new Set(sources.filter((x): x is string => !!x))];
}

export function resolveStyle(prompt:string, explicitStyleId?:string):string {
    if(systems.some(s=>s.id===explicitStyleId))return explicitStyleId!;
    if(/珠宝|钻石|珠玉|精品/.test(prompt))return 'jewelry';
    if(/金融|财经|财务|经济|证券/.test(prompt))return 'finance';
    if(/政务|政府|党建|红色/.test(prompt))return 'government';
    if(/文旅|文化|历史|人物|典藏/.test(prompt))return 'culture';
    if(/钢铁|工业|制造|工厂/.test(prompt))return 'industrial';
    if(/科技|智能|数字|AI|ai/.test(prompt))return 'technology';
    return 'industrial';
}
export function resolveDimensions(prompt:string):{width:number;height:number} {
    const pair=prompt.match(/(\d{3,5})\s*[×xX*＊]\s*(\d{3,5})/);
    const width=Number(pair?.[1]),height=Number(pair?.[2]);
    const preset=resolutions.find(r=>r.width===width&&r.height===height);
    return preset?{width:preset.width,height:preset.height}:{width:1920,height:1080};
}
