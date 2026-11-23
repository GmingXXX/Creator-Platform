import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {ApiError} from './config.mjs';

const endpoint='https://tts-hs.unidtai.com/tts';
const speaker='zh_male_ruyayichen_uranus_bigtts';
const context='请以展厅专业讲解员的语气播读。表达清楚、自然、可信，使用中等语速，准确读出企业名称、年份、数字和术语，句尾收稳，段落间自然停顿。保持亲切而专业，不夸张、不喊话，不添加文案中没有的内容。';
const maxAudio=12*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function validateSpeech(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['text','speaker','style'].includes(key))||typeof value.text!=='string'||!value.text.trim()||value.text.length>6000)throw new ApiError('讲稿需为 1–6000 字文本');
 if(value.speaker!==undefined&&value.speaker!==speaker)throw new ApiError('该音色尚未接入，请选择专业讲解音色');
 if(value.style!==undefined&&!['professional','warm','formal'].includes(value.style))throw new ApiError('讲解语气无效');
 return {text:value.text.trim(),...(value.speaker?{speaker:value.speaker}:{}),...(value.style?{style:value.style}:{})};
}
export function speechRequest(text,profile={}){const tone=profile.style==='warm'?'请以亲切自然的展厅讲述语气播读，表达清晰，不添加任何原文以外的信息。':profile.style==='formal'?'请以庄重严谨的正式汇报语气播读，咬字清楚，句尾收稳，不添加任何原文以外的信息。':context;return {text,speaker,additions:{enable_latex_tn:true,context_texts:[tone]}};}
export function safeSpeechURL(raw){
 let url;try{url=new URL(raw);}catch{throw new ApiError('语音服务未返回有效音频地址',502);}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['.myqcloud.com','.tencentcos.cn'].some(suffix=>url.hostname.endsWith(suffix)))throw new ApiError('语音文件来源不受支持',502);
 return url.href;
}
function audioType(bytes){
 if(bytes.length<100)throw new ApiError('语音文件为空或不完整',502);
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE')return {ext:'wav',mime:'audio/wav'};
 if(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)return {ext:'mp3',mime:'audio/mpeg'};
 if(bytes.subarray(0,4).toString()==='OggS')return {ext:'ogg',mime:'audio/ogg'};
 throw new ApiError('语音文件格式无效',502);
}
async function boundedAudio(response){
 if(!response.ok||!response.body||! /^(audio\/|application\/octet-stream)/i.test(response.headers.get('content-type')||''))throw new ApiError('语音下载返回无效内容，请重试下载',502);
 if(Number(response.headers.get('content-length'))>maxAudio)throw new ApiError('语音文件超过大小限制',502);
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.byteLength;if(size>maxAudio)throw new ApiError('语音文件超过大小限制',502);chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);return {bytes,...audioType(bytes)};
}
/** Durable local cache: after a successful paid POST, retries download the same audio URL. */
export class SpeechService {
 constructor(config,{fetcher=fetch}={}){this.config=config;this.fetcher=fetcher;this.dir=join(config.dataDir,'speech');this.pending=new Map();this.active=0;}
 async init(){await mkdir(this.dir,{recursive:true,mode:0o700});}
 async record(id){
  try{const data=JSON.parse(await readFile(join(this.dir,`${id}.json`),'utf8'));if(data.id!==id||!['submitting','rejected','download','ready'].includes(data.status))throw new Error();return data;}
  catch(error){if(error.code==='ENOENT')return undefined;throw new ApiError('语音缓存记录损坏，请检查本地任务记录后再试',503);}
 }
 async save(record){const temp=join(this.dir,`${record.id}.${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify({...record,updatedAt:new Date().toISOString()}),{mode:0o600});await rename(temp,join(this.dir,`${record.id}.json`));}
 public(record,cached){return {id:record.id,url:`/api/ai/audio/${record.id}.${record.ext}`,cached,characters:record.characters,speaker};}
 async synthesize(raw){
  const profile=validateSpeech(raw),request=speechRequest(profile.text,profile),id=hash(JSON.stringify({version:'exhibition-narration-v1',...request}));
  if(this.pending.has(id))return this.pending.get(id);
  if(!this.config.speechKey)throw new ApiError('尚未配置语音密钥，请检查服务端配置',503);
  if(this.active>=2)throw new ApiError('正在生成其他讲解，请稍后重试',429);
  this.active++;
  const task=this.run(id,request).finally(()=>{this.pending.delete(id);this.active--;});this.pending.set(id,task);return task;
 }
 async run(id,request){
  await this.init();let record=await this.record(id);
  if(record?.status==='ready'){await this.readAudio(id,record.ext);return this.public(record,true);}
  if(record?.status==='submitting')throw new ApiError('上次语音提交中断，无法确认是否已计费；请检查服务记录，不会自动重复提交',409);
  if(record?.status!=='download'){
   record={id,status:'submitting',characters:request.text.length,createdAt:new Date().toISOString()};await this.save(record);
   let response;
   try{response=await this.fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${this.config.speechKey}`,'Content-Type':'application/json'},body:JSON.stringify(request),redirect:'error',signal:AbortSignal.timeout(150000)});}
   catch{throw new ApiError('语音提交中断或超时，无法确认是否已计费；不会自动重复提交',502);}
   if(!response.ok){
    // Only explicit non-billing rejections may be submitted again after correction.
    if([400,401,403,402,413,422,429].includes(response.status))await this.save({...record,status:'rejected'});
    throw new ApiError(response.status===401||response.status===403?'语音密钥或访问权限无效，请检查服务端配置':response.status===429?'语音服务繁忙，请稍后重试':'语音服务未完成请求，请检查服务记录',502);
   }
   let result;try{result=await response.json();}catch{throw new ApiError('语音服务响应无效，无法确认任务状态，请检查服务记录',502);}
   if(result?.code!==0)throw new ApiError('语音生成未得到成功确认，请检查服务记录',502);
   record={...record,status:'download',audioUrl:safeSpeechURL(result.audio_url)};await this.save(record);
  }
  let audio;
  try{audio=await boundedAudio(await this.fetcher(safeSpeechURL(record.audioUrl),{redirect:'error',signal:AbortSignal.timeout(60000)}));}
  catch(error){throw error instanceof ApiError?error:new ApiError('语音下载中断，请重试；重试只下载已生成音频',502);}
  const file=join(this.dir,`${id}.${audio.ext}`),temp=`${file}.${randomUUID()}.tmp`;
  await writeFile(temp,audio.bytes,{mode:0o600});await rename(temp,file);
  const ready={id,status:'ready',characters:record.characters,ext:audio.ext,mime:audio.mime,bytes:audio.bytes.length,sha256:hash(audio.bytes),createdAt:record.createdAt};await this.save(ready);return this.public(ready,false);
 }
 async readAudio(id,ext){
  if(!/^[a-f0-9]{64}$/.test(id)||!['wav','mp3','ogg'].includes(ext))throw new ApiError('语音文件不存在',404);
  const record=await this.record(id);if(record?.status!=='ready'||record.ext!==ext)throw new ApiError('语音文件不存在',404);
  let bytes;try{bytes=await readFile(join(this.dir,`${id}.${ext}`));}catch{throw new ApiError('已生成语音文件缺失，请检查本地缓存',404);}
  if(hash(bytes)!==record.sha256)throw new ApiError('已生成语音文件校验失败，请检查本地缓存',409);
  return {bytes,mime:record.mime};
 }
}
export function sendAudio(req,res,{bytes,mime}){
 let start=0,end=bytes.length-1,status=200;const headers={'Content-Type':mime,'Cache-Control':'private, max-age=86400','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return;}
  if(match[1]==='')start=Math.max(0,bytes.length-Number(match[2]));else{start=Number(match[1]);end=match[2]?Math.min(end,Number(match[2])):end;}
  if(start>end||start<0||start>=bytes.length){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return;}
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;
 }
 res.writeHead(status,{...headers,'Content-Length':end-start+1});res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));
}
