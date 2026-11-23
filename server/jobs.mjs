import {mkdir,readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {ApiError} from './config.mjs';
const canRetry=error=>!(error instanceof ApiError)||error.status===408||error.status===429||error.status>=500;
const hash=value=>createHash('sha256').update(value).digest('hex');
export class ImageJobs {
 constructor(dir,providers,{schedule=true,pollMs=4000}={}){this.dir=dir;this.providers=providers;this.schedule=schedule;this.pollMs=pollMs;this.tasks=new Map();this.creation=new Map();this.processing=new Set();this.timers=new Map();}
 async init(){
  await mkdir(join(this.dir,'tasks'),{recursive:true,mode:0o700});await mkdir(join(this.dir,'media'),{recursive:true,mode:0o700});
  for(const file of await readdir(join(this.dir,'tasks'))){if(!/^[a-f\d]{32}\.json$/.test(file))continue;let task;try{task=JSON.parse(await readFile(join(this.dir,'tasks',file),'utf8'));}catch{continue;}
   if(!task?.id||!task.input)continue;this.tasks.set(task.id,task);
   if(task.status==='running'&&!task.providerId)await this.save({...task,status:'failed',error:'上次提交中断，无法确认是否已计费。请检查账户记录后再发起新任务。'});
   else if(['queued','running'].includes(task.status))this.later(task.id);
  }
 }
 public(task){return {id:task.id,status:task.status,retryable:Boolean(task.retryable),workspaceId:task.input.workspaceId,prompt:task.input.prompt,size:task.actualSize||task.input.size,url:task.status==='succeeded'?`/api/ai/media/${task.id}.png`:undefined,error:task.error,createdAt:task.createdAt,updatedAt:task.updatedAt};}
 async save(task){const next={...task,updatedAt:new Date().toISOString()};const temp=join(this.dir,'tasks',`${task.id}.${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,join(this.dir,'tasks',`${task.id}.json`));this.tasks.set(next.id,next);return next;}
 async create(input){
  const id=hash(`${input.workspaceId}:${input.idempotencyKey}`).slice(0,32),fingerprint=hash(JSON.stringify(input));
  if(this.creation.has(id)){await this.creation.get(id);return this.create(input);}
  const existing=this.tasks.get(id);if(existing){
   if(existing.fingerprint!==fingerprint)throw new ApiError('重复任务标识对应不同内容，请发起新的任务',409);
   if(existing.status!=='failed'||!existing.retryable||!existing.providerId)return this.public(existing);
   // Resume only the durable paid task. Never put it back into the submit queue.
   const resuming=this.save({...existing,status:'running',retryable:false,error:undefined,pollErrors:0,queryStartedAt:new Date().toISOString()});this.creation.set(id,resuming);
   try{const task=await resuming;this.later(id,0);return this.public(task);}finally{this.creation.delete(id);}
  }
  const saving=this.save({id,fingerprint,input,status:'queued',createdAt:new Date().toISOString(),pollErrors:0});this.creation.set(id,saving);
  try{const task=await saving;this.later(id,0);return this.public(task);}finally{this.creation.delete(id);}
 }
 async get(id){const task=this.tasks.get(id);if(!task)throw new ApiError('未找到图片任务',404);return this.public(task);}
 later(id,delay=this.pollMs){if(!this.schedule||this.timers.has(id))return;const timer=setTimeout(()=>{this.timers.delete(id);void this.process(id).catch(()=>{});},delay);timer.unref?.();this.timers.set(id,timer);}
 close(){for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();}
 async process(id){
  if(this.processing.has(id))return;let task=this.tasks.get(id);if(!task||!['queued','running'].includes(task.status))return;this.processing.add(id);
  try{
   if(task.status==='queued'){
    task=await this.save({...task,status:'running'});
    const submitted=await this.providers.submitImage(task.input);
    task=await this.save({...task,providerId:submitted.taskId,actualSize:submitted.size});
   }
   if(Date.now()-Date.parse(task.queryStartedAt||task.createdAt)>20*60*1000){await this.save({...task,status:'failed',retryable:true,error:'图片任务等待超时，可重新查询已有任务，不会再次提交生成'});return;}
   const result=await this.providers.pollImage(task.providerId);
   if(result.status==='SUCCEEDED'){
    if(!result.url){await this.save({...task,status:'failed',retryable:false,error:'图片任务完成但没有可保存结果'});return;}
    const bytes=await this.providers.downloadImage(result.url);await writeFile(join(this.dir,'media',`${id}.png`),bytes,{mode:0o600});await this.save({...task,status:'succeeded',retryable:false,error:undefined,pollErrors:0});
   }else if(['FAILED','CANCELED','UNKNOWN'].includes(result.status))await this.save({...task,status:'failed',retryable:false,error:'图片生成未完成，请调整描述或检查模型额度后重新发起'});
   else{await this.save({...task,status:'running',retryable:false,error:undefined,pollErrors:0});this.later(id);}
  }catch(error){
   // A request without a durable provider ID must never be automatically resubmitted.
   const retryable=Boolean(task.providerId)&&canRetry(error);
   if(retryable&&(task.pollErrors||0)<2){const pollErrors=(task.pollErrors||0)+1;await this.save({...task,status:'running',retryable:false,error:undefined,pollErrors});this.later(id,this.pollMs*2**pollErrors);}
   else await this.save({...task,status:'failed',retryable,error:retryable?'已有图片任务暂时无法查询或保存，可重新查询，不会再次提交生成':error instanceof ApiError?error.message:task.providerId?'图片任务查询失败，请稍后检查供应商任务记录':'任务提交结果未知，请检查账户记录后再发起新任务。'});
  }finally{this.processing.delete(id);}
 }
}
