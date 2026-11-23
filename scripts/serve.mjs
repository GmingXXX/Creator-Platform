import http from 'node:http';
import net from 'node:net';
import { createReadStream, existsSync, statSync } from 'node:fs';
import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon'};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function qualifies(url){try{const response=await fetch(url+'/api/ai/config',{signal:AbortSignal.timeout(800)});if(!response.ok)return false;const c=await response.json();return c.mode==='local-single-user'&&Array.isArray(c.models)&&c.models.length>0&&c.models.every(m=>typeof m.id==='string'&&typeof m.label==='string')&&typeof c.configured?.deepseek==='boolean'&&typeof c.configured?.image==='boolean';}catch{return false;}}
async function occupied(port){return new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(500);socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',()=>{socket.destroy();resolve(false)});socket.once('timeout',()=>{socket.destroy();resolve(true)});});}
async function acquireLock(file){
 await mkdir(path.dirname(file),{recursive:true});
 try{const handle=await open(file,'wx',0o600);await handle.writeFile(String(process.pid));await handle.close();return true;}catch(error){if(error.code!=='EEXIST')throw error;}
 try{const pid=Number(await readFile(file,'utf8'));if(!Number.isInteger(pid)||pid<1)return false;try{process.kill(pid,0);return false;}catch(error){if(error.code!=='ESRCH')return false;}}catch{}
 await unlink(file).catch(()=>{});return false;
}
async function ensureBackend(projectRoot,aiPort){
 const url=`http://127.0.0.1:${aiPort}`,lock=path.join(projectRoot,'.local',`launcher-ai-${aiPort}.lock`);
 for(let attempts=0;attempts<60;attempts++){
  if(await qualifies(url))return {ownsBackend:false,close:async()=>{}};
  if(await occupied(aiPort))throw new Error(`AI 端口 ${aiPort} 已被其他服务占用，请关闭该服务后重试。`);
  if(!await acquireLock(lock)){await pause(200);continue;}
  let child;
  try{
   // Another launcher may have completed startup just before we acquired the lock.
   if(await qualifies(url)){await unlink(lock);return {ownsBackend:false,close:async()=>{}};}
   if(await occupied(aiPort))throw new Error(`AI 端口 ${aiPort} 已被其他服务占用。`);
   child=spawn(process.execPath,[path.join(projectRoot,'server/index.mjs')],{cwd:projectRoot,env:{...process.env,AI_PORT:String(aiPort)},stdio:['ignore','inherit','inherit']});
   let failed=false;child.once('error',()=>{failed=true});
   for(let i=0;i<60;i++){if(failed||child.exitCode!==null)throw new Error('AI 服务启动失败，请检查终端中的配置提示。');if(await qualifies(url))return {ownsBackend:true,close:()=>stopChild(child,lock)};await pause(150);}
   throw new Error('AI 服务启动超时，请关闭终端后重新启动。');
  }catch(error){if(child)await stopChild(child,lock);else await unlink(lock).catch(()=>{});throw error;}
 }
 throw new Error('另一个启动器正在启动 AI 服务，请稍后重试。');
}
async function stopChild(child,lock){
 if(child.pid&&child.exitCode===null&&child.signalCode===null){await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');},3000);child.once('exit',()=>{clearTimeout(timer);resolve()});child.kill('SIGTERM');});}
 await unlink(lock).catch(()=>{});
}
function proxy(req,res,aiPort){
 const request=http.request({hostname:'127.0.0.1',port:aiPort,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${aiPort}`}},response=>{res.writeHead(response.statusCode||502,response.headers);response.pipe(res);});
 request.on('error',()=>{if(res.headersSent){res.destroy();return;}res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'本地 AI 服务不可用，请重新启动平台。'}));});
 req.on('aborted',()=>request.destroy());res.on('close',()=>{if(!res.writableEnded)request.destroy();});req.pipe(request);
}
function handler(root,aiPort){return(req,res)=>{
 try{
  const hostname=new URL(`http://${req.headers.host}`).hostname;if(!['127.0.0.1','localhost','[::1]'].includes(hostname)){res.writeHead(403);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
  if(pathname.startsWith('/api/')){proxy(req,res,aiPort);return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  if(pathname==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('zhichuang-studio-v2');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  const size=statSync(file).size,headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  let start=0,end=size-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}if(match[1]===''){start=Math.max(0,size-Number(match[2]));}else{start=Number(match[1]);end=match[2]?Math.min(size-1,Number(match[2])):size-1;}if(start>end||start<0||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
  res.writeHead(status,{...headers,'Content-Length':size?end-start+1:0});if(req.method==='HEAD'||!size){res.end();return;}const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
 }catch{res.writeHead(400);res.end('Invalid request');}
};}
export async function startLauncher({projectRoot=defaultRoot,port=Number(process.env.PORT||4173),aiPort=Number(process.env.AI_PORT||8787)}={}){
 const root=path.join(projectRoot,'dist');if(!existsSync(path.join(root,'index.html')))throw new Error('未找到 dist/index.html。开发目录请先运行 npm run build。');
 const server=http.createServer(handler(root,aiPort));
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){
  if(error.code!=='EADDRINUSE')throw error;
  const url=`http://127.0.0.1:${port}`;let health='';try{health=await(await fetch(url+'/health',{signal:AbortSignal.timeout(800)})).text();}catch{}
  if(health.startsWith('zhichuang-studio-')){if(await qualifies(url))return {url,reused:true,ownsBackend:false,close:async()=>{}};throw new Error(`检测到旧版或异常平台占用 ${port}，AI 接口不可用。请关闭旧终端后重启平台。`);}
  throw new Error(`端口 ${port} 已被其他程序占用，请设置 PORT 后重试。`);
 }
 let backend;try{backend=await ensureBackend(projectRoot,aiPort);}catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
 const url=`http://127.0.0.1:${server.address().port}`;let closed=false;
 return {url,reused:false,ownsBackend:backend.ownsBackend,close:async()=>{if(closed)return;closed=true;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await backend.close();}};
}
function openBrowser(url){if(!process.argv.includes('--open'))return;const child=process.platform==='darwin'?spawn('open',[url]):process.platform==='win32'?spawn('cmd',['/c','start','',url]):spawn('xdg-open',[url]);child.on('error',()=>console.log(`请手动打开 ${url}`));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const app=await startLauncher();console.log(`\n智创平台已启动：${app.url}\nAI 本地接口已连接（可用模型取决于密钥配置）。\n演示账号：jiming / 123456\n保持此窗口打开；按 Ctrl+C 停止。\n`);openBrowser(app.url);if(!app.reused){for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.once(signal,async()=>{await app.close();process.exit(0);});}}
 catch(error){console.error(error.message);process.exitCode=1;}
}
