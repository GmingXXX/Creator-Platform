import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {startLauncher} from '../scripts/serve.mjs';
const cleanups:Array<()=>Promise<unknown>>=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
async function listen(handler:http.RequestListener){const server=http.createServer(handler);await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});cleanups.push(()=>new Promise<void>(resolve=>server.close(()=>resolve())));return {server,port:(server.address() as any).port};}
const config={mode:'local-single-user',models:[{id:'deepseek-flash',label:'DeepSeek'}],configured:{deepseek:false,image:false}};
async function project(){const root=await mkdtemp(join(tmpdir(),'zc-launcher-'));cleanups.push(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'dist'));await writeFile(join(root,'dist/index.html'),'0123456789');return root;}
async function launch(options:any){const launcher=await startLauncher(options);cleanups.push(()=>launcher.close());return launcher;}
describe('desktop launcher using isolated local fake providers',()=>{
 it('reuses a qualified backend, proxies POST headers and body, and preserves static ranges',async()=>{
  let request:any;const backend=await listen(async(req,res)=>{if(req.url==='/api/ai/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(config));return;}let body='';for await(const chunk of req)body+=chunk;request={method:req.method,headers:req.headers,body};res.writeHead(202,{'Content-Type':'application/json'});res.end('{"id":"fake"}');});
  const app=await launch({projectRoot:await project(),port:0,aiPort:backend.port});expect(app.ownsBackend).toBe(false);
  const response=await fetch(app.url+'/api/ai/images',{method:'POST',headers:{'Content-Type':'application/json','X-ZC-Client':'studio',Origin:'http://127.0.0.1:4173'},body:'{"prompt":"test"}'});expect(response.status).toBe(202);expect(request).toMatchObject({method:'POST',body:'{"prompt":"test"}',headers:{host:`127.0.0.1:${backend.port}`,'x-zc-client':'studio',origin:'http://127.0.0.1:4173'}});
  const partial=await fetch(app.url+'/',{headers:{Range:'bytes=2-5'}});expect(partial.status).toBe(206);expect(partial.headers.get('content-range')).toBe('bytes 2-5/10');expect(await partial.text()).toBe('2345');expect((await fetch(app.url+'/',{method:'HEAD'})).headers.get('content-length')).toBe('10');
 });
 it('refuses an occupied backend port that is not a qualified AI service',async()=>{const backend=await listen((req,res)=>res.end('unrelated'));await expect(startLauncher({projectRoot:await project(),port:0,aiPort:backend.port})).rejects.toThrow(/AI.*占用/);});
 it('does not claim an old desktop server is AI ready',async()=>{const old=await listen((req,res)=>{res.end(req.url==='/health'?'zhichuang-studio-v1':'not found');});await expect(startLauncher({projectRoot:await project(),port:old.port,aiPort:1})).rejects.toThrow(/关闭旧.*重启/);});
 it('reuses an existing new frontend only when its AI config is accessible',async()=>{const old=await listen((req,res)=>res.end(req.url==='/health'?'zhichuang-studio-v2':JSON.stringify(config)));const app=await launch({projectRoot:await project(),port:old.port,aiPort:1});expect(app.reused).toBe(true);expect(app.ownsBackend).toBe(false);});
 it('starts a single owned backend and stops it with the launcher',async()=>{
  const free=await listen((req,res)=>res.end());const aiPort=free.port;await new Promise<void>(resolve=>free.server.close(()=>resolve()));const root=await project();await mkdir(join(root,'server'));await writeFile(join(root,'server/index.mjs'),`import http from 'node:http';const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(${JSON.stringify(JSON.stringify(config))})});server.listen(Number(process.env.AI_PORT),'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`);
  const app=await launch({projectRoot:root,port:0,aiPort});expect(app.ownsBackend).toBe(true);expect((await fetch(app.url+'/api/ai/config')).ok).toBe(true);
  const second=await launch({projectRoot:root,port:0,aiPort});expect(second.ownsBackend).toBe(false);await second.close();await app.close();await expect(fetch(`http://127.0.0.1:${aiPort}/api/ai/config`)).rejects.toThrow();
 });
 it('serializes simultaneous launcher startup so only one backend reads persistent jobs',async()=>{
  const free=await listen((req,res)=>res.end());const aiPort=free.port;await new Promise<void>(resolve=>free.server.close(()=>resolve()));const root=await project();await mkdir(join(root,'server'));
  await writeFile(join(root,'server/index.mjs'),`import http from 'node:http';import {appendFileSync} from 'node:fs';appendFileSync('starts.txt','start\\n');const server=http.createServer((req,res)=>res.end(${JSON.stringify(JSON.stringify(config))}));setTimeout(()=>server.listen(Number(process.env.AI_PORT),'127.0.0.1'),100);process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`);
  const apps=await Promise.all([launch({projectRoot:root,port:0,aiPort}),launch({projectRoot:root,port:0,aiPort})]);expect(apps.filter(a=>a.ownsBackend)).toHaveLength(1);expect((await readFile(join(root,'starts.txt'),'utf8')).trim().split('\n')).toHaveLength(1);
 });

 it('handles static HTTP boundaries and backend disconnects without leaking details',async()=>{
  const backend=await listen((req,res)=>res.end(JSON.stringify(config)));const root=await project();await writeFile(join(root,'dist/empty.txt'),'');const app=await launch({projectRoot:root,port:0,aiPort:backend.port});
  expect(await(await fetch(app.url+'/health')).text()).toBe('zhichuang-studio-v2');
  for(const range of ['not-a-range','bytes=-','bytes=30-40','bytes=8-2'])expect((await fetch(app.url+'/',{headers:{Range:range}})).status).toBe(416);
  expect(await(await fetch(app.url+'/',{headers:{Range:'bytes=-3'}})).text()).toBe('789');expect(await(await fetch(app.url+'/',{headers:{Range:'bytes=8-'}})).text()).toBe('89');
  expect((await fetch(app.url+'/missing.js')).status).toBe(404);expect((await fetch(app.url+'/dist')).status).toBe(404);expect((await fetch(app.url+'/',{method:'POST'})).status).toBe(405);expect((await fetch(app.url+'/%ZZ')).status).toBe(400);expect(await new Promise(resolve=>http.get(app.url+'/',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)}))).toBe(403);expect(await(await fetch(app.url+'/empty.txt')).text()).toBe('');
  await new Promise<void>(resolve=>{backend.server.close(()=>resolve());backend.server.closeAllConnections()});const failed=await fetch(app.url+'/api/ai/config');expect(failed.status).toBe(503);expect(await failed.text()).toContain('本地 AI 服务不可用');
 });
 it('reports a conflicting non-platform frontend and a missing build',async()=>{
  const foreign=await listen((req,res)=>res.end('foreign'));await expect(startLauncher({projectRoot:await project(),port:foreign.port,aiPort:1})).rejects.toThrow(/其他程序占用/);
  await expect(startLauncher({projectRoot:'/tmp/zhichuang-nonexistent-root',port:0,aiPort:1})).rejects.toThrow(/dist/);
 });
 it('recovers a dead launcher lock and reports backend exit instead of claiming readiness',async()=>{
  const free=await listen((req,res)=>res.end());const aiPort=free.port;await new Promise<void>(resolve=>free.server.close(()=>resolve()));const root=await project();await mkdir(join(root,'server'));await mkdir(join(root,'.local'));await writeFile(join(root,'.local',`launcher-ai-${aiPort}.lock`),'99999999');await writeFile(join(root,'server/index.mjs'),'process.exit(2)');await expect(startLauncher({projectRoot:root,port:0,aiPort})).rejects.toThrow(/AI 服务启动失败/);
 });

});
