import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateChat,validateImage,publicConfig,loadConfig} from '../server/config.mjs';
import {createProviders,safeImageURL} from '../server/providers.mjs';
import {ImageJobs} from '../server/jobs.mjs';

describe('AI boundary',()=>{
 it('rejects unsupported models and oversized or malformed prompts',()=>{
  expect(()=>validateChat({model:'fake',messages:[]})).toThrow();
  expect(()=>validateChat({model:'deepseek-flash',messages:[{role:'user',content:'a'.repeat(13000)}]})).toThrow();
  expect(()=>validateImage({prompt:'x',workspaceId:'../private',idempotencyKey:'a'})).toThrow();
 });
 it('normalizes image dimensions without claiming arbitrary provider sizes',()=>{
  expect(validateImage({prompt:'科技背景',workspaceId:'personal',idempotencyKey:'request-1',size:'1920x1080'}).size).toBe('1696*960');
 });
 it('never exposes configured credentials',()=>{
  const conf=publicConfig({deepseekKey:'sk-private',dashscopeKey:'sk-private',imageModel:'wan2.6-t2i',region:'beijing'});
  expect(JSON.stringify(conf)).not.toContain('sk-private');expect(conf.chatAvailable).toBe(true);
 });
 it('does not accept arbitrary image result hosts',()=>{
  expect(()=>safeImageURL('http://127.0.0.1/secret')).toThrow();
  expect(()=>safeImageURL('https://aliyuncs.com.attacker.test/a')).toThrow();
  expect(safeImageURL('https://x.oss-cn-beijing.aliyuncs.com/a.png')).toContain('https');
 });
 it('uses JSON protocol and disables implicit thinking for bounded chat calls',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'{"title":"hello"}'}}],usage:{total_tokens:3}})));
  const p=createProviders({deepseekKey:'test',dashscopeKey:'test',dashscopeBase:'https://dashscope.aliyuncs.com',imageModel:'wan2.6-t2i'},fetcher);
  const result=await p.chat(validateChat({model:'deepseek-flash',messages:[{role:'user',content:'用 JSON 回复'}],responseFormat:'json'}));
  expect(result.content).toContain('hello');const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.response_format.type).toBe('json_object');expect(body.thinking.type).toBe('disabled');
 });
 it('sanitizes upstream errors instead of returning provider payload or secrets',async()=>{
  const p=createProviders({deepseekKey:'sk-private'},async()=>new Response('secret sk-private',{status:401}));
  await expect(p.chat(validateChat({model:'deepseek-flash',messages:[{role:'user',content:'hi'}]}))).rejects.toThrow('密钥');
  await expect(p.chat(validateChat({model:'deepseek-flash',messages:[{role:'user',content:'hi'}]}))).rejects.not.toThrow('sk-private');
 });
});

describe('image task durability',()=>{
 it('deduplicates submissions, rejects changed payload and saves local image',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-test-'));
  const providers={submitImage:vi.fn(async()=>({taskId:'provider-1'})),pollImage:vi.fn(async()=>({status:'SUCCEEDED',url:'https://x.aliyuncs.com/image.png'})),downloadImage:vi.fn(async()=>Buffer.from('image'))};
  const jobs=new ImageJobs(dir,providers,{schedule:false});await jobs.init();
  const input=validateImage({prompt:'科技背景',workspaceId:'personal',idempotencyKey:'request-1'});
  const [a,b]=await Promise.all([jobs.create(input),jobs.create(input)]);expect(a.id).toBe(b.id);
  await expect(jobs.create({...input,prompt:'another'})).rejects.toThrow('重复');
  await jobs.process(a.id);await jobs.process(a.id);expect(providers.submitImage).toHaveBeenCalledTimes(1);
  expect((await jobs.get(a.id)).status).toBe('succeeded');expect(await readFile(join(dir,'media',a.id+'.png'),'utf8')).toBe('image');
  const restored=new ImageJobs(dir,providers,{schedule:false});await restored.init();expect((await restored.create(input)).id).toBe(a.id);expect(providers.submitImage).toHaveBeenCalledTimes(1);
 });
 it('does not silently resubmit an interrupted billed request',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-test-'));
  const providers={submitImage:vi.fn(async()=>{throw new Error('network secret')})};
  const jobs=new ImageJobs(dir,providers,{schedule:false});await jobs.init();const task=await jobs.create(validateImage({prompt:'hi',workspaceId:'personal',idempotencyKey:'request-2'}));await jobs.process(task.id);
  expect((await jobs.get(task.id)).status).toBe('failed');expect((await jobs.get(task.id)).error).not.toContain('secret');await jobs.process(task.id);expect(providers.submitImage).toHaveBeenCalledTimes(1);
 });
});

import {writeFile,mkdir} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createApp,allowedRequest} from '../server/index.mjs';
const configFor=(dir:string)=>({deepseekKey:'test',dashscopeKey:'test',dashscopeBase:'https://dashscope.aliyuncs.com',imageModel:'wan2.6-t2i',region:'beijing',port:8787,dataDir:join(dir,'.local'),root:dir});
async function invoke(handler:any,path:string,{method='GET',headers={},payload}:any={}){
 const req=Readable.from(payload===undefined?[]:[Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload))]);Object.assign(req,{url:path,method,headers:{host:'127.0.0.1:8787',...headers},socket:{remoteAddress:'127.0.0.1'}});
 const response:any={headers:{},setHeader(k:string,v:any){this.headers[k]=v},writeHead(status:number,h:any){this.status=status;Object.assign(this.headers,h)},end(value:any){this.body=value?.toString()||''}};
 await handler(req,response);return response;
}
describe('server HTTP boundaries and media',()=>{
 it('rejects attacker origins, invalid hosts, form posts and unknown routes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-http-'));const app=await createApp(configFor(dir));
  expect((await invoke(app.handler,'/api/ai/config',{headers:{origin:'https://attacker.test'}})).status).toBe(403);
  expect((await invoke(app.handler,'/api/ai/config',{headers:{host:'attacker.test'}})).status).toBe(403);
  expect((await invoke(app.handler,'/api/ai/chat',{method:'POST',headers:{'content-type':'application/json'},payload:{}})).status).toBe(403);
  expect((await invoke(app.handler,'/api/ai/chat',{method:'POST',headers:{'x-zc-client':'studio','content-type':'application/x-www-form-urlencoded'},payload:'a=b'})).status).toBe(415);
  expect((await invoke(app.handler,'/api/not-found')).status).toBe(404);app.jobs.close();
 });
 it('returns config without secrets, accepts local preflight and returns structured chat',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-http-'));const p={chat:vi.fn(async()=>({content:'ok'}))};const app=await createApp(configFor(dir),{providers:p});
  const config=await invoke(app.handler,'/api/ai/config');expect(JSON.parse(config.body).configured.deepseek).toBe(true);expect(config.body).not.toContain('"test"');
  expect((await invoke(app.handler,'/api/ai/chat',{method:'OPTIONS',headers:{origin:'http://localhost:5173'}})).status).toBe(204);
  const answer=await invoke(app.handler,'/api/ai/chat',{method:'POST',headers:{'x-zc-client':'studio','content-type':'application/json'},payload:{model:'deepseek-flash',messages:[{role:'user',content:'hello'}]}});expect(JSON.parse(answer.body).content).toBe('ok');app.jobs.close();
 });
 it('only serves dist and registered media, never root credential files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-http-'));await mkdir(join(dir,'dist'));await writeFile(join(dir,'dist/index.html'),'<h1>studio</h1>');await writeFile(join(dir,'private.md'),'secret');const app=await createApp(configFor(dir));
  expect((await invoke(app.handler,'/')).body).toContain('studio');expect((await invoke(app.handler,'/private.md')).status).toBe(404);expect((await invoke(app.handler,'/%2e%2e%2fprivate.md')).status).toBe(403);expect((await invoke(app.handler,'/api/ai/images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404);app.jobs.close();
 });
 it('validates invalid JSON and unknown response formats',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-http-'));const app=await createApp(configFor(dir));const headers={'x-zc-client':'studio','content-type':'application/json'};
  expect((await invoke(app.handler,'/api/ai/chat',{method:'POST',headers,payload:'{bad'})).status).toBe(400);
  expect((await invoke(app.handler,'/api/ai/images',{method:'POST',headers,payload:{prompt:'x'}})).status).toBe(400);
  expect(()=>validateChat({model:'deepseek-flash',messages:[{role:'user',content:'hello'}],responseFormat:'xml'})).toThrow();app.jobs.close();
 });
});
describe('provider protocols and restore',()=>{
 it('loads local key files only as server secrets and honors env precedence',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-config-'));await writeFile(join(dir,'deepseek api key.md'),'sk-fixture-one');await writeFile(join(dir,'阿里bai lian.csv'),'北京,sk-fixture-two');
  const config=await loadConfig(dir,{});expect(config.region).toBe('beijing');expect(config.deepseekKey).toBe('sk-fixture-one');expect((await loadConfig(dir,{DEEPSEEK_API_KEY:'override',DASHSCOPE_API_KEY:'override'})).deepseekKey).toBe('override');expect(JSON.stringify(publicConfig(config))).not.toContain('sk-fixture');
 });
 it('uses async modern endpoint and parses completed image output',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({output:{task_id:'task-one'}}))).mockResolvedValueOnce(new Response(JSON.stringify({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{image:'https://x.aliyuncs.com/a.png'}]}}]}}))).mockResolvedValueOnce(new Response(Buffer.from([137,80,78,71]),{headers:{'content-type':'image/png'}}));
  const p=createProviders(configFor('/tmp'),fetcher);await p.submitImage({prompt:'test',size:'1696*960'});expect(fetcher.mock.calls[0][0]).toContain('/image-generation/generation');expect(JSON.parse(fetcher.mock.calls[0][1].body).parameters.n).toBe(1);const result=await p.pollImage('task-one');expect(result.status).toBe('SUCCEEDED');expect((await p.downloadImage(result.url)).length).toBe(4);
 });
 it('rejects missing credentials, truncated output, missing task IDs and invalid download data',async()=>{
  await expect(createProviders({}).chat({})).rejects.toThrow('尚未');await expect(createProviders({}).submitImage({})).rejects.toThrow('尚未');
  const invalid=createProviders(configFor('/tmp'),async()=>new Response(JSON.stringify({choices:[{finish_reason:'length'}]})));await expect(invalid.chat({messages:[]})).rejects.toThrow('未完整');await expect(invalid.submitImage({})).rejects.toThrow('未得到确认');
  await expect(createProviders(configFor('/tmp'),async()=>new Response('html',{headers:{'content-type':'text/html'}})).downloadImage('https://x.aliyuncs.com/a')).rejects.toThrow('无效');
 });
 it('restores a submitted task without another paid submission',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-restore-'));const p={submitImage:vi.fn(async()=>({taskId:'existing'})),pollImage:vi.fn(async()=>({status:'RUNNING'}))};const a=new ImageJobs(dir,p,{schedule:false});await a.init();const task=await a.create(validateImage({prompt:'hi',workspaceId:'personal',idempotencyKey:'resume'}));await a.process(task.id);
  const b=new ImageJobs(dir,p,{schedule:false});await b.init();await b.process(task.id);expect(p.submitImage).toHaveBeenCalledTimes(1);expect((await b.get(task.id)).status).toBe('running');
 });
});

describe('failure recovery coverage',()=>{
 it('validates every constrained input before sending requests',()=>{
  for(const body of [null,{model:'deepseek-flash',messages:[]},{model:'deepseek-flash',messages:Array(41).fill({})},{model:'deepseek-flash',messages:[{role:'tool',content:'x'}]},{model:'deepseek-flash',messages:Array(6).fill({role:'user',content:'x'.repeat(11000)})}])expect(()=>validateChat(body)).toThrow();
  for(const body of [null,{prompt:'x',workspaceId:'personal',idempotencyKey:'bad/id'},{prompt:'x',workspaceId:'personal',idempotencyKey:'ok',size:'bad'},{prompt:'x',workspaceId:'personal',idempotencyKey:'ok',size:'10000*100'}])expect(()=>validateImage(body)).toThrow();
  for(const [size,expected] of [['3840*960','2560*640'],['960*3840','640*2560'],['1440*1080','1472*1104'],['1080*1920','960*1696'],['1080*1440','1104*1472'],['1080*1080','1280*1280']])expect(validateImage({prompt:'x',workspaceId:'personal',idempotencyKey:'ok',size}).size).toBe(expected);
  expect(()=>safeImageURL('bad')).toThrow();expect(allowedRequest({headers:{host:'localhost:8787',origin:'not-url'}})).toBe(false);
 });
 it('maps upstream status, invalid JSON and network failures to safe messages',async()=>{
  for(const status of [402,429,500]){const p=createProviders(configFor('/tmp'),async()=>new Response('secret',{status}));await expect(p.chat({messages:[]})).rejects.not.toThrow('secret');}
  for(const fetcher of [async()=>{throw new Error('secret')},async()=>new Response('not-json'),async()=>new Response('{}')])await expect(createProviders(configFor('/tmp'),fetcher).chat({messages:[]})).rejects.not.toThrow('secret');
 });
 it('supports explicitly configured legacy image model and refuses arbitrary model names',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({output:{task_id:'old'}})));const p=createProviders({...configFor('/tmp'),imageModel:'wan2.2-t2i-flash'},fetcher);await p.submitImage({prompt:'test',size:'1696*960'});expect(fetcher.mock.calls[0][0]).toContain('text2image/image-synthesis');expect(JSON.parse(fetcher.mock.calls[0][1].body).input.prompt).toBe('test');
  await expect(createProviders({...configFor('/tmp'),imageModel:'unknown'}).submitImage({})).rejects.toThrow('不受支持');
 });
 it('restores interrupted submission as failed and ignores damaged records',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-interrupted-'));await mkdir(join(dir,'tasks'));const id='a'.repeat(32);await writeFile(join(dir,'tasks',id+'.json'),JSON.stringify({id,input:{prompt:'x',workspaceId:'personal'},status:'running'}));await writeFile(join(dir,'tasks','b'.repeat(32)+'.json'),'invalid');await writeFile(join(dir,'tasks','readme.txt'),'ignore');const jobs=new ImageJobs(dir,{}, {schedule:false});await jobs.init();expect((await jobs.get(id)).status).toBe('failed');
 });
 it('handles provider failed, missing output, and transient polling without resubmission',async()=>{
  for(const result of [{status:'FAILED'},{status:'SUCCEEDED'}]){const dir=await mkdtemp(join(tmpdir(),'zc-ai-failure-'));const p={submitImage:vi.fn(async()=>({taskId:'id'})),pollImage:vi.fn(async()=>result)};const jobs=new ImageJobs(dir,p,{schedule:false});await jobs.init();const t=await jobs.create(validateImage({prompt:'x',workspaceId:'personal',idempotencyKey:'failed'}));await jobs.process(t.id);expect((await jobs.get(t.id)).status).toBe('failed');}
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-retry-'));const p={submitImage:vi.fn(async()=>({taskId:'id'})),pollImage:vi.fn(async()=>{throw new Error('network')})};const jobs=new ImageJobs(dir,p,{schedule:false});await jobs.init();const t=await jobs.create(validateImage({prompt:'x',workspaceId:'personal',idempotencyKey:'retry'}));await jobs.process(t.id);expect((await jobs.get(t.id)).status).toBe('running');await jobs.process(t.id);await jobs.process(t.id);expect((await jobs.get(t.id)).status).toBe('failed');expect(p.submitImage).toHaveBeenCalledTimes(1);
 });
 it('rejects oversized payloads, applies rate limit, and creates image tasks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-ai-limit-'));const conf=configFor(dir),jobs=new ImageJobs(conf.dataDir,{}, {schedule:false}),app=await createApp(conf,{providers:{},jobs});const headers={'x-zc-client':'studio','content-type':'application/json'};
  expect((await invoke(app.handler,'/api/ai/chat',{method:'POST',headers,payload:'x'.repeat(270000)})).status).toBe(413);
  const response=await invoke(app.handler,'/api/ai/images',{method:'POST',headers,payload:{prompt:'x',workspaceId:'personal',idempotencyKey:'http'}});expect(response.status).toBe(202);expect((await invoke(app.handler,'/api/ai/images/'+JSON.parse(response.body).id)).status).toBe(200);
  let last;for(let i=0;i<21;i++)last=await invoke(app.handler,'/api/ai/chat',{method:'POST',headers,payload:{}});expect(last.status).toBe(429);expect((await invoke(app.handler,'/',{method:'DELETE'})).status).toBe(405);jobs.close();
 });
});
