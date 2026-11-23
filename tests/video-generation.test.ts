import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error server module
import {validateVideo,createVideoProviders,VideoJobs,safeVideoURL} from '../server/video.mjs';
import {Readable} from 'node:stream';
// @ts-expect-error server module
import {createApp} from '../server/index.mjs';

const input={prompt:'云海中的山峰，镜头缓慢前进',workspaceId:'personal',idempotencyKey:'scene:one:v1',duration:5,size:'1280*720'};
const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
describe('video validation and provider',()=>{
 it('rejects missing bodies, malformed URLs, oversized prompts and invalid provider responses',async()=>{
  for(const body of [null,{}, {...input,prompt:'a'.repeat(1501)},{...input,idempotencyKey:'../bad'},{...input,referenceImage:'x'.repeat(3*1024*1024+1)}])expect(()=>validateVideo(body)).toThrow();
  expect(validateVideo({prompt:'p',workspaceId:'personal',idempotencyKey:'one'})).toMatchObject({duration:5,size:'1280*720'});
  for(const url of ['bad','http://x.aliyuncs.com/a','https://x.aliyuncs.com:8000/a','https://user:pass@x.aliyuncs.com/a'])expect(()=>safeVideoURL(url)).toThrow();
  const config={dashscopeKey:'test',dashscopeBase:'https://dashscope.aliyuncs.com'};
  for(const fetcher of [async()=>{throw new Error('secret')},async()=>new Response('not-json'),async()=>new Response('{}'),async()=>new Response('secret',{status:429}),async()=>new Response('secret',{status:500})])await expect(createVideoProviders(config,fetcher).submitVideo(input)).rejects.not.toThrow('secret');
  const p=createVideoProviders(config,async()=>new Response(JSON.stringify({output:{task_status:'SUCCEEDED',video_url:'https://x.aliyuncs.com/a.mp4'}})));
  expect(await p.pollVideo('task')).toMatchObject({status:'SUCCEEDED',url:'https://x.aliyuncs.com/a.mp4'});
  expect(await createVideoProviders(config,async()=>new Response('{}')).pollVideo('task')).toMatchObject({status:undefined});
  await expect(createVideoProviders(config,async()=>{throw new Error('secret')}).downloadVideo('https://x.aliyuncs.com/a.mp4')).rejects.toThrow('保存失败');
  await expect(createVideoProviders(config,async()=>new Response('bad',{headers:{'Content-Type':'video/mp4'}})).downloadVideo('https://x.aliyuncs.com/a.mp4')).rejects.toThrow('MP4');
 });
 it('validates request and blocks unsupported media/parameters',()=>{
  expect(validateVideo(input)).toMatchObject(input);
  for(const patch of [{duration:999},{size:'999*999'},{prompt:''},{referenceImage:'http://localhost/private'},{workspaceId:'../secret'},{referenceImage:'data:text/html;base64,AAAA'}])expect(()=>validateVideo({...input,...patch})).toThrow();
  expect(()=>safeVideoURL('https://example.com/a.mp4')).toThrow();
  expect(()=>safeVideoURL('https://evil.aliyuncs.com@127.0.0.1/a.mp4')).toThrow();
 });
 it('submits async t2v and i2v with distinct model and size parameters',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({output:{task_id:'provider1'}}),{status:200}));
  const providers=createVideoProviders({dashscopeKey:'test-key',dashscopeBase:'https://dashscope.aliyuncs.com'},fetcher);
  await providers.submitVideo(validateVideo(input));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({model:'wan2.6-t2v',parameters:{duration:5,size:'1280*720'}});
  expect(fetcher.mock.calls[0][1].headers['X-DashScope-Async']).toBe('enable');
  fetcher.mockResolvedValue(new Response(JSON.stringify({output:{task_id:'provider2'}}),{status:200}));
  await providers.submitVideo(validateVideo({...input,referenceImage:'data:image/png;base64,iVBORw0KGgo='}));
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({model:'wan2.6-i2v',input:{img_url:'data:image/png;base64,iVBORw0KGgo='},parameters:{resolution:'720P'}});
  expect(JSON.parse(fetcher.mock.calls[1][1].body).parameters.size).toBeUndefined();
 });
 it('sanitizes provider errors and persists actual media bytes',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('secret echoed',{status:401}));
  const providers=createVideoProviders({dashscopeKey:'test-key',dashscopeBase:'https://dashscope.aliyuncs.com'},fetcher);
  await expect(providers.submitVideo(input)).rejects.toThrow('密钥');
  fetcher.mockResolvedValue(new Response(Buffer.from('0000ftypisom'),{headers:{'Content-Type':'video/mp4'}}));
  expect((await providers.downloadVideo('https://result.oss.aliyuncs.com/a.mp4')).length).toBe(12);
  fetcher.mockResolvedValue(new Response('html',{headers:{'Content-Type':'text/html'}}));
  await expect(providers.downloadVideo('https://result.oss.aliyuncs.com/a.mp4')).rejects.toThrow();
 });
});
describe('video recovery and HTTP integration',()=>{
 it('retries only an existing provider task after polling failure',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-'));dirs.push(dir);
  const providers={submitVideo:vi.fn().mockResolvedValue({taskId:'p1'}),pollVideo:vi.fn().mockRejectedValue(new Error('network secret')),downloadVideo:vi.fn().mockResolvedValue(Buffer.from('0000ftypisom'))};
  const jobs=new VideoJobs(dir,providers,{schedule:false});await jobs.init();const task=await jobs.create(input);
  await jobs.process(task.id);await jobs.process(task.id);await jobs.process(task.id);
  expect(await jobs.get(task.id)).toMatchObject({status:'failed',retryable:true});
  expect((await jobs.get(task.id)).error).not.toContain('secret');
  await jobs.create(input);providers.pollVideo.mockResolvedValue({status:'SUCCEEDED',url:'https://result.oss.aliyuncs.com/a.mp4'});await jobs.process(task.id);
  expect(await jobs.get(task.id)).toMatchObject({status:'succeeded'});expect(providers.submitVideo).toHaveBeenCalledTimes(1);
 });
 it('restores uncertain submit, handles terminal provider failure and missing files honestly',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-'));dirs.push(dir);await mkdir(join(dir,'video/tasks'),{recursive:true});
  const id='a'.repeat(32);await writeFile(join(dir,'video/tasks',id+'.json'),JSON.stringify({id,input,status:'running'}));await writeFile(join(dir,'video/tasks','b'.repeat(32)+'.json'),'bad');
  const providers={submitVideo:vi.fn().mockResolvedValue({taskId:'p2'}),pollVideo:vi.fn().mockResolvedValue({status:'FAILED'})};
  const jobs=new VideoJobs(dir,providers,{schedule:false});await jobs.init();expect(await jobs.get(id)).toMatchObject({status:'failed',retryable:false});
  const failed=await jobs.create({...input,idempotencyKey:'failed'});await jobs.process(failed.id);expect(await jobs.get(failed.id)).toMatchObject({status:'failed'});
  providers.pollVideo.mockResolvedValue({status:'SUCCEEDED'});const missing=await jobs.create({...input,idempotencyKey:'missing'});await jobs.process(missing.id);expect((await jobs.get(missing.id)).error).toContain('没有返回');
  await expect(jobs.get('unknown')).rejects.toThrow('未找到');
 });
 it('submits, polls and serves seekable mp4 while validating request origins and payloads',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-http-'));dirs.push(dir);
  const providers={submitVideo:vi.fn().mockResolvedValue({taskId:'p1'}),pollVideo:vi.fn().mockResolvedValue({status:'SUCCEEDED',url:'https://result.oss.aliyuncs.com/a.mp4'}),downloadVideo:vi.fn().mockResolvedValue(Buffer.from('0000ftypisom'))};
  const videoJobs=new VideoJobs(dir,providers,{schedule:false});const app=await createApp({root:dir,dataDir:dir,port:8787,dashscopeKey:'test'},{videoJobs});
  const invoke=async(path:string,method='GET',payload?:unknown,extra={})=>{const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);Object.assign(req,{url:path,method,headers:{host:'127.0.0.1:8787','content-type':'application/json','x-zc-client':'studio',...extra},socket:{remoteAddress:'127.0.0.1'}});const res:any={headers:{},setHeader(k:string,v:string){this.headers[k]=v},writeHead(status:number,h:object){this.status=status;Object.assign(this.headers,h)},end(value:any){this.body=value?.toString()||''}};await app.handler(req,res);return res;};
  try{
   expect((await invoke('/api/ai/videos','POST',input,{origin:'https://attacker.test'})).status).toBe(403);
   expect((await invoke('/api/ai/videos','POST',{...input,duration:999})).status).toBe(400);
   const response=await invoke('/api/ai/videos','POST',input);expect(response.status).toBe(202);const id=JSON.parse(response.body).id;
   expect((await invoke(`/api/ai/video-media/${id}.mp4`)).status).toBe(409);await videoJobs.process(id);
   expect(JSON.parse((await invoke(`/api/ai/videos/${id}`)).body).status).toBe('succeeded');
   const media=await invoke(`/api/ai/video-media/${id}.mp4`,'GET',undefined,{range:'bytes=4-7'});expect(media.status).toBe(206);expect(media.body).toBe('ftyp');
   expect((await invoke(`/api/ai/video-media/${id}.mp4`,'HEAD')).body).toBe('');
   expect((await invoke(`/api/ai/video-media/${id}.mp4`,'GET',undefined,{range:'bytes=999-'})).status).toBe(416);
  }finally{app.jobs.close();videoJobs.close();}
 });
 it('loads local first frame and rejects unknown model or missing credentials',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-reference-'));dirs.push(dir);await mkdir(join(dir,'media'));const id='c'.repeat(32);await writeFile(join(dir,'media',`${id}.png`),Buffer.from('png'));
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({output:{task_id:'x'}})));
  const p=createVideoProviders({dashscopeKey:'test',dashscopeBase:'https://dashscope.aliyuncs.com',dataDir:dir},fetcher);
  await p.submitVideo({...input,referenceImage:`/api/ai/media/${id}.png`});expect(JSON.parse(fetcher.mock.calls[0][1].body).input.img_url).toBe('data:image/png;base64,cG5n');
  await expect(p.submitVideo({...input,referenceImage:`/api/ai/media/${'d'.repeat(32)}.png`})).rejects.toThrow('不存在');
  await expect(createVideoProviders({}).submitVideo(input)).rejects.toThrow('尚未配置');
  await expect(createVideoProviders({dashscopeKey:'test',videoModel:'unknown'}).submitVideo(input)).rejects.toThrow('不受支持');
 });
});
describe('durable video tasks',()=>{
 it('deduplicates concurrent creates, times out existing jobs and limits processing concurrency',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-'));dirs.push(dir);
  const providers={submitVideo:vi.fn().mockResolvedValue({taskId:'p1'}),pollVideo:vi.fn().mockResolvedValue({status:'RUNNING'})};
  const jobs=new VideoJobs(dir,providers,{schedule:false});await jobs.init();
  const [a,b]=await Promise.all([jobs.create(input),jobs.create(input)]);expect(a.id).toBe(b.id);
  await jobs.process('unknown');jobs.processing.add(a.id);await jobs.process(a.id);jobs.processing.delete(a.id);expect(providers.submitVideo).not.toHaveBeenCalled();
  jobs.processing.add('busy1');jobs.processing.add('busy2');await jobs.process(a.id);jobs.processing.clear();expect(providers.submitVideo).not.toHaveBeenCalled();
  await jobs.process(a.id);await jobs.save({...jobs.tasks.get(a.id),createdAt:'2000-01-01T00:00:00Z'});await jobs.process(a.id);expect((await jobs.get(a.id)).error).toContain('超时');
  const scheduled=new VideoJobs(dir,providers,{pollMs:1});await scheduled.init();scheduled.later(a.id,1);await new Promise(resolve=>setTimeout(resolve,10));scheduled.close();
 });
 it('deduplicates submits, saves final mp4 and resumes polling after restart',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-'));dirs.push(dir);
  const providers={submitVideo:vi.fn().mockResolvedValue({taskId:'p1'}),pollVideo:vi.fn().mockResolvedValue({status:'RUNNING'}),downloadVideo:vi.fn().mockResolvedValue(Buffer.from('0000ftypisom'))};
  const jobs=new VideoJobs(dir,providers,{schedule:false});await jobs.init();
  const task=await jobs.create(validateVideo(input));expect((await jobs.create(validateVideo(input))).id).toBe(task.id);
  await jobs.process(task.id);expect(providers.submitVideo).toHaveBeenCalledTimes(1);
  const resumed=new VideoJobs(dir,providers,{schedule:false});await resumed.init();
  providers.pollVideo.mockResolvedValue({status:'SUCCEEDED',url:'https://result.oss.aliyuncs.com/a.mp4'});
  await resumed.process(task.id);expect(providers.submitVideo).toHaveBeenCalledTimes(1);
  expect(await resumed.get(task.id)).toMatchObject({status:'succeeded',url:`/api/ai/video-media/${task.id}.mp4`});
  expect((await readFile(join(dir,'video','media',`${task.id}.mp4`))).length).toBe(12);
  await expect(resumed.create({...input,prompt:'changed'})).rejects.toThrow();
 });
 it('never resubmits uncertain paid requests and resumes retryable downloads only',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-video-'));dirs.push(dir);
  const providers={submitVideo:vi.fn().mockRejectedValue(new Error('network')),pollVideo:vi.fn(),downloadVideo:vi.fn()};
  const jobs=new VideoJobs(dir,providers,{schedule:false});await jobs.init();const task=await jobs.create(input);await jobs.process(task.id);
  expect(await jobs.get(task.id)).toMatchObject({status:'failed',retryable:false});await jobs.create(input);await jobs.process(task.id);expect(providers.submitVideo).toHaveBeenCalledTimes(1);
 });
});
