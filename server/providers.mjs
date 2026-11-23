import {ApiError} from './config.mjs';
const providerError=status=>new ApiError(status===401||status===403?'模型密钥或访问权限无效，请检查服务端配置':status===402?'模型账户额度不足':status===429?'模型调用过于频繁，请稍后再试':'模型服务暂不可用，请稍后重试',status===401||status===403?503:502);
async function jsonRequest(fetcher,url,options){
 let response;try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(120000)});}catch{throw new ApiError('模型请求中断或超时，请稍后检查任务状态',502);}
 if(!response.ok)throw providerError(response.status);
 try{return await response.json();}catch{throw new ApiError('模型返回格式无效',502);}
}
export function safeImageURL(raw){let url;try{url=new URL(raw)}catch{throw new ApiError('图片地址无效',502)}if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)(aliyuncs\.com|alicdn\.com)$/.test(url.hostname))throw new ApiError('图片来源不受支持',502);return url.href;}
export function createProviders(config,fetcher=fetch){
 const auth=key=>({'Content-Type':'application/json',Authorization:`Bearer ${key}`});
 return {
  async chat(input){
   if(!config.deepseekKey)throw new ApiError('尚未配置 DeepSeek 密钥',503);
   const body={model:input.model,messages:input.messages,stream:false,thinking:{type:'disabled'},max_tokens:8000,...input.responseFormat==='json'?{response_format:{type:'json_object'}}:{}};
   const data=await jsonRequest(fetcher,'https://api.deepseek.com/chat/completions',{method:'POST',headers:auth(config.deepseekKey),body:JSON.stringify(body)});
   const message=data.choices?.[0];if(message?.finish_reason==='length')throw new ApiError('模型输出未完整，请缩小本次创作范围',502);
   const content=message?.message?.content;if(typeof content!=='string'||!content.trim())throw new ApiError('模型未返回有效内容',502);
   return {content,model:input.model,usage:data.usage?{prompt_tokens:data.usage.prompt_tokens,completion_tokens:data.usage.completion_tokens,total_tokens:data.usage.total_tokens}:undefined};
  },
  async submitImage(input){
   if(!config.dashscopeKey)throw new ApiError('尚未配置万相密钥',503);
   const modern=config.imageModel==='wan2.6-t2i';
   if(!modern&&!['wan2.2-t2i-flash','wan2.2-t2i-plus','wanx2.1-t2i-turbo','wanx2.1-t2i-plus','wan2.5-t2i-preview'].includes(config.imageModel))throw new ApiError('生图模型配置不受支持',503);
   let size=input.size;if(!modern&&!config.imageModel.startsWith('wan2.5')){const [w,h]=size.split('*').map(Number);const scale=1400/Math.max(w,h);size=`${Math.max(512,Math.round(w*scale))}*${Math.max(512,Math.round(h*scale))}`;}
   const body={model:config.imageModel,input:modern?{messages:[{role:'user',content:[{text:input.prompt}]}]}:{prompt:input.prompt},parameters:{size,n:1,prompt_extend:true}};
   const endpoint=modern?'image-generation/generation':'text2image/image-synthesis';
   const data=await jsonRequest(fetcher,`${config.dashscopeBase}/api/v1/services/aigc/${endpoint}`,{method:'POST',headers:{...auth(config.dashscopeKey),'X-DashScope-Async':'enable'},body:JSON.stringify(body)});
   const taskId=data.output?.task_id;if(typeof taskId!=='string'||!taskId)throw new ApiError('图片任务提交未得到确认，请勿连续重试',502);return {taskId,size};
  },
  async pollImage(taskId){
   const data=await jsonRequest(fetcher,`${config.dashscopeBase}/api/v1/tasks/${encodeURIComponent(taskId)}`,{headers:auth(config.dashscopeKey)});
   const output=data.output||{},url=output.results?.[0]?.url||output.choices?.[0]?.message?.content?.find(c=>c.image)?.image;
   return {status:output.task_status,url:url?safeImageURL(url):undefined};
  },
  async downloadImage(raw){
   const url=safeImageURL(raw);let response;try{response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(60000)});}catch{throw new ApiError('图片保存失败，请重新查询任务',502);}
   if(!response.ok||!/^image\/(png|jpeg|webp)/i.test(response.headers.get('content-type')||''))throw new ApiError('图片内容无效',502);
   const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;if(size>25*1024*1024)throw new ApiError('图片超过保存限制',502);chunks.push(chunk);}
   const buffer=Buffer.concat(chunks);if(!buffer.length)throw new ApiError('图片内容为空',502);return buffer;
  }
 };
}
