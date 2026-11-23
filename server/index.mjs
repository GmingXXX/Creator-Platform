import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ApiError,loadConfig,publicConfig,validateChat,validateImage} from './config.mjs';
import {createProviders} from './providers.mjs';
import {ImageJobs} from './jobs.mjs';
import {SpeechService,sendAudio} from './speech.mjs';
import {VideoJobs,createVideoProviders,validateVideo,sendVideo} from './video.mjs';
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
export function allowedRequest(req,port=8787){
 const hosts=new Set(['127.0.0.1','localhost','[::1]']);let host;try{host=new URL(`http://${req.headers.host}`).hostname;}catch{return false;}if(!hosts.has(host))return false;
 const origin=req.headers.origin;if(!origin)return true;
 try{const url=new URL(origin);return url.protocol==='http:'&&hosts.has(url.hostname)&&['4173','5173',String(port)].includes(url.port);}catch{return false;}
}
async function body(req,maxBytes=256*1024){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ApiError('请使用 JSON 请求',415);let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>maxBytes)throw new ApiError('请求内容过大',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new ApiError('请求内容不是有效 JSON');}}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.wav':'audio/wav','.woff2':'font/woff2','.json':'application/json'};
export async function createApp(config,{providers=createProviders(config),jobs=new ImageJobs(config.dataDir,providers),speech=new SpeechService(config),videoJobs=new VideoJobs(config.dataDir,createVideoProviders(config))}={}){
 await jobs.init();await speech.init();await videoJobs.init();const recent=new Map();let chatActive=0;
 const handler=async(req,res)=>{try{
  if(!allowedRequest(req,config.port))throw new ApiError('仅允许本机工作台访问',403);
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  if(path.startsWith('/api/')&&req.headers.origin){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Headers':'Content-Type,X-ZC-Client','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});res.end();return;}
  if(path==='/api/ai/config'&&req.method==='GET'){send(res,200,publicConfig(config));return;}
  if(path.startsWith('/api/')&&req.method==='POST'){
   if(req.headers['x-zc-client']!=='studio')throw new ApiError('请从智创工作台发起请求',403);
   const remote=req.socket.remoteAddress||'local',now=Date.now(),times=(recent.get(remote)||[]).filter(t=>now-t<60000);if(times.length>=20)throw new ApiError('操作过于频繁，请稍后重试',429);recent.set(remote,[...times,now]);
  }
  if(path==='/api/ai/chat'&&req.method==='POST'){
   const input=validateChat(await body(req));if(chatActive>=3)throw new ApiError('正在处理其他创作请求，请稍后重试',429);chatActive++;try{send(res,200,await providers.chat(input));}finally{chatActive--;}return;
  }
  if(path==='/api/ai/speech'&&req.method==='POST'){send(res,200,await speech.synthesize(await body(req)));return;}
  const audio=path.match(/^\/api\/ai\/audio\/([a-f\d]{64})\.(wav|mp3|ogg)$/);if(audio&&['GET','HEAD'].includes(req.method)){sendAudio(req,res,await speech.readAudio(audio[1],audio[2]));return;}
  if(path==='/api/ai/images'&&req.method==='POST'){
   if(!config.dashscopeKey)throw new ApiError('尚未配置万相密钥',503);send(res,202,await jobs.create(validateImage(await body(req))));return;
  }
  if(path==='/api/ai/videos'&&req.method==='POST'){
   if(!config.dashscopeKey)throw new ApiError('尚未配置万相密钥',503);send(res,202,await videoJobs.create(validateVideo(await body(req,3*1024*1024+8192))));return;
  }
  const videoTask=path.match(/^\/api\/ai\/videos\/([a-f\d]{32})$/);if(videoTask&&req.method==='GET'){send(res,200,await videoJobs.get(videoTask[1]));return;}
  const videoMedia=path.match(/^\/api\/ai\/video-media\/([a-f\d]{32})\.mp4$/);if(videoMedia&&['GET','HEAD'].includes(req.method)){const task=await videoJobs.get(videoMedia[1]);if(task.status!=='succeeded')throw new ApiError('视频尚未生成完成',409);await sendVideo(req,res,join(config.dataDir,'video','media',`${videoMedia[1]}.mp4`));return;}
  const task=path.match(/^\/api\/ai\/images\/([a-f\d]{32})$/);if(task&&req.method==='GET'){send(res,200,await jobs.get(task[1]));return;}
  const media=path.match(/^\/api\/ai\/media\/([a-f\d]{32})\.png$/);if(media&&req.method==='GET'){await jobs.get(media[1]);const bytes=await readFile(join(config.dataDir,'media',`${media[1]}.png`));res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'});res.end(bytes);return;}
  if(path.startsWith('/api/'))throw new ApiError('接口不存在',404);
  if(req.method!=='GET'&&req.method!=='HEAD')throw new ApiError('不支持此操作',405);
  const dist=resolve(config.root,'dist');let relative=decodeURIComponent(path).replace(/^\/+/,''),file=resolve(dist,relative||'index.html');if(!file.startsWith(dist+'/'))throw new ApiError('路径无效',403);
  try{if(!(await stat(file)).isFile())throw new Error();}catch{if(extname(file))throw new ApiError('文件不存在',404);file=join(dist,'index.html');}
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){send(res,error instanceof ApiError?error.status:500,{error:error instanceof ApiError?error.message:'请求处理失败，请重试'});}};
 return {handler,jobs,speech,videoJobs};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const config=await loadConfig(resolve(fileURLToPath(new URL('..',import.meta.url))));const app=await createApp(config);const server=http.createServer(app.handler);server.listen(config.port,'127.0.0.1',()=>console.log(`智创本地 AI 服务 http://127.0.0.1:${config.port}（单用户演示）`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{app.jobs.close();app.videoJobs.close();server.close(()=>process.exit(0));});
}
