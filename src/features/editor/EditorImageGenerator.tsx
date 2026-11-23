import {useEffect,useRef,useState} from 'react';
import {ImagePlus,LoaderCircle,RefreshCw} from 'lucide-react';
import type {Asset,Work} from '../../domain/types';
import {aiRequest,AIRequestError} from '../../domain/ai-client';
import {useStudio} from '../../domain/store';
import {uid} from '../../domain/scenes';
import {visualGenerationPrompt} from '../../domain/visual-guidelines';
import {Button} from '../../components/ui';
import {editorImageAsset,editorImageSize,imageDraftStorageKey,readImageDraft,type EditorImageTask,type ImageDraft} from './editor-image-generation';

interface Props {work:Work;pageId:string;nodeId?:string;locked?:boolean;onApply:(asset:Asset)=>void}
/** A candidate stays in the library until the user applies it to this exact page or image. */
export function EditorImageGenerator({work,pageId,nodeId,locked,onApply}:Props){
 const key=imageDraftStorageKey(work.id,pageId,nodeId),initial=readImageDraft(key);
 const [draft,setDraft]=useState<ImageDraft|undefined>(initial);
 const [open,setOpen]=useState(Boolean(initial)),[prompt,setPrompt]=useState(initial?.prompt||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const assets=useStudio(state=>state.assets),asset=assets.find(a=>a.id===draft?.assetId&&!a.deletedAt&&!a.archived);
 const currentPage=work.pages.find(page=>page.id===pageId);
 const applied=!!asset&&(nodeId?currentPage?.nodes.find(node=>node.id===nodeId)?.assetId:currentPage?.backgroundAssetId)===asset.id;
 const latestDraft=useRef(initial);
 const alive=useRef(true),working=useRef(false),controller=useRef<AbortController|null>(null);
 const persist=(next:ImageDraft)=>{
  latestDraft.current=next;
  try{localStorage.setItem(key,JSON.stringify(next));}catch{if(alive.current)setError('浏览器无法保存任务记录，请保持本页打开直到生成完成。');}
  if(alive.current)setDraft(next);
 };
 const query=async(next:ImageDraft,signal:AbortSignal):Promise<void>=>{
  if(!next.taskId)return;
  const result=await aiRequest<EditorImageTask>(`images/${encodeURIComponent(next.taskId)}`,undefined,signal);
  if(signal.aborted)return;
  if(result.id!==next.taskId)throw new Error('任务返回的图片不匹配，请重新查询。');
  if(result.status==='failed'){
   persist({...next,status:'failed',retryable:!!result.retryable});throw new Error(result.error||'图片生成失败，可修改描述后重新生成。');
  }
  if(result.status==='succeeded'){
   const generated=editorImageAsset(result,next.prompt,work);
   const state=useStudio.getState();
   if(!state.assets.some(a=>a.id===generated.id))state.addAsset(generated);
   persist({...next,status:'succeeded',assetId:generated.id});return;
  }
  if(!['queued','pending','running'].includes(result.status))throw new Error('任务状态无效，请稍后重新查询。');
 };
 const monitor=async(next:ImageDraft,signal:AbortSignal)=>{
  // Stop polling after two minutes; querying later resumes the same durable server job.
  for(let attempt=0;attempt<60&&!signal.aborted;attempt++){
   await query(next,signal);
   if(latestDraft.current?.status!=='pending')return;
   await new Promise<void>(resolve=>{
    const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};
    const timer=setTimeout(done,2000);signal.addEventListener('abort',done,{once:true});
   });
  }
 };
 const run=async(create:boolean)=>{
  if(working.current||locked)return;
  const text=prompt.trim();if(create&&(!text||text.length>1500)){setError('请填写 1–1500 字的图片描述。');return;}
  working.current=true;setBusy(true);setError('');
  const abort=new AbortController();controller.current=abort;
  let next:ImageDraft|undefined=create?{requestId:uid('editor-image'),prompt:text,size:editorImageSize(work,currentPage?.nodes.find(node=>node.id===nodeId)),status:'pending'}:draft;
  if(!next){working.current=false;setBusy(false);return;}
  try{
   const resume=next.status==='failed'&&next.retryable;
   next={...next,status:'pending',retryable:false};persist(next);
   if(!next.taskId||resume){
    const result=await aiRequest<EditorImageTask>('images',{prompt:visualGenerationPrompt(next.prompt,useStudio.getState().systems.find(s=>s.id===work.styleId)),size:next.size,workspaceId:work.workspaceId||'personal',idempotencyKey:next.requestId},abort.signal);
    if(!/^[a-f\d]{32}$/.test(result.id))throw new Error('图片任务编号无效。');
    next={...next,taskId:result.id};persist(next);
   }
   await monitor(next,abort.signal);
  }catch(reason){
   if(!next.taskId&&reason instanceof AIRequestError&&[400,422].includes(reason.status))persist({...next,status:'failed',retryable:false});
   if(alive.current&&!abort.signal.aborted)setError(reason instanceof Error?reason.message:'生成未完成，请查询原任务。');
  }
  finally{working.current=false;if(alive.current)setBusy(false);}
 };
 useEffect(()=>{
  alive.current=true;
  return()=>{alive.current=false;controller.current?.abort();};
 },[]);
 return <div className="editor-image-generation">
  {!open?<Button size="sm" disabled={locked} onClick={()=>setOpen(true)}><ImagePlus size={14}/>{nodeId?'生成替换图片':'生成新背景'}</Button>:<>
   <label className="editor-image-label">{nodeId?'为当前图片组件生成候选':'为当前页面生成背景'}<textarea aria-label="图片生成描述" value={prompt} maxLength={1500} disabled={busy||draft?.status==='pending'||draft?.retryable} onChange={event=>setPrompt(event.target.value)} placeholder="描述画面、风格和需要留白的位置…" rows={3}/></label>
   <div className="editor-image-actions">
    {busy?<Button size="sm" onClick={()=>controller.current?.abort()}><LoaderCircle className="spinner" size={14}/>暂停查询</Button>:draft?.status==='pending'||draft?.retryable?<Button size="sm" onClick={()=>void run(false)}><RefreshCw size={14}/>{draft.retryable?'继续查询原任务':'查询生成任务'}</Button>:<Button size="sm" disabled={locked||!prompt.trim()} onClick={()=>void run(true)}><ImagePlus size={14}/>{draft?'重新生成候选':'生成候选图片'}</Button>}
   </div>
   {draft?.status==='pending'&&<p className="field-help">图片在后台生成，暂停查询不会取消任务，也不会重复提交。</p>}
   {error&&<p className="followup-error" role="alert">{error}</p>}
   {asset&&<div className="editor-image-candidate"><img src={asset.src} alt="生成的候选图片"/><p>{applied?'已应用，图片同时保存在素材库。':'已存入素材库，当前画面尚未替换。'}</p><Button size="sm" disabled={locked||applied} onClick={()=>onApply(asset)}>{applied?'已应用':nodeId?'应用到当前图片':'应用到当前背景'}</Button></div>}
   <p className="field-help">万相生成图片；确认应用后才替换素材，保留其他组件。</p>
  </>}
 </div>;
}
