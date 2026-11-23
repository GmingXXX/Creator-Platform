import type {EditTarget,Work} from './types';
export interface ExperienceScopeOption {key:string;label:string;target:EditTarget}
/** Resolve only the recorded target; never substitute today's active selection. */
export function experienceScopeLabel(target:EditTarget,work?:Work):string {
 if(target.scope==='work')return '整个作品';
 if(target.pageId==='@story')return `故事节点 · ${work?.storyNodes?.find(node=>node.id===target.nodeId)?.title||target.nodeId||'未记录名称'}`;
 if(target.pageId==='@shots')return `分镜 · ${work?.shots?.find(shot=>shot.id===target.nodeId)?.title||target.nodeId||'未记录名称'}`;
 const page=work?.pages.find(item=>item.id===target.pageId);
 if(target.scope==='page')return `页面 · ${page?.name||target.pageId||'未记录名称'}`;
 return `组件 · ${page?.nodes.find(node=>node.id===target.nodeId)?.name||target.nodeId||'未记录名称'}${page?`（${page.name}）`:''}`;
}
export function experienceScopeOptions(work:Work,target:EditTarget):ExperienceScopeOption[] {
 const whole:ExperienceScopeOption={key:'work',label:'整个作品',target:{scope:'work'}};
 if(target.scope==='work')return [whole];
 if(target.pageId==='@story'||target.pageId==='@shots'){
  const item=target.pageId==='@story'?work.storyNodes?.find(node=>node.id===target.nodeId):work.shots?.find(shot=>shot.id===target.nodeId);
  return item?[whole,{key:'node',label:`当前${target.pageId==='@story'?'节点':'分镜'} · ${item.title}`,target:{...target}}]:[whole];
 }
 const page=work.pages.find(item=>item.id===target.pageId);if(!page)return [whole];
 const pageOption:ExperienceScopeOption={key:'page',label:`当前页面 · ${page.name}`,target:{scope:'page',pageId:page.id}};
 const node=target.scope==='node'?page.nodes.find(item=>item.id===target.nodeId):undefined;
 return node?[whole,pageOption,{key:'node',label:`选中组件 · ${node.name}`,target:{...target}}]:[whole,pageOption];
}
