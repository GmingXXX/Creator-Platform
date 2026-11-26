import {availableCommands} from './editor-capabilities';
import type { ContentItem, MotionConfig, NodeKind, SceneNode, Work } from '../../domain/types';
export interface History<T> { past:T[]; present:T; future:T[] }
export const createHistory=<T,>(present:T):History<T>=>({past:[],present,future:[]});
export function pushHistory<T>(h:History<T>,value:T):History<T>{if(value===h.present||JSON.stringify(value)===JSON.stringify(h.present))return h;return {past:[...h.past.slice(-59),h.present],present:value,future:[]}}
export function undoHistory<T>(h:History<T>):History<T>{if(!h.past.length)return h;return {past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future]}}
export function redoHistory<T>(h:History<T>):History<T>{if(!h.future.length)return h;return {past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)}}
export const uid=()=>crypto.randomUUID();
export function updatePageNodes(work:Work,pageId:string,ids:string[],patch:Partial<SceneNode>|((n:SceneNode)=>SceneNode)):Work{return {...work,pages:work.pages.map(p=>p.id===pageId?{...p,nodes:p.nodes.map(n=>ids.includes(n.id)?typeof patch==='function'?patch(n):{...n,...patch,...(n.type==='text'&&!n.customName&&patch.content!==undefined&&patch.name===undefined?{name:patch.content.trim().split(/\n/)[0]?.slice(0,32)||'文本'}:{})}:n)}:p)}}
export function alignPageSelection(work:Work,pageId:string,ids:string[],direction:'left'|'center'|'top'):Work {
 const page=work.pages.find(item=>item.id===pageId);
 const targets=page?.nodes.filter(node=>ids.includes(node.id)&&!node.locked)||[];
 if(!page||!targets.length)return work;
 const left=targets.length===1?0:Math.min(...targets.map(node=>node.x));
 const top=targets.length===1?0:Math.min(...targets.map(node=>node.y));
 const center=targets.length===1?work.width/2:(left+Math.max(...targets.map(node=>node.x+node.w)))/2;
 const nodes=page.nodes.map(node=>{
  if(node.locked||!ids.includes(node.id))return node;
  const x=direction==='left'?left:direction==='center'?center-node.w/2:node.x;
  const y=direction==='top'?top:node.y;
  return x===node.x&&y===node.y?node:{...node,x,y};
 });
 if(nodes.every((node,index)=>node===page.nodes[index]))return work;
 return {...work,pages:work.pages.map(item=>item.id===pageId?{...item,nodes}:item)};
}
export function resizeNode(n:SceneNode,direction:string,dx:number,dy:number):SceneNode{
 const theta=n.rotation*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta);
 const localX=dx*cos+dy*sin,localY=-dx*sin+dy*cos;let {w,h}=n;let offsetX=0,offsetY=0;
 if(direction.includes('e')){w=Math.max(24,w+localX);offsetX=(w-n.w)/2}
 if(direction.includes('s')){h=Math.max(24,h+localY);offsetY=(h-n.h)/2}
 if(direction.includes('w')){w=Math.max(24,w-localX);offsetX=(n.w-w)/2}
 if(direction.includes('n')){h=Math.max(24,h-localY);offsetY=(n.h-h)/2}
 const x=n.x+n.w/2+offsetX*cos-offsetY*sin-w/2;
 const y=n.y+n.h/2+offsetX*sin+offsetY*cos-h/2;
 return {...n,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)};
}
export function remapRule(rule:NonNullable<SceneNode['interactions']>[number],remap:(value:string)=>string){
 const id=(value?:string)=>value?remap(value):undefined;
 return {...rule,id:remap(rule.id),targetId:id(rule.targetId),additionalTargetIds:rule.additionalTargetIds?.map(remap),conditionId:id(rule.conditionId),watchedIds:rule.watchedIds?.map(remap),requiredVisitedIds:rule.requiredVisitedIds?.map(remap),steps:rule.steps?.map(s=>({...s,targetId:id(s.targetId),additionalTargetIds:s.additionalTargetIds?.map(remap)}))};
}
export function cloneSelectedNodes(nodes:SceneNode[],ids:string[],references:Record<string,string>={}):SceneNode[]{
 const selected=nodes.filter(n=>ids.includes(n.id)),map=new Map(Object.entries(references));
 for(const n of selected)for(const id of [n.id,...(n.items||[]).map(x=>x.id),...(n.interactions||[]).map(x=>x.id)])map.set(id,uid());
 const remap=(id:string)=>map.get(id)||id;
 return selected.map(n=>({...structuredClone(n),id:remap(n.id),name:n.name+' 副本',x:n.x+24,y:n.y+24,
 items:n.items?.map(item=>({...item,id:remap(item.id),parentId:item.parentId?remap(item.parentId):undefined})),
 interactions:n.interactions?.map(rule=>remapRule(rule,remap)),
 motion:n.motion?{...structuredClone(n.motion),sequences:n.motion.sequences?.map(seq=>({...structuredClone(seq),binding:seq.binding?remap(seq.binding):seq.binding, clips:seq.clips.map(c=>({...structuredClone(c),target:remap(c.target)}))}))}:undefined,
 commands:n.commands?.map(c=>({...c,id:c.id.startsWith(n.id+'-default-')?c.id.replace(n.id,remap(n.id)):uid(),targetId:c.targetId?remap(c.targetId):undefined}))}));
}
export const normalizeCommand=(s:string)=>s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export function matchCommands(work:Work,pageId:string,text:string){const input=normalizeCommand(text);if(!input)return [];const candidates=work.pages.flatMap(page=>page.nodes.flatMap(node=>availableCommands(node).filter(c=>c.enabled&&(c.scope==='global'||page.id===pageId)&&[c.phrase,...c.aliases.split(/[,，;；]/)].some(p=>normalizeCommand(p)===input)).map(command=>({node,command,pageId:page.id}))));const preferred=candidates.some(c=>c.command.scope==='page')?'page':'global';return candidates.filter(c=>c.command.scope===preferred)}
export function findCommand(work:Work,pageId:string,text:string){return matchCommands(work,pageId,text)[0]}
export function canSetParent(items:ContentItem[],id:string,parentId?:string){const visited=new Set([id]);let cursor=parentId;while(cursor){if(visited.has(cursor))return false;visited.add(cursor);cursor=items.find(i=>i.id===cursor)?.parentId}return true}
export function graphLayout(items:ContentItem[]){const depths=items.map(item=>{let depth=0;let current=item;const seen=new Set([item.id]);while(current.parentId){const parent=items.find(i=>i.id===current.parentId);if(!parent||seen.has(parent.id))break;seen.add(parent.id);depth++;current=parent}return {item,depth}});const maxDepth=Math.max(0,...depths.map(n=>n.depth));return depths.map(n=>{const row=depths.filter(m=>m.depth===n.depth);const index=row.findIndex(m=>m.item.id===n.item.id);return {...n,x:(index+.5)/row.length*100,y:((n.depth+.5)/(maxDepth+1))*100,width:Math.min(38,86/row.length),height:Math.min(38,78/(maxDepth+1))}})}
export function videoPageProgress(time:number,duration:number){if(!Number.isFinite(duration)||duration<=0)return 0;const p=Math.max(0,Math.min(1,time/duration));return p<.4?p/.4:p<.75?1:(1-p)/.25}
export const nodeLabels:Record<NodeKind,string>={text:'文本',image:'图片',video:'视频',audio:'音频',shape:'形状',card:'内容卡片',timeline:'时间轴',gallery:'照片墙',graph:'树状关系图',map:'热点地图',flow:'流程架构图',chart:'数据看板',bubble:'AI 语音气泡',button:'交互按钮',html:'HTML 交互程序'};
export function isMediaContainer(type:NodeKind):type is 'image'|'video'|'audio' {
 return type==='image'||type==='video'||type==='audio';
}
export function createNode(type:NodeKind,x=120,y=160):SceneNode{
 const composite=['timeline','gallery','graph','map','flow','chart'].includes(type);
 const small=type==='bubble'||type==='button';
 return {id:uid(),type,name:nodeLabels[type],x,y,w:composite?1400:small?360:type==='text'?580:480,h:composite?600:small?140:type==='text'?100:320,rotation:0,opacity:1,hidden:false,locked:false,content:type==='text'?'让创新，走进每一个现场':type==='button'?'探索更多':type==='bubble'?'有什么想了解的？':nodeLabels[type],color:'#f4f7ff',background:type==='text'||isMediaContainer(type)?'transparent':type==='shape'?'#1e5eff':'#ffffff12',fontSize:type==='text'?48:24,radius:12,columns:3,gap:24,items:composite||type==='card'?[{id:uid(),year:'1986',title:'创业启航',description:'从一份坚定的信念出发，开启跨越时代的创新旅程。',image:'/media/industrial.svg',value:36},{id:uid(),year:'2002',title:'创新突破',description:'构建自主研发体系，以技术创新推动高质量发展。',image:'/media/technology.svg',value:68},{id:uid(),year:'2024',title:'智造未来',description:'连接全球伙伴，探索绿色制造与数字化发展的新未来。',image:'/media/finance.svg',value:95}]:undefined};
}
export const motionPresets=['无动效','淡入','淡出','向上移入','向下移入','向左移入','向右移入','缩放进入','缩放退出','轻弹进入','旋转进入','模糊显现','强调脉冲','呼吸高亮','左右摇摆','页面推进','交叉淡化','翻页转场'];
export const defaultMotion:MotionConfig={preset:'淡入',duration:0.8,delay:0,easing:'ease-in-out',hold:false};

// Visual contrast belongs to the page, so clearing a design-system binding keeps its appearance.
export function sceneThemeForBackground(background:string):'light'|'dark' {
 const color=background.trim();
 const hex=color.match(/^#([\da-f]{3}|[\da-f]{6})(?:[\da-f]{2})?$/i)?.[1];
 const rgb=hex?(hex.length===3?hex.split('').map(value=>parseInt(value+value,16)):[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16))):color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)?.slice(1,4).map(Number);
 if(!rgb||rgb.some(value=>!Number.isFinite(value)||value<0||value>255))return 'dark';
 return (rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000>=150?'light':'dark';
}
