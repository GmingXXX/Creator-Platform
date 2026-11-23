import {assertAIWorkspaceWrite} from './workspace-ai-access';
import {aiRequest,AIRequestError} from './ai-client';
import {useStudio} from './store';
import type {Asset} from './types';
import {assetAvailableForAI} from './asset-access';

export interface VideoTask {id:string;workspaceId:string;status:'queued'|'running'|'succeeded'|'failed';url?:string;error?:string;retryable?:boolean;duration:number;size:string;model?:string}
export interface VideoGenerationOptions {workspaceId:string;styleId?:string;requestKey:string;reviewSlot?:string;referenceImage?:string;duration?:5|10|15;size?:string;onProgress?:(task:VideoTask)=>void}
const pause=(signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(new Error('已停止等待；视频任务仍保留，可重新查询。'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},4000);
 if(signal?.aborted)stop();else signal?.addEventListener('abort',stop,{once:true});
});
/** Reusing requestKey queries/resumes the same paid task. A new version must use a new key. */
export async function generateVideo(prompt:string,options:VideoGenerationOptions,signal?:AbortSignal):Promise<Asset>{
 assertAIWorkspaceWrite(options.workspaceId);
 if(!prompt.trim()||prompt.length>1500)throw new Error('视频描述与设计规范合计不能超过 1500 字，请缩短画面描述。');
 const body={prompt,workspaceId:options.workspaceId,idempotencyKey:options.requestKey,referenceImage:options.referenceImage,duration:options.duration||5,size:options.size||'1280*720'};
 let task:VideoTask|undefined;
 for(let attempt=0;attempt<450;attempt++){
  assertAIWorkspaceWrite(options.workspaceId);
  try{task=await aiRequest<VideoTask>(task?`videos/${task.id}`:'videos',task?undefined:body,signal);}catch(error){
   if(signal?.aborted||error instanceof AIRequestError&&error.status<500&&error.status!==429)throw error;
   // The POST is idempotent, including when the acknowledgement was lost.
   if(attempt>=3&&!task)throw error;
   await pause(signal);continue;
  }
  assertAIWorkspaceWrite(options.workspaceId);
  if(!/^[a-f\d]{32}$/.test(task.id)||task.workspaceId!==options.workspaceId||!['queued','running','succeeded','failed'].includes(task.status))throw new Error('视频任务返回信息无效');
  options.onProgress?.(task);
  assertAIWorkspaceWrite(options.workspaceId);
  if(task.status==='failed')throw new Error(task.error||'视频生成未完成，请检查任务记录');
  if(task.status==='succeeded'){
   if(task.url!==`/api/ai/video-media/${task.id}.mp4`)throw new Error('视频结果地址无效');
   const existing=useStudio.getState().assets.find(asset=>asset.id===`video-${task!.id}`);if(existing){if(existing.workspaceId!==options.workspaceId||!assetAvailableForAI(existing,options.workspaceId))throw new Error('已有视频素材当前不可使用，请检查素材权限');return existing;}
   const asset:Asset={id:`video-${task.id}`,workspaceId:options.workspaceId,name:`AI 视频 · ${prompt.slice(0,24)}`,kind:'video',src:task.url,preview:options.referenceImage||'',description:prompt,tags:['AI生成','视频'],author:'纪鸣',createdAt:new Date().toISOString(),source:'generated',metadata:{analysis:{status:'ready',summary:prompt,tags:['视频'],basis:'inherited'},business:{note:'AI生成的概念素材',subject:'',confirmed:false,usage:'reusable',allowAi:true}},package:{id:`package-video-${task.id}`,version:'1.0',prompt,skillIds:[],styleId:options.styleId||'',params:{model:task.model||'万相视频',taskId:task.id,requestKey:options.requestKey,reviewSlot:options.reviewSlot||options.requestKey,size:task.size,duration:String(task.duration)},files:[{name:'生成视频.mp4',type:'video',src:task.url}],complete:true}};
   useStudio.getState().addAsset(asset);return asset;
  }
  await pause(signal);
 }
 throw new Error('视频仍在生成，可使用相同请求重新查询，避免重复创建。');
}
