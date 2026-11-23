import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {SpeechService,validateSpeech,safeSpeechURL,speechRequest} from '../server/speech.mjs';
import {createApp} from '../server/index.mjs';
import {loadConfig,publicConfig} from '../server/config.mjs';
const wav=()=>{const bytes=Buffer.alloc(240);bytes.write('RIFF');bytes.writeUInt32LE(232,4);bytes.write('WAVE',8);return bytes;};
const url='https://voice-125.cos.ap-beijing.myqcloud.com/sample.wav?token=private';
const response=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const setup=async(fetcher:any)=>{const dir=await mkdtemp(join(tmpdir(),'zc-speech-'));const config={root:dir,dataDir:join(dir,'.local'),speechKey:'secret-fixture-key',port:8787};const service=new SpeechService(config,{fetcher});await service.init();return {config,service,dir};};
async function invoke(handler:any,path:string,{method='GET',headers={},payload}:any={}){
 const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);Object.assign(req,{url:path,method,headers:{host:'127.0.0.1:8787',...headers},socket:{remoteAddress:'127.0.0.1'}});
 const res:any={headers:{},setHeader(k:string,v:unknown){this.headers[k]=v},writeHead(status:number,h:unknown){this.status=status;Object.assign(this.headers,h)},end(value:any){this.bytes=value?Buffer.from(value):Buffer.alloc(0);this.body=this.bytes.toString()}};await handler(req,res);return res;
}
describe('real narration service',()=>{
 it('validates text and fixed request settings, not caller-selected URLs or speakers',()=>{
  for(const input of [null,{}, {text:''},{text:'x'.repeat(6001)},{text:3},{text:'hello',speaker:'other'},{text:'hello',url:'http://localhost'}])expect(()=>validateSpeech(input)).toThrow();
  expect(validateSpeech({text:'  你好\n世界  '})).toEqual({text:'你好\n世界'});expect(speechRequest('你好').speaker).toBe('zh_male_ruyayichen_uranus_bigtts');
  for(const address of ['http://localhost/a','https://myqcloud.com.evil.test/a','https://x.myqcloud.com:8080/a','https://user:pw@x.myqcloud.com/a','bad'])expect(()=>safeSpeechURL(address)).toThrow();
  expect(safeSpeechURL(url)).toBe(url);
 });
 it('accepts only the verified speaker and bounded voice styles, distinct cached profiles',async()=>{
  expect(validateSpeech({text:'你好',speaker:'zh_male_ruyayichen_uranus_bigtts',style:'warm'})).toMatchObject({style:'warm'});
  expect(speechRequest('你好',{style:'warm'}).additions.context_texts[0]).toContain('亲切');
  expect(speechRequest('你好',{style:'formal'}).additions.context_texts[0]).toContain('庄重');
  for(const input of [{text:'x',style:'evil'},{text:'x',pitch:12},{text:'x',speaker:'cloned'}])expect(()=>validateSpeech(input)).toThrow();
  const fetcher=vi.fn().mockImplementation(async(input:string)=>input.includes('/tts')?response({code:0,audio_url:url}):new Response(wav(),{headers:{'Content-Type':'audio/wav'}}));
  const {service}=await setup(fetcher);const a=await service.synthesize({text:'同一句讲稿',style:'warm'}),b=await service.synthesize({text:'同一句讲稿',style:'formal'});expect(a.url).not.toBe(b.url);expect(fetcher).toHaveBeenCalledTimes(4);
 });
 it('deduplicates live and restarted requests, keeps token only in synthesis POST',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response({code:0,audio_url:url})).mockResolvedValueOnce(new Response(wav(),{headers:{'Content-Type':'audio/wav'}}));const {service,config}=await setup(fetcher);
  const [a,b]=await Promise.all([service.synthesize({text:'企业成果介绍。'}),service.synthesize({text:'企业成果介绍。'})]);expect(a.url).toBe(b.url);expect(fetcher).toHaveBeenCalledTimes(2);expect(a.url).toMatch(/^\/api\/ai\/audio\/[a-f0-9]{64}\.wav$/);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-fixture-key');expect(fetcher.mock.calls[1][1].headers).toBeUndefined();expect(JSON.stringify(a)).not.toMatch(/secret|myqcloud|token/);
  const restored=new SpeechService(config,{fetcher});await restored.init();expect((await restored.synthesize({text:'企业成果介绍。'})).cached).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);expect((await restored.readAudio(a.id,'wav')).bytes).toEqual(wav());
 });
 it('retries only the download after a completed paid synthesis',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response({code:0,audio_url:url})).mockRejectedValueOnce(new Error('private transport')).mockResolvedValueOnce(new Response(wav(),{headers:{'Content-Type':'audio/wav'}}));const {service,config}=await setup(fetcher);
  await expect(service.synthesize({text:'下载重试'})).rejects.toThrow('下载');const restored=new SpeechService(config,{fetcher});await restored.init();await restored.synthesize({text:'下载重试'});expect(fetcher.mock.calls.filter(call=>call[0].endsWith('/tts'))).toHaveLength(1);
 });
 it('does not repeat a possibly billed submission after timeout or restart',async()=>{
  const fetcher=vi.fn(async()=>{throw new Error('secret-fixture-key')});const {service,config}=await setup(fetcher);
  await expect(service.synthesize({text:'不重复扣费'})).rejects.not.toThrow('secret-fixture-key');await expect(service.synthesize({text:'不重复扣费'})).rejects.toThrow('无法确认');
  const restored=new SpeechService(config,{fetcher});await restored.init();await expect(restored.synthesize({text:'不重复扣费'})).rejects.toThrow('无法确认');expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rejects invalid upstream output and audio, sanitizes credentials and limits bytes',async()=>{
  for(const output of [response({code:9,message:'secret-fixture-key'}),response({code:0,audio_url:'http://localhost/a'}),new Response('secret-fixture-key',{status:401}),new Response('invalid json')]){
   const {service}=await setup(vi.fn(async()=>output));await expect(service.synthesize({text:'测试'})).rejects.not.toThrow('secret-fixture-key');
  }
  for(const audio of [new Response('<html>not audio</html>',{headers:{'content-type':'text/html'}}),new Response(Buffer.alloc(240),{headers:{'content-type':'audio/wav'}}),new Response(wav(),{headers:{'content-type':'audio/wav','content-length':'99999999'}})]){
   const {service}=await setup(vi.fn().mockResolvedValueOnce(response({code:0,audio_url:url})).mockResolvedValueOnce(audio));await expect(service.synthesize({text:'测试'})).rejects.toThrow();
  }
 });
 it('limits concurrent new submissions and rejects missing credentials',async()=>{
  const waiters:Array<(v:Response)=>void>=[];const fetcher=vi.fn(()=>new Promise<Response>(resolve=>waiters.push(resolve)));const {service}=await setup(fetcher);
  const p1=service.synthesize({text:'第一段'}),p2=service.synthesize({text:'第二段'});await expect(service.synthesize({text:'第三段'})).rejects.toThrow('其他讲解');
  await vi.waitFor(()=>expect(waiters).toHaveLength(2));waiters.forEach(done=>done(new Response('no',{status:401})));await Promise.allSettled([p1,p2]);
  const missing=new SpeechService({dataDir:join(tmpdir(),'unused-speech')},{fetcher});await expect(missing.synthesize({text:'测试'})).rejects.toThrow('尚未配置');
 });
 it('loads a private file only at server startup and exposes availability only',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zc-speech-config-')),file=join(dir,'key.md');await writeFile(file,'Bearer private-speech-key');const config=await loadConfig(dir,{UNIDTAI_TTS_KEY_FILE:file});expect(config.speechKey).toBe('private-speech-key');expect(publicConfig(config).configured.speech).toBe(true);expect(JSON.stringify(publicConfig(config))).not.toContain('private-speech-key');
 });
 it('HTTP serves verified cached audio with ranges and rejects foreign origins and paths',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response({code:0,audio_url:url})).mockResolvedValueOnce(new Response(wav(),{headers:{'content-type':'audio/wav'}}));const {config,service}=await setup(fetcher);const app=await createApp(config,{providers:{},speech:service});const headers={'x-zc-client':'studio','content-type':'application/json'};
  const created=await invoke(app.handler,'/api/ai/speech',{method:'POST',headers,payload:{text:'真实讲解'}});expect(created.status).toBe(200);const data=JSON.parse(created.body);
  const audio=await invoke(app.handler,data.url,{headers:{range:'bytes=0-11'}});expect(audio.status).toBe(206);expect(audio.bytes.toString()).toContain('WAVE');expect(audio.headers['Content-Length']).toBe(12);
  expect((await invoke(app.handler,data.url,{method:'HEAD'})).bytes).toHaveLength(0);expect((await invoke(app.handler,data.url,{headers:{range:'bytes=9999-'}})).status).toBe(416);
  expect((await invoke(app.handler,'/api/ai/speech',{method:'POST',headers:{...headers,origin:'https://evil.test'},payload:{text:'坏请求'}})).status).toBe(403);
  expect((await invoke(app.handler,'/api/ai/audio/'+'a'.repeat(64)+'.wav')).status).toBe(404);app.jobs.close();
 });
});
