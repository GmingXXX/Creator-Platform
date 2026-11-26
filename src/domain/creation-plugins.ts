import {reviseScene} from './conversation';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {auditConfiguration} from './admin-management';
import {workspaceCanEdit,workspaceRole,type WorkspaceData} from './workspace-management';
import type {ComposerDraft,ExhibitType,Run,StudioData,Work} from './types';

export type CreationPluginId='exhibit'|'presentation'|'story';
interface CreationInput {draft:ComposerDraft;explicit:boolean;exhibitType:ExhibitType}
type Dispatch=Pick<Run,'status'|'step'|'outputKind'> & Partial<Pick<Run,'studioReview'|'aiPlan'>>;
function planExhibit({draft,explicit,exhibitType}:CreationInput):Dispatch {
 if(draft.model!=='demo'||!explicit)return {status:'running',step:0,outputKind:'exhibit'};
 return {status:'waiting',step:1,outputKind:'exhibit',aiPlan:{
  mode:'create',type:exhibitType,title:draft.text.trim().split(/[。！？\n]/)[0].slice(0,60)||'交互页面',
  answer:'已整理离线内容草稿，可以调整标题、条目和配图。',
  sections:[{title:'主题介绍',body:draft.text.slice(0,350)},{title:'重点内容',body:'请填入希望观众了解的主要内容。'},{title:'延伸阅读',body:'请补充可浏览的案例或细节。'}]
 }};
}
function reviewStudio(outputKind:'presentation'|'story',input:CreationInput):Dispatch {
 if(!input.explicit)return {status:'running',step:0,outputKind};
 return {status:'waiting',step:1,outputKind,studioReview:true};
}
function acceptResult(id:CreationPluginId,run:Run,work:Work):Partial<Run>{
 if(run.outputKind!==id||work.kind!==id||(run.workspaceId||'personal')!==(work.workspaceId||'personal'))throw new Error('生成结果的项目类型或空间与任务不符。');
 return {status:'complete',step:5,workId:work.id,error:undefined};
}
interface CreationPlugin {startCreation:(input:CreationInput)=>Dispatch;completeCreation:(run:Run,work:Work)=>Partial<Run>;revise:typeof reviseScene;id:CreationPluginId;name:string;route:string;description:string;capabilities:string;services:string[];version:string}
export const creationPlugins:readonly CreationPlugin[]=[
 {id:'exhibit',revise:reviseScene,completeCreation:(run,work)=>acceptResult('exhibit',run,work),startCreation:planExhibit,name:'交互页面',route:'/editor',description:'制作可点击、浏览与探索的展示内容',capabilities:'页面、组件与交互',services:['文本','图片'],version:'1.0'},
 {id:'presentation',revise:reviseScene,completeCreation:(run,work)=>acceptResult('presentation',run,work),startCreation:input=>reviewStudio('presentation',input),name:'智能演示',route:'/presentations',description:'把资料变成会演示、会讲解、能问答的动态幻灯片',capabilities:'动态播放、自主讲解与智能问答',services:['文本','图片','语音'],version:'1.0'},
 {id:'story',revise:reviseScene,completeCreation:(run,work)=>acceptResult('story',run,work),startCreation:input=>reviewStudio('story',input),name:'互动影片',route:'/dream',description:'让观众参与选择，探索故事的不同结局',capabilities:'场景、节点与分支',services:['文本','图片','视频'],version:'1.0'},
];
export const registeredPlugin=(kind:string)=>creationPlugins.find(plugin=>plugin.id===kind);
type Flags=Partial<Record<CreationPluginId,boolean>>;
export const textModels=[{id:'deepseek-flash',label:'DeepSeek Flash'},{id:'deepseek-v4-pro',label:'DeepSeek Pro'},{id:'demo',label:'离线演示'}] as const;
interface Config {platform:Flags;spaces:Record<string,Flags>;defaultModel:string;allowedSpaces:Partial<Record<CreationPluginId,string[]>>;dailyTaskLimit:number}
export const useCreationConfig=create<Config>()(persist(()=>({platform:{},spaces:{},allowedSpaces:{},dailyTaskLimit:0,defaultModel:'deepseek-flash'}),{name:'zc-creation-plugins-v1'}));
export function availableCreationPlugins(workspaceId:string,config=useCreationConfig.getState()){
 return creationPlugins.filter(plugin=>platformOffersPlugin(plugin.id,workspaceId,config)&&config.spaces[workspaceId]?.[plugin.id]!==false);
}
export function pluginEditorPath(id:CreationPluginId,workId:string){
 const plugin=registeredPlugin(id);
 if(!plugin)throw new Error('创作插件不存在');
 return plugin.route+'/'+encodeURIComponent(workId);
}
export function pluginDeniedReason(kind:string,workspaceId:string){
 const plugin=registeredPlugin(kind);
 if(plugin&&!availableCreationPlugins(workspaceId).some(item=>item.id===plugin.id))return '当前空间未启用「'+plugin.name+'」，请联系负责人。';
}
export function setPlatformPlugin(role:StudioData['role'],id:CreationPluginId,enabled:boolean){
 const plugin=registeredPlugin(id);
 if(!plugin||typeof enabled!=='boolean')throw new Error('插件配置无效');
 auditConfiguration(role,'plugins',enabled?'启用插件':'停用插件',plugin.name);
 useCreationConfig.setState(state=>({platform:{...state.platform,[id]:enabled}}));
}
export function setSpacePlugin(state:WorkspaceData,workspaceId:string,id:CreationPluginId,enabled:boolean){
 if(workspaceRole(state,workspaceId)!=='owner'||!workspaceCanEdit(state,workspaceId))throw new Error('仅空间负责人可修改使用中的空间配置。');
 if(!registeredPlugin(id)||typeof enabled!=='boolean')throw new Error('插件配置无效');
 if(enabled&&!platformOffersPlugin(id,workspaceId))throw new Error('平台尚未开放此插件');
 useCreationConfig.setState(config=>({spaces:{...config.spaces,[workspaceId]:{...config.spaces[workspaceId],[id]:enabled}}}));
}
export function setDefaultCreationModel(role:StudioData['role'],model:string){
 const item=textModels.find(entry=>entry.id===model);
 if(!item)throw new Error('模型无效');
 auditConfiguration(role,'models','设置默认创作模型',item.label);
 useCreationConfig.setState({defaultModel:model});
}

export function platformOffersPlugin(id:CreationPluginId,workspaceId:string,config=useCreationConfig.getState()){
 const allowed=config.allowedSpaces[id];
 return config.platform[id]!==false&&(!allowed||allowed.includes(workspaceId));
}
export function setPluginScope(role:StudioData['role'],id:CreationPluginId,workspaceIds:string[]|undefined,workspaces:WorkspaceData['workspaces']){
 const plugin=registeredPlugin(id);
 if(!plugin||workspaceIds?.some(id=>!workspaces.some(space=>space.id===id&&!space.deletedAt)))throw new Error('授权空间无效');
 auditConfiguration(role,'plugins','修改插件开放空间',plugin.name);
 useCreationConfig.setState(state=>({allowedSpaces:{...state.allowedSpaces,[id]:workspaceIds?[...new Set(workspaceIds)]:undefined}}));
}
export function setDailyTaskLimit(role:StudioData['role'],limit:number){
 if(!Number.isInteger(limit)||limit<0||limit>10000)throw new Error('请输入 0 至 10000 之间的整数，0 表示不限。');
 auditConfiguration(role,'models','调整空间每日 Agent 任务上限',limit?String(limit):'不限');
 useCreationConfig.setState({dailyTaskLimit:limit});
}
export function taskLimitReached(runs:Run[],workspaceId:string,date=new Date()){
 const limit=useCreationConfig.getState().dailyTaskLimit;
 return limit>0&&runs.filter(run=>(run.workspaceId||'personal')===workspaceId&&new Date(run.createdAt).toDateString()===date.toDateString()).length>=limit;
}
