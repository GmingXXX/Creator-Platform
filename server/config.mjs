import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export class ApiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const models=[{id:'deepseek-flash',label:'DeepSeek Flash'},{id:'deepseek-v4-pro',label:'DeepSeek Pro'}];
const readSecret=async(path)=>{try{return await readFile(path,'utf8')}catch{return ''}};
const bases={beijing:'https://dashscope.aliyuncs.com',singapore:'https://dashscope-intl.aliyuncs.com',virginia:'https://dashscope-us.aliyuncs.com'};
function csvRows(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let index=0;index<text.length;index++){
  const char=text[index];
  if(char==='"'){
   if(quoted&&text[index+1]==='"'){field+='"';index++;}else quoted=!quoted;
  }else if(char===','&&!quoted){row=[...row,field.trim()];field='';}
  else if((char==='\n'||char==='\r')&&!quoted){
   if(char==='\r'&&text[index+1]==='\n')index++;
   rows.push([...row,field.trim()]);row=[];field='';
  }else field+=char;
 }
 if(quoted)throw new ApiError('百炼 CSV 格式无效');
 if(row.length||field.trim())rows.push([...row,field.trim()]);
 return rows.filter(row=>row.some(Boolean));
}
function csvCredentials(text){
 const rows=csvRows(text.replace(/^\uFEFF/,''));
 let fields={};
 for(const row of rows){
  if(!['apiKey','apiHost','dashScope'].includes(row[0]))continue;
  if(row.length!==2)throw new ApiError('百炼 CSV 字段格式无效');
  if(Object.hasOwn(fields,row[0]))throw new ApiError('百炼 CSV 存在重复字段');
  fields={...fields,[row[0]]:row[1]};
 }
 // Retain only the old explicit region/key row format, never scan arbitrary metadata for secrets.
 const legacy=rows.find(row=>row.length===2&&/^(北京|新加坡|美国|beijing|singapore|virginia)$/i.test(row[0]));
 const key=fields.apiKey??legacy?.[1]??'';
 if(key&&!/^sk-[A-Za-z0-9_.-]+$/.test(key))throw new ApiError('百炼 API Key 格式无效');
 return {...fields,apiKey:key};
}
function providerBase(raw){
 let url;
 try{url=new URL(raw.includes('://')?raw:`https://${raw}`);}catch{throw new ApiError('百炼服务地址无效');}
 const allowed=Object.values(bases).some(base=>new URL(base).hostname===url.hostname)||/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!allowed||!['/','/api/v1','/api/v1/'].includes(url.pathname))throw new ApiError('百炼服务地址不受支持');
 return url.origin;
}
export async function loadConfig(root=process.cwd(),env=process.env){
 const speechKey=(env.UNIDTAI_TTS_API_KEY||await readSecret(env.UNIDTAI_TTS_KEY_FILE||resolve(root,'../../tagal/语音调用/api key.md'))).trim();
 const speechToken=speechKey.replace(/^Bearer\s+/i,'');
 const validSpeechKey=speechToken&&speechToken!=='YOUR_API_KEY'&&!/\s/.test(speechToken)?speechToken:'';
 const deep=env.DEEPSEEK_API_KEY?'':await readSecret(resolve(root,'deepseek api key.md'));
 const ali=env.DASHSCOPE_API_KEY?'':await readSecret(resolve(root,'阿里bai lian.csv'));
 const credentials=csvCredentials(ali);
 const region=env.DASHSCOPE_REGION||(/新加坡|singapore/i.test(ali)?'singapore':/美国|virginia/i.test(ali)?'virginia':'beijing');
 if(!bases[region])throw new ApiError('未支持的百炼地域配置');
 const csvBase=credentials.dashScope?providerBase(credentials.dashScope):undefined;
 const csvHost=credentials.apiHost?providerBase(credentials.apiHost):undefined;
 if(csvBase&&csvHost&&csvBase!==csvHost)throw new ApiError('百炼 CSV 服务地址不一致');
 const dashscopeBase=env.DASHSCOPE_BASE_URL?providerBase(env.DASHSCOPE_BASE_URL):csvBase||csvHost||bases[region];
 return {speechKey:validSpeechKey,deepseekKey:env.DEEPSEEK_API_KEY||deep.match(/sk-[A-Za-z0-9_-]+/)?.[0]||'',dashscopeKey:env.DASHSCOPE_API_KEY||credentials.apiKey,region,dashscopeBase,imageModel:env.WAN_IMAGE_MODEL||'wan2.6-t2i',videoModel:env.WAN_VIDEO_MODEL||'wan2.6-t2v',videoImageModel:env.WAN_VIDEO_IMAGE_MODEL||'wan2.6-i2v',dataDir:resolve(root,'.local/ai'),port:Number(env.AI_PORT)||8787,root};
}
export function publicConfig(config){return {models,configured:{deepseek:Boolean(config.deepseekKey),image:Boolean(config.dashscopeKey),speech:Boolean(config.speechKey),video:Boolean(config.dashscopeKey)},chatAvailable:Boolean(config.deepseekKey),imageAvailable:Boolean(config.dashscopeKey),videoAvailable:Boolean(config.dashscopeKey),imageModel:config.imageModel,videoModel:config.videoModel||'wan2.6-t2v',videoImageModel:config.videoImageModel||'wan2.6-i2v',region:config.region,mode:'local-single-user'};}
function string(value,max,name){if(typeof value!=='string'||!value.trim()||value.length>max)throw new ApiError(`${name}格式或长度不正确`);return value.trim();}
export function validateChat(body){
 if(!body||!models.some(m=>m.id===body.model))throw new ApiError('请选择可用的 DeepSeek 模型');
 if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>40)throw new ApiError('对话消息数量不正确');
 const messages=body.messages.map(m=>{if(!m||!['system','user','assistant'].includes(m.role))throw new ApiError('消息角色不支持');return {role:m.role,content:string(m.content,12000,'消息')};});
 if(messages.reduce((n,m)=>n+m.content.length,0)>60000)throw new ApiError('对话内容过长，请缩短资料');
 if(body.responseFormat!==undefined&&body.responseFormat!=='json')throw new ApiError('返回格式不支持');
 return {model:body.model,messages,responseFormat:body.responseFormat};
}
export function validateImage(body){
 if(!body)throw new ApiError('缺少生图请求');
 const prompt=string(body.prompt,2100,'图片描述'),workspaceId=string(body.workspaceId,100,'空间'),idempotencyKey=string(body.idempotencyKey,160,'任务标识');
 if(!/^[\w-]+$/.test(workspaceId)||!/^[\w-]+$/.test(idempotencyKey))throw new ApiError('任务标识格式不正确');
 let size=body.size||'1696*960';
 if(typeof size!=='string'||!/^\d{3,5}[x×*]\d{3,5}$/.test(size))throw new ApiError('图片尺寸格式不正确');
 const [w,h]=size.split(/[x×*]/).map(Number);if(!w||!h||w/h>4||h/w>4)throw new ApiError('支持 1:4 至 4:1 的图片比例');
 const ratio=w/h;size=ratio>=3?'2560*640':ratio>=1.5?'1696*960':ratio>=1.15?'1472*1104':ratio<=1/3?'640*2560':ratio<=.67?'960*1696':ratio<=.87?'1104*1472':'1280*1280';
 return {prompt,workspaceId,idempotencyKey,size};
}
