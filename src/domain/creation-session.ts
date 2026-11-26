import {isWorkBackgroundRequest,tryWorkBackgroundRequest} from './work-background-request';
import {beginWorkBackground} from './background-generation';
import {aiChat} from './ai-client';
import {useStudio} from './store';
import {createDraft} from './fixtures';
import {uid} from './scenes';
import {resolveIntent} from './logic';
import {interpretExhibitAnswer} from './intent-clarification';
import {workspaceCanEdit} from './workspace-management';
import {prepareDemoKnowledge} from './demo-knowledge';
import type {ComposerDraft, Run} from './types';

export interface SessionMessage {
 id:string; role:'user'|'assistant'; text:string; attachmentIds?:string[];
}
export interface CreationSession {
 id:string; workspaceId:string; draft:ComposerDraft; messages:SessionMessage[];
 retryKind?:Run['outputKind']; lastKind?:Run['outputKind']; runId?:string; priorRunIds?:string[]; prepared?:boolean; error?:string; queued?:SessionMessage[];
}
const question='你希望观众自己浏览、跟随讲解，还是通过选择改变故事走向？';
const message=(role:SessionMessage['role'],text:string,attachmentIds?:string[]):SessionMessage=>({id:uid('message'),role,text,attachmentIds});

export function classifyRequest(raw:string):Run['outputKind']|undefined{
 const text=raw.replace(/(?:不要|不想|不需要|不用|不做)[^，。；\n]*/g,'');
 if(/(?:另外|另|独立|单独)[^，。]{0,36}(?:背景图|背景素材|壁纸|底图)/.test(text))return 'image';
 if(/(?:先|单独|只)(?:帮我|为.{0,12})?(?:做|生成|制作|画).{0,10}(?:图片|海报|封面)/.test(text))return 'image';
 if(/(?:把|用|根据|依据).{0,20}(?:PPT|幻灯片|图片|视频).{0,15}(?:做成|制作|生成|转成)(?:一[个部份张])?(?:互动影片|交互页面|智能演示)/i.test(text)){
  const target=text.match(/(?:做成|制作|生成|转成)(?:一[个部份张])?(互动影片|交互页面|智能演示)/);
  if(target)return target[1]==='互动影片'?'story':target[1]==='交互页面'?'exhibit':'presentation';
 }
 if(/(?:画|生成|制作|设计).{0,18}(?:照片|插画|背景图|海报)/.test(text)&&!/互动影片|交互页面|智能演示/.test(text))return 'image';
 if(/互动影片|互动故事|分支故事|故事分支|分支剧情|不同结局|改变.{0,10}(剧情|故事|结局)/.test(text))return 'story';
 if(/智能演示|幻灯片|自动(?:播放并?)?讲|分钟.{0,6}(?:自动)?讲解|限时讲解/.test(text))return 'presentation';
 if(/交互页面|交互界面|点击.{0,10}详情|按.{0,8}筛选|时间轴|鱼骨图|自由浏览/.test(text))return 'exhibit';
 if(/(?:依据|根据|参考|上传).{0,10}(?:ppt|演示文稿|图片|视频).{0,16}(?:展项|展厅展示)/i.test(text))return;
 const choice=interpretExhibitAnswer(text);
 if(choice)return {browse:'exhibit',present:'presentation',story:'story'}[choice] as Run['outputKind'];
 if(/(?:上传|依据|参考|根据).{0,12}PPT/i.test(text)&&/展项/.test(text))return;
 if(/组件|控件|海报|图片|封面|视频|短片|分镜|HTML|PPT|讲稿|图谱|关系图|架构图|地图|数据看板/i.test(text)){
  if(/封面/.test(text)&&!/视频|展项|ppt/i.test(text))return 'image';
  return resolveIntent(text).outputKind;
 }
 return undefined;
}
async function interpretReply(s:CreationSession,value:string):Promise<Run['outputKind']|undefined>{
 const local=classifyRequest(value);
 if(local||s.draft.model==='demo')return local;
 const reply=await aiChat(s.draft.model,[{role:'system',content:'根据用户对观众体验的描述，判断应调用的创作能力。自由探索和筛选为exhibit，顺序讲解为presentation，选择改变情节为story，仅生成图片为image。仅返回JSON对象 {"kind":"exhibit|presentation|story|image|unclear"}。无法判定时选unclear，展厅位置或受众本身不足以选型。'},{role:'user',content:s.messages.filter(m=>m.role==='user').map(m=>m.text).join('\n')}]);
 const parsed=JSON.parse(reply.content.replace(/^```(?:json)?\s*|\s*```$/g,'')) as {kind?:string};
 return ['exhibit','presentation','story','image'].includes(parsed.kind||'')?parsed.kind as Run['outputKind']:undefined;
}
function currentSession(id:string){
 const state=useStudio.getState(),session=state.creationSessions?.find(s=>s.id===id);
 if(!session||!workspaceCanEdit(state,session.workspaceId)||state.activeWorkspaceId!==session.workspaceId)throw new Error('请回到原空间后继续会话。');
 return session;
}
export function deleteCreationSession(id:string){
 const session=currentSession(id);
 if(typeof sessionStorage!=='undefined')sessionStorage.removeItem('zc-followup-'+session.id);
 useStudio.setState(state=>({creationSessions:state.creationSessions?.filter(chat=>chat.id!==session.id)}));
}

export function patchSession(id:string,edit:(s:CreationSession)=>CreationSession){
 currentSession(id);
 useStudio.setState(state=>({creationSessions:state.creationSessions?.map(s=>s.id===id?edit(s):s)}));
}
export function startSession(draftId:string){
 const state=useStudio.getState(),draft=state.drafts.find(d=>d.id===draftId);
 if(!draft?.text.trim()||draft.id!==state.activeDraftId||!workspaceCanEdit(state,draft.workspaceId||'personal'))throw new Error('当前草稿无法发送。');
 const session:CreationSession={id:uid('chat'),workspaceId:draft.workspaceId||'personal',draft:structuredClone(draft),messages:[message('user',draft.text,draft.attachmentIds)]};
 const next=createDraft({workspaceId:session.workspaceId,model:draft.model});
 useStudio.setState({creationSessions:[session,...state.creationSessions||[]],drafts:[next,...state.drafts.filter(d=>d.id!==draftId)],activeDraftId:next.id});
 return session;
}
const preparing=new Map<string,Promise<void>>();
export function beginSession(id:string):Promise<void>{
 if(preparing.has(id))return preparing.get(id)!;
 const s=currentSession(id);
 if(s.prepared||s.runId)return Promise.resolve();
 const promise=prepareDemoKnowledge(s.draft.id).then(async()=>{
  const fresh=currentSession(id);
  let kind=fresh.lastKind||classifyRequest(fresh.draft.text);
  // An explicitly vague brief needs a visitor-experience question. Other phrasing
  // can still identify a format through the configured model.
  if(!kind&&fresh.draft.model!=='demo'&&!/可演示的展项|做(?:个|一个).{0,12}展项/.test(fresh.draft.text)){
   try{kind=await interpretReply(fresh,fresh.draft.text);}catch{kind=undefined;}
  }
  if(currentSession(id).runId)return;
  patchSession(id,item=>({...item,prepared:true,error:undefined}));
  if(kind)dispatchSession(id,kind);else patchSession(id,item=>({...item,messages:[...item.messages,message('assistant',question)]}));
 }).catch(e=>{if(useStudio.getState().activeWorkspaceId===s.workspaceId&&workspaceCanEdit(useStudio.getState(),s.workspaceId)&&useStudio.getState().creationSessions?.some(c=>c.id===id))patchSession(id,item=>({...item,error:e instanceof Error?e.message:'读取资料失败'}));}).finally(()=>preparing.delete(id));
 preparing.set(id,promise);return promise;
}
function dispatchSession(id:string,kind:Run['outputKind']){
 const s=currentSession(id);
 const turns=s.messages.filter(m=>m.role==='user'),latest=turns.at(-1);
 const independent=kind==='image'&&latest&&/与.{0,12}无关|不沿用.{0,12}(?:当前|之前|原有)|不参考.{0,12}(?:展项|作品)/.test(latest.text);
 const text=independent?latest.text:turns.map(m=>m.text).join('\n\n');
 const plugin=['exhibit','presentation','story'].includes(kind)?kind as 'exhibit'|'presentation'|'story':undefined;
 const assetKind=kind==='image'||kind==='video'||kind==='component'||kind==='html'?kind:undefined;
 const prior=useStudio.getState().runs.find(r=>r.id===s.runId);
 const draft=independent?createDraft({workspaceId:s.workspaceId,model:s.draft.model}):s.draft;
 const attachments=independent?(latest.attachmentIds||[]):[...new Set([...s.draft.attachmentIds,...(prior?.assetId?[prior.assetId]:[])])];
 const run=useStudio.getState().startRun(plugin,{...draft,text,attachmentIds:attachments},assetKind);
 if(!run){const error=useStudio.getState().creationError||'当前创作能力不可用';patchSession(id,item=>({...item,error,retryKind:kind}));return;}
 patchSession(id,item=>({...item,priorRunIds:item.runId?[...item.priorRunIds||[],item.runId]:item.priorRunIds,runId:run.id,lastKind:kind,retryKind:undefined,error:undefined}));
}
export async function submitSessionReply(id:string,text:string,attachments:string[]=[],reviewBusy=false){
 const s=currentSession(id),value=text.trim();if(!value)return;
 const entry=message('user',value,attachments);
 patchSession(id,item=>({...item,error:undefined,draft:{...item.draft,attachmentIds:[...new Set([...item.draft.attachmentIds,...attachments])]},messages:[...item.messages,entry]}));
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===s.runId);
 if(run?.status==='waiting'&&!reviewBusy&&!(run.outputKind==='exhibit'&&isWorkBackgroundRequest(value))){
  // Keep the reviewed draft until the replacement task was successfully created.
  dispatchSession(id,classifyRequest(value)||run.outputKind);
  if(currentSession(id).runId!==run.id)state.updateRun(run.id,{status:'stopped'});
  return;
 }
 if(run?.status==='complete'&&!run.workId){
  dispatchSession(id,classifyRequest(value)||run.outputKind);return;
 }
 if(run&&['stopped','failed'].includes(run.status)){
  dispatchSession(id,classifyRequest(value)||run.outputKind);return;
 }
 if(s.runId){patchSession(id,item=>({...item,queued:[...item.queued||[],entry]}));return;}
 if(!s.prepared)await beginSession(id);
 if(!currentSession(id).prepared)return;
 if(currentSession(id).runId)return;
 const kind=await interpretReply(currentSession(id),value);
 const latest=currentSession(id);
 if(latest.runId||latest.messages.filter(m=>m.role==='user').at(-1)?.id!==entry.id)return;
 if(kind)dispatchSession(id,kind);
 else patchSession(id,item=>({...item,messages:[...item.messages,message('assistant','已记下这项要求。请选择观众的体验方式，或继续描述他们会在屏幕上做什么。')]}));
}

export function continueQueuedAsset(id:string,run:Run){
 const session=currentSession(id),entry=session.queued?.[0];
 if(!entry||run.id!==session.runId||run.status!=='complete'||run.workId)return;
 dispatchSession(id,classifyRequest(entry.text)||run.outputKind);
 if(currentSession(id).runId!==run.id)patchSession(id,s=>({...s,queued:s.queued?.filter(m=>m.id!==entry.id)}));
}

export function requestedNewOutput(value:string,previous:Run['outputKind']){
 const kind=classifyRequest(value);
 if(!kind||!/生成|制作|做成|做个|做一[个张幅]|改(?:做|成)|转(?:换)?成|另做|换成/.test(value))return;
 return kind!==previous||/另做|单独|再做一个/.test(value)?kind:undefined;
}
export function startRelatedOutput(id:string,text:string,ids:string[],alreadyRecorded=false,pageId?:string,model?:string){
 const session=currentSession(id),state=useStudio.getState();
 const run=state.runs.find(r=>r.id===session.runId);
 if(!run)return false;
 const work=state.works.find(w=>w.id===run.workId&&!w.deletedAt);
 const page=work&&tryWorkBackgroundRequest(run,work,text,pageId);
 const kind=page?undefined:requestedNewOutput(text,run.outputKind);
 if(!page&&!kind)return false;
 if(page)beginWorkBackground(run.id,text,page.id,ids,model);
 patchSession(id,item=>({...item,
  messages:[...item.messages,...(alreadyRecorded?[]:[message('user',text,ids)]),
   ...(page&&work?[message('assistant',`将为《${work.title}》的「${page.name}」生成背景。你可以在完整页面里比较效果，再决定是否采用。`)]:[])],
  draft:{...item.draft,attachmentIds:[...new Set([...item.draft.attachmentIds,...ids])]},
 }));
 if(kind)dispatchSession(id,kind);
 return true;
}

export function retrySession(id:string){
 const session=currentSession(id);
 if(session.retryKind){
  dispatchSession(id,session.retryKind);
  if(session.runId&&currentSession(id).runId!==session.runId){
   const old=useStudio.getState().runs.find(r=>r.id===session.runId);
   if(old?.status==='waiting')useStudio.getState().updateRun(old.id,{status:'stopped'});
   if(session.queued?.length)patchSession(id,s=>({...s,queued:s.queued?.slice(1)}));
  }
 }else patchSession(id,s=>({...s,error:undefined}));
}
