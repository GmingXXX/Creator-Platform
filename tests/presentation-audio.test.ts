import {describe,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>vi.fn());
vi.mock('../src/domain/ai-client',()=>({aiRequest:api}));
import {DEFAULT_VOICE} from '../src/domain/presentation-voice';
import {requestPresentationSpeech} from '../src/domain/presentation-audio';
describe('presentation narration audio',()=>{
 it('uses different cache keys and requests for different voice profiles',async()=>{
 api.mockResolvedValue({url:'/api/ai/audio/profile.mp3'});const content='不同讲解语气不能误用缓存';
 await requestPresentationSpeech(content,undefined,false,DEFAULT_VOICE);const count=api.mock.calls.length;
 await requestPresentationSpeech(content,undefined,false,{...DEFAULT_VOICE,style:'warm'});expect(api).toHaveBeenCalledTimes(count+1);
 expect(api).toHaveBeenLastCalledWith('speech',{text:content,speaker:DEFAULT_VOICE.speaker,style:'warm'},undefined);
 });
 it('revalidates a failed audio URL when force is requested',async()=>{api.mockResolvedValue({url:'/api/ai/audio/old.mp3'});await requestPresentationSpeech('需要重新验证音频的讲稿');const count=api.mock.calls.length;api.mockResolvedValue({url:'/api/ai/audio/new.mp3'});await expect(requestPresentationSpeech('需要重新验证音频的讲稿',undefined,true)).resolves.toBe('/api/ai/audio/new.mp3');expect(api).toHaveBeenCalledTimes(count+1);});
 it('sends actual text, caches exact content, and regenerates edited narration',async()=>{api.mockResolvedValue({url:'/api/ai/audio/123456.mp3'});await expect(requestPresentationSpeech('第一版讲稿')).resolves.toBe('/api/ai/audio/123456.mp3');const count=api.mock.calls.length;await requestPresentationSpeech(' 第一版讲稿 ');expect(api).toHaveBeenCalledTimes(count);await requestPresentationSpeech('第二版讲稿');expect(api).toHaveBeenLastCalledWith('speech',{text:'第二版讲稿'},undefined);});
 it('rejects empty or excessive narration before requesting paid service',async()=>{const count=api.mock.calls.length;await expect(requestPresentationSpeech(' ')).rejects.toThrow('讲稿');await expect(requestPresentationSpeech('文'.repeat(6001))).rejects.toThrow('过长');expect(api).toHaveBeenCalledTimes(count);});
 it('rejects untrusted service URLs and preserves request errors',async()=>{api.mockResolvedValue({url:'https://outside.example/track.mp3'});await expect(requestPresentationSpeech('不能导向外站的讲稿')).rejects.toThrow('无效');api.mockRejectedValue(new Error('服务暂不可用'));await expect(requestPresentationSpeech('错误重试讲稿')).rejects.toThrow('暂不可用');});
});
