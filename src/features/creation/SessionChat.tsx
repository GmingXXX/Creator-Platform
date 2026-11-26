import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUp,Paperclip,Sparkles} from 'lucide-react';
import {useStudio} from '../../domain/store';
import {beginSession,retrySession,startRelatedOutput,continueQueuedAsset,patchSession,submitSessionReply,type CreationSession} from '../../domain/creation-session';
import {availableCreationPlugins} from '../../domain/creation-plugins';
import {importWorkspaceFile} from '../../domain/workspace-upload';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {captureKnowledgeTarget} from '../../domain/workspace-knowledge';
import {reviseWorkWithAI} from '../../domain/ai-revision';
import {toast} from '../../components/ui';
import type {Run} from '../../domain/types';
import './session-chat.css';

const draining=new Set<string>();
async function drainQueue(session:CreationSession,run:Run){
 const entry=session.queued?.[0];
 if(!entry||draining.has(session.id)||run.status!=='complete'||!run.workId)return;
 draining.add(session.id);
 try{
  if(startRelatedOutput(session.id,entry.text,entry.attachmentIds||[],true)){
   if(!useStudio.getState().creationSessions?.find(s=>s.id===session.id)?.error)patchSession(session.id,s=>({...s,queued:s.queued?.filter(m=>m.id!==entry.id)}));
   return;
  }
  const stillCurrent=()=>{
   const state=useStudio.getState(),record=state.creationSessions?.find(s=>s.id===session.id);
   if(!workspaceCanEdit(state,session.workspaceId)||record?.runId!==run.id||record.queued?.[0]?.id!==entry.id)throw new Error('会话已变化，补充要求尚未应用。');
  };
  stillCurrent();
  const result=run.model==='demo'?useStudio.getState().reviseWork(run.workId,entry.text,{scope:'work'},entry.attachmentIds||[]):await reviseWorkWithAI(run.workId,entry.text,{scope:'work'},entry.attachmentIds||[],undefined,stillCurrent,run.model);
  // Settle in the originating session even if the user has since navigated elsewhere.
  useStudio.setState(state=>({creationSessions:state.creationSessions?.map(s=>s.id===session.id&&s.runId===run.id?{...s,queued:s.queued?.filter(m=>m.id!==entry.id),messages:[...s.messages,{id:entry.id+'-result',role:'assistant' as const,text:result.summary}]}:s)}));
 }catch(error){if(useStudio.getState().activeWorkspaceId===session.workspaceId&&workspaceCanEdit(useStudio.getState(),session.workspaceId)&&useStudio.getState().creationSessions?.some(s=>s.id===session.id))patchSession(session.id,s=>({...s,error:error instanceof Error?error.message:'补充要求处理失败，请重试。'}));}
 finally{draining.delete(session.id);}
}
export function SessionHistory({session,choices}:{session:CreationSession;choices?:ReactNode}){
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[session.id,session.messages.length]);
 return <div className="session-history" aria-label="创作会话消息">{session.messages.map((m,index)=>m.role==='user'?<div key={m.id} className="user-message"><span className="avatar">纪</span><p>{m.text}</p></div>:<div key={m.id} className="session-answer"><Sparkles size={15}/><div className="session-answer-body"><p>{m.text}</p>{index===session.messages.length-1&&choices}</div></div>)}<div ref={end}/></div>;
}
export function SessionInput({session,run,reviewBusy=false,children}:{session:CreationSession;run?:Run;reviewBusy?:boolean;children?:(choices:ReactNode)=>ReactNode}){
 const [text,setText]=useState(()=>{try{return sessionStorage.getItem('zc-followup-'+session.id)||'';}catch{return '';}}),[busy,setBusy]=useState(false),[ids,setIds]=useState<string[]>([]);
 const picker=useRef<HTMLInputElement>(null),lock=useRef(false);
 const assets=useStudio(s=>s.assets);
 async function send(value:string){
  if(lock.current||!value.trim())return;lock.current=true;setBusy(true);
  try{await submitSessionReply(session.id,value.trim(),ids,reviewBusy);setText('');try{sessionStorage.removeItem('zc-followup-'+session.id);}catch{/* storage unavailable */}setIds([]);}
  catch(e){toast(e instanceof Error?e.message:'消息发送失败',true);}
  finally{setBusy(false);lock.current=false;}
 }
 const choices=availableCreationPlugins(session.workspaceId);
 const replies=session.prepared&&!run&&<div className="session-choices" role="group" aria-label="选择体验方式">{choices.map(c=><button key={c.id} disabled={busy} onClick={()=>void send({exhibit:'自由浏览，点击查看详情',presentation:'精选重点，限时讲解',story:'通过选择探索不同结局'}[c.id])}>{ {exhibit:'自由浏览',presentation:'自动讲解',story:'分支故事'}[c.id]}</button>)}</div>;
 return <>{children?.(replies)}<div className="session-footer">
 {session.error&&<p role="alert">{session.error} <button onClick={()=>retrySession(session.id)}>重试</button></p>}
 {!!session.queued?.length&&<small role="status">{session.queued.length} 条补充要求将在本轮生成结束后处理</small>}
 <form onSubmit={e=>{e.preventDefault();void send(text);}}>
 {!!ids.length&&<div>{ids.map(id=><button type="button" key={id} onClick={()=>setIds(prev=>prev.filter(x=>x!==id))}>{assets.find(a=>a.id===id)?.name} ×</button>)}</div>}
 <textarea aria-label="继续对话" placeholder="继续描述你的想法…" value={text} maxLength={8000} onChange={e=>{setText(e.target.value);try{sessionStorage.setItem('zc-followup-'+session.id,e.target.value)}catch{/* session storage unavailable */}}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(text);}}}/>
 <div className="session-tools"><button type="button" disabled={busy} aria-label="添加会话资料" onClick={()=>picker.current?.click()}><Paperclip size={16}/></button><button type="submit" aria-label="发送会话消息" disabled={busy||!text.trim()}><ArrowUp size={17}/></button></div></form>
 <input ref={picker} hidden type="file" multiple onChange={async e=>{const files=Array.from(e.target.files||[]);if(!files.length)return;lock.current=true;setBusy(true);try{for(const f of files){const a=await importWorkspaceFile(f,session.workspaceId,captureKnowledgeTarget(useStudio.getState(),session.workspaceId));useStudio.getState().addAsset(a);setIds(prev=>[...prev,a.id]);}}catch(err){toast(err instanceof Error?err.message:'上传失败',true);}finally{lock.current=false;setBusy(false);if(picker.current)picker.current.value='';}}}/>
 </div></>;
}
export function useSessionTasks(session?:CreationSession,run?:Run){
 useEffect(()=>{if(session&&!session.prepared&&!session.error)void beginSession(session.id);},[session?.id,session?.prepared,session?.error]);
 useEffect(()=>{if(session&&run&&!session.error){if(run.status==='complete'&&!run.workId)continueQueuedAsset(session.id,run);else void drainQueue(session,run);}},[session?.id,session?.queued,session?.error,run?.status,run?.workId]);
}
