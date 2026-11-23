import type {EditTarget, Work} from './types';
function fail():never{throw new Error('模型返回的节点修改超出范围或格式无效，作品未改变。')}
const text=(v:unknown,max=5000)=>typeof v==='string'&&v.length<=max?v:fail();
const only=(value:Record<string,unknown>,keys:string[])=>{if(!Object.keys(value).length||Object.keys(value).some(k=>!keys.includes(k)))fail()};
export function validateStudioTarget(work:Work,target:EditTarget):boolean{
 if(target.pageId!=='@story'&&target.pageId!=='@shots')return false;
 if(target.scope!=='node')fail();
 const exists=target.pageId==='@story'?work.kind==='story'&&work.storyNodes?.some(n=>n.id===target.nodeId):work.kind==='video'&&work.shots?.some(n=>n.id===target.nodeId);
 if(!exists)fail();return true;
}
export function applyStudioPatch(work:Work,target:EditTarget,kind:unknown,id:unknown,changes:Record<string,unknown>):Work|null{
 if(!['story-node','story-edge','shot'].includes(String(kind)))return null;
 const nodeId=text(id,120),scope=target.scope==='work';
 if(kind==='story-node'){
  if(work.kind!=='story'||(!scope&&(target.pageId!=='@story'||target.nodeId!==nodeId)))fail();
  const node=work.storyNodes?.find(n=>n.id===nodeId);if(!node)fail();only(changes,['title','text']);
  const next={...node,...(changes.title!==undefined?{title:text(changes.title,120)}:{}),...(changes.text!==undefined?{text:text(changes.text)}:{})};
  return {...work,storyNodes:work.storyNodes!.map(n=>n.id===nodeId?next:n)};
 }
 if(kind==='story-edge'){
  const edge=work.storyEdges?.find(e=>e.id===nodeId);
  if(work.kind!=='story'||!edge||(!scope&&(target.pageId!=='@story'||edge.source!==target.nodeId)))fail();
  only(changes,['label','target']);const destination=changes.target===undefined?edge.target:text(changes.target,120);
  if(destination===edge.source||!work.storyNodes?.some(n=>n.id===destination&&n.type!=='start'))fail();
  const next={...edge,target:destination,...(changes.label!==undefined?{label:text(changes.label,300)}:{})};
  return {...work,storyEdges:work.storyEdges!.map(e=>e.id===nodeId?next:e)};
 }
 if(work.kind!=='video'||(!scope&&(target.pageId!=='@shots'||target.nodeId!==nodeId)))fail();
 const shot=work.shots?.find(s=>s.id===nodeId);if(!shot)fail();only(changes,['title','narration','duration']);
 if(changes.duration!==undefined&&(typeof changes.duration!=='number'||!Number.isFinite(changes.duration)||changes.duration<1||changes.duration>1800))fail();
 return {...work,shots:work.shots!.map(s=>s.id===nodeId?{...s,...(changes.title!==undefined?{title:text(changes.title,120)}:{}),...(changes.narration!==undefined?{narration:text(changes.narration)}:{}),...(changes.duration!==undefined?{duration:changes.duration as number}:{})}:s)};
}
export function studioRevisionContext(work:Work,target:EditTarget){
 return {kind:work.kind,storyNodes:work.kind==='story'?work.storyNodes?.filter(n=>target.scope==='work'||target.pageId==='@story'&&n.id===target.nodeId).map(({id,type,title,text})=>({id,type,title,text})):undefined,
 storyEdges:work.kind==='story'?work.storyEdges?.filter(e=>target.scope==='work'||target.pageId==='@story'&&e.source===target.nodeId):undefined,
 storyDestinations:work.kind==='story'?work.storyNodes?.filter(n=>n.type!=='start').map(({id,title})=>({id,title})):undefined,
 shots:work.kind==='video'?work.shots?.filter(s=>target.scope==='work'||target.pageId==='@shots'&&s.id===target.nodeId).map(({id,title,narration,duration})=>({id,title,narration,duration})):undefined};
}
export const studioRevisionInstructions='智能演示可以用page补丁修改notes讲稿（纯文本，不超过10000字）。互动影片用{kind:"story-node",nodeId,changes:{title/text}}修改已有剧情；用{kind:"story-edge",nodeId:连线id,changes:{label/target}}修改已有选项，target必须为已有非开始节点且不能指向自身。@story范围只允许所选节点和其出边。视频分镜用{kind:"shot",nodeId,changes:{title/narration/duration}}，duration为1-1800秒，@shots范围只允许所选分镜。禁止修改素材URL、ID、坐标、创建或删除故事节点/连线；不能完成时返回空patches说明限制。';
