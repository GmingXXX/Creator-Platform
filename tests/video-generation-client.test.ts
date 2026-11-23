import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {generateVideo} from '../src/domain/video-generation';
import {AIRequestError} from '../src/domain/ai-client';
const api=vi.hoisted(()=>({aiRequest:vi.fn()}));vi.mock('../src/domain/ai-client',async original=>({...await original<object>(),...api}));
const id='a'.repeat(32),options={workspaceId:'personal',requestKey:'video:1',reviewSlot:'scene-one'},ready={id,workspaceId:'personal',status:'succeeded',url:`/api/ai/video-media/${id}.mp4`,duration:5,size:'1280*720',model:'wan2.6-t2v'};
beforeEach(()=>{useStudio.setState(createInitialData());api.aiRequest.mockReset();});afterEach(()=>vi.useRealTimers());
it('saves a real video asset with stable slot and returns existing accessible version',async()=>{
 api.aiRequest.mockResolvedValue(ready);const asset=await generateVideo('云海山峰',options);expect(asset.kind).toBe('video');expect(asset.package?.params.reviewSlot).toBe('scene-one');expect(asset.src).toBe(ready.url);expect(await generateVideo('云海山峰',options)).toEqual(asset);
});
it('rejects spoofed task identity, cross-space results, mismatched URL and blocked existing assets',async()=>{
 for(const patch of [{id:'bad'},{workspaceId:'other'},{url:`/api/ai/video-media/${'b'.repeat(32)}.mp4`},{url:'https://example.com/x.mp4'},{status:'unknown'}]){api.aiRequest.mockResolvedValue({...ready,...patch});await expect(generateVideo('云海山峰',options)).rejects.toThrow();}
 api.aiRequest.mockResolvedValue(ready);const asset=await generateVideo('云海山峰',options);useStudio.setState({assets:useStudio.getState().assets.map(a=>a.id===asset.id?{...a,archived:true}:a)});await expect(generateVideo('云海山峰',options)).rejects.toThrow('权限');
});
it('polls the same server task, reports progress, and does not resubmit on terminal failure',async()=>{
 vi.useFakeTimers();api.aiRequest.mockResolvedValueOnce({...ready,status:'running',url:undefined}).mockResolvedValueOnce(ready);const onProgress=vi.fn();const pending=generateVideo('云海山峰',{...options,onProgress});await vi.advanceTimersByTimeAsync(4000);expect((await pending).src).toBe(ready.url);expect(api.aiRequest.mock.calls[1][0]).toBe(`videos/${id}`);expect(api.aiRequest.mock.calls[1][1]).toBeUndefined();expect(onProgress).toHaveBeenCalledTimes(2);
 api.aiRequest.mockResolvedValue({...ready,status:'failed',error:'额度不足'});await expect(generateVideo('云海山峰',options)).rejects.toThrow('额度不足');
});
it('keeps the POST idempotency key after lost acknowledgement and stops waiting on cancellation',async()=>{
 vi.useFakeTimers();api.aiRequest.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(ready);const pending=generateVideo('云海山峰',options);await vi.advanceTimersByTimeAsync(4000);await pending;expect(api.aiRequest.mock.calls[0][1].idempotencyKey).toBe(api.aiRequest.mock.calls[1][1].idempotencyKey);
 api.aiRequest.mockResolvedValue({...ready,status:'running'});const controller=new AbortController();const stopped=generateVideo('云海山峰',options,controller.signal);const assertion=expect(stopped).rejects.toThrow('停止');await vi.advanceTimersByTimeAsync(1);controller.abort();await assertion;
});
it('validates total prompt before POST and fails deterministic API errors without retry',async()=>{
 await expect(generateVideo('x'.repeat(1501),options)).rejects.toThrow('1500');expect(api.aiRequest).not.toHaveBeenCalled();api.aiRequest.mockRejectedValue(new AIRequestError('参数错误',400));await expect(generateVideo('云海山峰',options)).rejects.toThrow('参数错误');expect(api.aiRequest).toHaveBeenCalledTimes(1);
});
