import {pluginEditorPath} from '../../domain/creation-plugins';
import type { Asset, DesignSystem, SceneNode, Skill, Work } from '../../domain/types';
import {getWorkDisplayForm} from '../../domain/project-taxonomy';
import { assetAvailableForInsertion } from '../../domain/asset-access';

export const typeLabels: Record<string,string> = {image:'图片',video:'视频',presentation:'文档资料',audio:'音频',component:'组件',html:'嵌入式组件',document:'文档资料'};
export const kindLabels: Record<string,string> = {exhibit:'交互页面',presentation:'讲解演示',video:'视频创作',story:'互动影片'};
export const sourceLabels: Record<string,string> = {uploaded:'本地上传',generated:'智能生成',community:'社区复用',builtin:'内置素材'};
export const statusLabels: Record<string,string> = {pending:'待审核',approved:'已通过',rejected:'已退回',withdrawn:'已撤回'};
export function workRoute(work: Work) {
 return work.kind==='video'?`/video/${work.id}`:pluginEditorPath(work.kind||'exhibit',work.id);
}
export function assetPreviewWork(asset:Asset, works:Work[]):Work|undefined {
 // A published material always renders its reviewed snapshot, never a private source.
 if(asset.public)return asset.workSnapshot;
 return works.find(work=>work.id===asset.sourceWorkId)||asset.workSnapshot;
}
export function assetCanInsert(asset:Asset):boolean {
 return assetAvailableForInsertion(asset,asset.workspaceId||'personal');
}
export function formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}); }
export function filterWorks(works:Work[], filters:{query:string;type:string;time:string;archived:boolean;sort:string}) {
 const query=filters.query.trim().toLowerCase();
 const days=filters.time==='最近7天'?7:filters.time==='最近30天'?30:Infinity;
 return works.filter(w=>Boolean(w.archived)===filters.archived && (filters.type==='全部'||(filters.type==='none'?getWorkDisplayForm(w)===null:getWorkDisplayForm(w)===filters.type)) && (!query || `${w.title}${getWorkDisplayForm(w)||''}`.toLowerCase().includes(query)) && (days===Infinity||Date.now()-new Date(w.updatedAt).getTime()<days*86400000)).sort((a,b)=>filters.sort==='name'?a.title.localeCompare(b.title,'zh-CN'):Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
export function applySystem(work:Work, system:DesignSystem):Work {
 return {...work,styleId:system.id,pages:work.pages.map(p=>({...p,background:system.background,backgroundImage:p.backgroundImage?`/media/${system.id}.svg`:undefined,backgroundAssetId:undefined,nodes:p.nodes.map(n=>({...n,color:n.type==='button'?system.background:system.text,background:n.type==='button'?system.accent:n.background==='transparent'?'transparent':n.type==='shape'?system.accent:system.background,motion:n.motion?{...n.motion,easing:'ease-in-out'}:undefined}))}))};
}
export function assetNode(asset:Asset,work:Work):SceneNode {
 if(!assetCanInsert(asset))throw new Error('请通过“继续编辑”打开素材工程，完成的媒体文件才能插入画布。');
 const type=asset.kind==='component'?asset.componentType!:asset.kind as SceneNode['type'];
 return {id:crypto.randomUUID(),assetId:asset.id,type,name:asset.name,x:Math.round(work.width*.25),y:Math.round(work.height*.25),w:Math.round(work.width*.5),h:Math.round(work.height*.5),rotation:0,opacity:1,hidden:false,locked:false,content:asset.kind==='component'?'你好，我是展厅智能助手':asset.name,src:asset.src,color:'#ffffff',background:'transparent',fontSize:32,radius:16,items:asset.kind==='component'?[{id:crypto.randomUUID(),title:'探索内容',description:'双击编辑这个组件的内容'}]:undefined};
}
export function parseSkill(text:string,filename:string):Skill {
 if(text.length>200000) throw new Error('技能说明过大，请使用 200 KB 以内的文件。');
 let data:Partial<Skill>;
 if(filename.toLowerCase().endsWith('.json')) {
  try { data=JSON.parse(text); } catch {throw new Error('JSON 格式无效，请检查后重新上传。');}
  if(!data||typeof data!=='object')throw new Error('请上传有效的技能对象。');
 } else if(/\.md$/i.test(filename)) {
  const name=text.match(/^#\s+(.+)/m)?.[1];
  const description=text.split('\n').map(l=>l.trim()).find(l=>l&&!l.startsWith('#')&&!/^\d[.)]/.test(l));
  data={name,description,input:text.match(/##\s*输入\s*\n([^#]+)/)?.[1]?.trim()||'请描述创作主题、目标屏幕和风格要求',steps:text.split('\n').filter(l=>/^\d+[.)、]\s*/.test(l)).map(l=>l.replace(/^\d+[.)、]\s*/,''))};
 }else throw new Error('支持 Markdown（.md）或 JSON 技能清单。');
 if(typeof data.name!=='string'||!data.name.trim()||typeof data.description!=='string'||!data.description.trim()||!Array.isArray(data.steps)||!data.steps.length||data.steps.some(s=>typeof s!=='string'||!s.trim()))throw new Error('技能需包含名称、用途说明和至少一个执行步骤。');
 return {id:`skill-${crypto.randomUUID()}`,name:data.name.trim().slice(0,60),description:data.description.trim().slice(0,500),input:typeof data.input==='string'?data.input.slice(0,500):'补充创作需求',steps:data.steps.slice(0,20).map(s=>s.slice(0,500)),category:typeof data.category==='string'?data.category:'我的技能',styleId:typeof data.styleId==='string'?data.styleId:'technology',previewType:'card',author:'纪鸣',version:typeof data.version==='string'?data.version:'1.0',personal:true};
}
