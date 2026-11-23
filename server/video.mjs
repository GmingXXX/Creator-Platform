import {mkdir,readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {ApiError} from './config.mjs';

const sizes=['1280*720','720*1280','960*960','1088*832','832*1088','1920*1080','1080*1920','1440*1440','1632*1248','1248*1632'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=(value,max,name)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new ApiError(`${name}格式或长度不正确`);return value.trim();};
export function validateVideo(body){
 if(!body||typeof body!=='object')throw new ApiError('缺少视频请求');
 const prompt=text(body.prompt,1500,'视频描述'),workspaceId=text(body.workspaceId,100,'空间'),idempotencyKey=text(body.idempotencyKey,240,'任务标识');
 if(!/^[\w-]+$/.test(workspaceId)||!/^[\w:.-]+$/.test(idempotencyKey))throw new ApiError('任务标识格式不正确');
 const duration=body.duration??5,size=body.size??'1280*720';
 if(![5,10,15].includes(duration)||!sizes.includes(size))throw new ApiError('请选择 5、10 或 15 秒，以及支持的视频分辨率');
 const referenceImage=body.referenceImage;
 if(referenceImage!==undefined&&(typeof referenceImage!=='string'||referenceImage.length>3*1024*1024||!(/^\/api\/ai\/media\/[a-f\d]{32}\.png$/.test(referenceImage)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(referenceImage))))throw new ApiError('参考图请使用平台生成图片或不超过 2 MB 的 PNG/JPEG/WebP 图片');
 return {prompt,workspaceId,idempotencyKey,duration,size,...referenceImage?{referenceImage}:{}};
}
export function safeVideoURL(raw){
 let url;try{url=new URL(raw);}catch{throw new ApiError('视频地址无效',502);}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)(aliyuncs\.com|alicdn\.com)$/.test(url.hostname))throw new ApiError('视频来源不受支持',502);
 return url.href;
}
const providerError=status=>new ApiError(status===401||status===403?'视频模型密钥或访问权限无效，请检查服务端配置':status===429?'视频模型调用过于频繁，请稍后查询':'视频模型服务暂不可用，请稍后查询',status===401||status===403?503:502);
export function createVideoProviders(config,fetcher=fetch){
 const headers={'Content-Type':'application/json',Authorization:`Bearer ${config.dashscopeKey}`};
 const request=async(url,options)=>{let response;try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(120000)});}catch{throw new ApiError('视频请求中断或超时，请查询已有任务',502);}if(!response.ok)throw providerError(response.status);try{return await response.json();}catch{throw new ApiError('视频模型返回格式无效',502);}};
 return {
  async submitVideo(input){
   if(!config.dashscopeKey)throw new ApiError('尚未配置万相密钥',503);
   const image=!!input.referenceImage,model=image?(config.videoImageModel||'wan2.6-i2v'):(config.videoModel||'wan2.6-t2v');
   if(model!==(image?'wan2.6-i2v':'wan2.6-t2v'))throw new ApiError('视频模型配置不受支持',503);
   let reference=input.referenceImage;
   if(reference?.startsWith('/api/ai/media/')){const id=reference.match(/([a-f\d]{32})\.png$/)?.[1];if(!id)throw new ApiError('参考图无效');let bytes;try{bytes=await readFile(join(config.dataDir,'media',`${id}.png`));}catch{throw new ApiError('参考图不存在，请重新选择');}if(bytes.length>20*1024*1024)throw new ApiError('参考图超过 20 MB，请先压缩');reference=`data:image/png;base64,${bytes.toString('base64')}`;}
   const resolution=sizes.indexOf(input.size)<5?'720P':'1080P';
   const data=await request(`${config.dashscopeBase}/api/v1/services/aigc/video-generation/video-synthesis`,{method:'POST',headers:{...headers,'X-DashScope-Async':'enable'},body:JSON.stringify({model,input:{prompt:input.prompt,...image?{img_url:reference}:{}},parameters:{duration:input.duration,...image?{resolution}:{size:input.size},prompt_extend:true,shot_type:'single',watermark:true}})});
   if(typeof data.output?.task_id!=='string'||!data.output.task_id)throw new ApiError('视频提交未得到确认，请检查任务记录，勿连续重试',502);
   return {taskId:data.output.task_id,model};
  },
  async pollVideo(id){const data=await request(`${config.dashscopeBase}/api/v1/tasks/${encodeURIComponent(id)}`,{headers});return {status:data.output?.task_status,url:data.output?.video_url?safeVideoURL(data.output.video_url):undefined};},
  async downloadVideo(raw){
   let response;try{response=await fetcher(safeVideoURL(raw),{redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw new ApiError('视频保存失败，请重新查询任务',502);}
   if(!response.ok||!/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type')||''))throw new ApiError('视频内容无效',502);
   const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;if(size>150*1024*1024)throw new ApiError('视频超过保存限制',502);chunks.push(chunk);}
   const bytes=Buffer.concat(chunks);if(bytes.length<8||bytes.toString('ascii',4,8)!=='ftyp')throw new ApiError('视频文件不是有效 MP4',502);return bytes;
  }
 };
}
export class VideoJobs {
 constructor(dir,providers,{schedule=true,pollMs=10000}={}){this.dir=join(dir,'video');this.providers=providers;this.schedule=schedule;this.pollMs=pollMs;this.tasks=new Map();this.creation=new Map();this.processing=new Set();this.timers=new Map();}
 async init(){
  await mkdir(join(this.dir,'tasks'),{recursive:true,mode:0o700});await mkdir(join(this.dir,'media'),{recursive:true,mode:0o700});
  for(const file of await readdir(join(this.dir,'tasks'))){if(!/^[a-f\d]{32}\.json$/.test(file))continue;let task;try{task=JSON.parse(await readFile(join(this.dir,'tasks',file),'utf8'));}catch{continue;}if(!task?.id||!task.input)continue;this.tasks.set(task.id,task);
   if(task.status==='running'&&!task.providerId)await this.save({...task,status:'failed',retryable:false,error:'上次视频提交中断，无法确认计费状态，请检查供应商任务记录。'});
   else if(['queued','running'].includes(task.status))this.later(task.id);
  }
 }
 public(task){return {id:task.id,status:task.status,retryable:Boolean(task.retryable),workspaceId:task.input.workspaceId,duration:task.input.duration,size:task.input.size,model:task.model,url:task.status==='succeeded'?`/api/ai/video-media/${task.id}.mp4`:undefined,error:task.error,createdAt:task.createdAt,updatedAt:task.updatedAt};}
 async save(task){const next={...task,updatedAt:new Date().toISOString()},temp=join(this.dir,'tasks',`${task.id}.${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,join(this.dir,'tasks',`${task.id}.json`));this.tasks.set(next.id,next);return next;}
 async create(input){
  const id=hash(`${input.workspaceId}:${input.idempotencyKey}`).slice(0,32),fingerprint=hash(JSON.stringify(input));
  if(this.creation.has(id)){await this.creation.get(id);return this.create(input);}
  const existing=this.tasks.get(id);if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError('任务标识已用于其他内容，请使用新版本重新生成',409);if(existing.status!=='failed'||!existing.retryable||!existing.providerId)return this.public(existing);
   const resuming=this.save({...existing,status:'running',retryable:false,error:undefined,pollErrors:0,queryStartedAt:new Date().toISOString()});this.creation.set(id,resuming);try{const task=await resuming;this.later(id,0);return this.public(task);}finally{this.creation.delete(id);}
  }
  const saving=this.save({id,input,fingerprint,status:'queued',pollErrors:0,createdAt:new Date().toISOString()});this.creation.set(id,saving);try{const task=await saving;this.later(id,0);return this.public(task);}finally{this.creation.delete(id);}
 }
 async get(id){const task=this.tasks.get(id);if(!task)throw new ApiError('未找到视频任务',404);return this.public(task);}
 later(id,delay=this.pollMs){if(!this.schedule||this.timers.has(id))return;const timer=setTimeout(()=>{this.timers.delete(id);void this.process(id).catch(()=>{});},delay);timer.unref?.();this.timers.set(id,timer);}
 close(){for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();}
 async process(id){
  if(this.processing.has(id))return;if(this.processing.size>=2){this.later(id);return;}let task=this.tasks.get(id);if(!task||!['queued','running'].includes(task.status))return;this.processing.add(id);
  try{
   if(task.status==='queued'){task=await this.save({...task,status:'running'});const submitted=await this.providers.submitVideo(task.input);task=await this.save({...task,providerId:submitted.taskId,model:submitted.model});}
   if(Date.now()-Date.parse(task.queryStartedAt||task.createdAt)>60*60*1000){await this.save({...task,status:'failed',retryable:true,error:'视频任务等待超时，可重新查询已有任务，不会重新提交。'});return;}
   const result=await this.providers.pollVideo(task.providerId);
   if(result.status==='SUCCEEDED'){
    if(!result.url){await this.save({...task,status:'failed',retryable:false,error:'视频任务完成但没有返回视频文件'});return;}
    const bytes=await this.providers.downloadVideo(result.url),temp=join(this.dir,'media',`${id}.tmp`);await writeFile(temp,bytes,{mode:0o600});await rename(temp,join(this.dir,'media',`${id}.mp4`));await this.save({...task,status:'succeeded',retryable:false,error:undefined,pollErrors:0});
   }else if(['FAILED','CANCELED','UNKNOWN'].includes(result.status))await this.save({...task,status:'failed',retryable:false,error:'视频生成未完成，请检查模型额度或调整描述，再创建新版本。'});
   else{await this.save({...task,status:'running',retryable:false,error:undefined,pollErrors:0});this.later(id);}
  }catch(error){const retryable=Boolean(task.providerId)&&(!(error instanceof ApiError)||error.status>=500||error.status===429);
   if(retryable&&(task.pollErrors||0)<2){const pollErrors=(task.pollErrors||0)+1;await this.save({...task,status:'running',pollErrors,error:undefined});this.later(id,this.pollMs*2**pollErrors);}
   else await this.save({...task,status:'failed',retryable,error:retryable?'已有视频暂时无法查询或保存，可重新查询，不会再次提交生成。':error instanceof ApiError?error.message:'视频提交结果未知，请检查供应商任务记录。'});
  }finally{this.processing.delete(id);}
 }
}

export async function sendVideo(req,res,path){
 const bytes=await readFile(path),range=req.headers.range;
 const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'};
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=match?.[1]?Number(match[1]):0,end=match?.[2]?Number(match[2]):bytes.length-1;if(match&&!match[1]&&match[2]){start=Math.max(0,bytes.length-Number(match[2]));end=bytes.length-1;}end=Math.min(end,bytes.length-1);
  if(!match||start>end||start>=bytes.length){res.writeHead(416,{...headers,'Content-Range':`bytes */${bytes.length}`});res.end();return;}
  res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));return;
 }
 res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
}
