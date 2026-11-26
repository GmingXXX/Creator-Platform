import {assertAIWorkspaceWrite} from '../../domain/workspace-ai-access';
import type {Asset} from '../../domain/types';
import {aiRequest,AIRequestError} from '../../domain/ai-client';
import {assetAvailableForAI} from '../../domain/asset-access';
import {useStudio} from '../../domain/store';
import {editorImageAsset,type EditorImageTask,type ImageDraft,readImageDraft} from '../editor/editor-image-generation';
import {materialRequestId} from './material-review-logic';
/** Each content slot owns a durable request. A retry resumes the same provider task. */
export async function generateReviewImage(input:{prompt:string;workspaceId:string;styleId?:string;requestKey:string;size?:string;newVersion?:boolean;signal?:AbortSignal}):Promise<Asset>{
 assertAIWorkspaceWrite(input.workspaceId);
 if(!input.prompt.trim()||input.prompt.length>2000)throw new Error('画面描述需控制在 1–2000 字，请缩短后重试');
 const key=`zc-review-material:${input.workspaceId}:${input.requestKey}`;
 let draft=readImageDraft(key);
 const persist=(next:ImageDraft)=>{assertAIWorkspaceWrite(input.workspaceId);draft=next;localStorage.setItem(key,JSON.stringify(next));};
 if(!draft||input.newVersion||draft.status==='succeeded'&&draft.prompt!==input.prompt||draft.status==='failed'&&!draft.retryable){draft={requestId:materialRequestId(`${input.workspaceId}:${input.requestKey}`,Date.now()),prompt:input.prompt,size:input.size||'1696*960',status:'pending'};persist(draft);}
 if(draft.status==='succeeded'){
  const existing=useStudio.getState().assets.find(asset=>asset.id===draft!.assetId&&asset.workspaceId===input.workspaceId&&assetAvailableForAI(asset,input.workspaceId));if(existing)return existing;throw new Error('原生成素材已不可用，请选择生成新版本');
 }
 if(!draft.taskId||draft.retryable){
  let task:EditorImageTask;try{task=await aiRequest<EditorImageTask>('images',{prompt:draft.prompt,size:draft.size,workspaceId:input.workspaceId,idempotencyKey:draft.requestId},input.signal);}catch(error){if(error instanceof AIRequestError&&[400,422].includes(error.status))persist({...draft,status:'failed',retryable:false});throw error;}
  if(!/^[a-f\d]{32}$/.test(task.id))throw new Error('素材任务编号无效，请重试');
  persist({...draft,taskId:task.id,status:'pending',retryable:false});
 }
 for(let i=0;i<90;i++){
  assertAIWorkspaceWrite(input.workspaceId);
  if(input.signal?.aborted)throw new Error('已暂停查询，重新生成作品会继续查询原素材任务');
  const task=await aiRequest<EditorImageTask>(`images/${draft.taskId}`,undefined,input.signal);
  assertAIWorkspaceWrite(input.workspaceId);
  if(task.id!==draft.taskId)throw new Error('素材任务不匹配');
  if(task.status==='succeeded'){
   const asset=editorImageAsset(task,draft.prompt,{workspaceId:input.workspaceId,styleId:input.styleId||''});
   const tagged={...asset,package:asset.package?{...asset.package,params:{...asset.package.params,reviewSlot:input.requestKey}}:undefined};
   if(!useStudio.getState().assets.some(item=>item.id===asset.id))useStudio.getState().addAsset(tagged);
   persist({...draft,status:'succeeded',assetId:asset.id});return tagged;
  }
  if(task.status==='failed'){persist({...draft,status:'failed',retryable:task.retryable});throw new Error(task.error||'素材生成失败，请重试');}
  if(!['pending','queued','running'].includes(task.status))throw new Error('素材任务状态无效，请稍后重试');
  await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);input.signal?.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,2000);input.signal?.addEventListener('abort',done,{once:true});});
 }
 throw new Error('素材仍在后台生成，稍后点击继续，将恢复原任务');
}
