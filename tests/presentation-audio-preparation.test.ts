import {describe,expect,it,vi} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {readPresentationStudio} from '../src/features/studios/presentation-studio';
import {preparePresentationAudio} from '../src/features/studios/presentation-audio-preparation';
const fixture=()=>{const work=createSceneWork({title:'测试',kind:'presentation',type:'媒体叙事型',styleId:'',width:1920,height:1080,blank:true});return {...work,pages:[{id:'page',name:'测试页',background:'#fff',nodes:[],notes:'第一句。第二句。第三句。第四句。第五句。第六句。'}]};};
const lines=(work:ReturnType<typeof fixture>)=>readPresentationStudio(work).pages.page.sentences;
describe('bounded presentation audio preparation',()=>{
 it('prepares at most four sentences and leaves remaining scripts available for on-demand playback',async()=>{
  const work=fixture(),snapshot=structuredClone(work),speech=vi.fn(async()=>'/api/ai/speech/ready.mp3');
  const result=await preparePresentationAudio(work,{speech});
  expect(speech).toHaveBeenCalledTimes(4);expect(result.pending).toBe(2);expect(result.status).toBe('pending');
  expect(lines(result.work).filter(line=>line.audioUrl)).toHaveLength(4);expect(result.work.pages[0].notes).toBe(work.pages[0].notes);expect(work).toEqual(snapshot);
 });
 it('returns successes and all pages on rate limiting and resumes without regenerating saved sentences',async()=>{
  const speech=vi.fn().mockResolvedValueOnce('/api/ai/speech/first.mp3').mockRejectedValueOnce(new Error('操作过于频繁，请稍后重试'));
  const first=await preparePresentationAudio(fixture(),{speech});
  expect(first.status).toBe('failed');expect(first.pending).toBe(5);expect(first.message).toContain('讲解音频');expect(first.message).toContain('稍后');
  expect(lines(first.work)[0].audioUrl).toBe('/api/ai/speech/first.mp3');
  const retry=vi.fn(async()=>'/api/ai/speech/rest.mp3');
  const next=await preparePresentationAudio(first.work,{speech:retry,maxRequests:6});
  expect(retry).toHaveBeenCalledTimes(5);expect(retry.mock.calls.flat()).not.toContain('第一句。');expect(next.status).toBe('complete');expect(next.pending).toBe(0);
 });
 it('retains completed audio when cancelled and does not request remaining sentences',async()=>{
  const controller=new AbortController(),speech=vi.fn(async()=>{controller.abort();return '/api/ai/speech/first.mp3';});
  const result=await preparePresentationAudio(fixture(),{speech,signal:controller.signal});
  expect(speech).toHaveBeenCalledTimes(1);expect(result.status).toBe('paused');expect(result.pending).toBe(5);expect(lines(result.work)[0].audioUrl).toBeTruthy();
 });
 it('reports completed works without extra requests and records the voice profile for playback reuse',async()=>{
  const speech=vi.fn(async()=>'/api/ai/speech/all.mp3');
  const first=await preparePresentationAudio(fixture(),{speech,maxRequests:6});
  expect(lines(first.work).every(line=>line.audioProfileKey)).toBe(true);
  speech.mockClear();const result=await preparePresentationAudio(first.work,{speech});
  expect(result.status).toBe('complete');expect(speech).not.toHaveBeenCalled();
 });
 it('checks access before a request and does not treat permission failure as a recoverable service failure',async()=>{
  const speech=vi.fn(),beforeRequest=()=>{throw new Error('无权限');};
  await expect(preparePresentationAudio(fixture(),{speech,beforeRequest})).rejects.toThrow('无权限');expect(speech).not.toHaveBeenCalled();
 });
});
