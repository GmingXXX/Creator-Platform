import {AIRequestError} from '../src/domain/ai-client';
import {beforeEach,it,expect,vi} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {beginBackground,advanceBackground,applyBackground} from '../src/domain/background-generation';
const api=vi.hoisted(()=>({aiRequest:vi.fn()}));vi.mock('../src/domain/ai-client',async original=>({...await original<object>(),...api}));
beforeEach(()=>{useStudio.setState(createInitialData());const s=useStudio.getState();useStudio.setState({runs:[{id:'bg-run',workspaceId:'personal',model:'deepseek-flash',prompt:'企业历史',styleId:'technology',skillIds:[],attachmentIds:[],status:'complete',step:5,outputKind:'exhibit',workId:s.works[0].id,createdAt:''}]});api.aiRequest.mockReset();});
it('validates a prompt before starting and keeps the original work unchanged until adoption',async()=>{
 const before=structuredClone(useStudio.getState().works[0]);expect(()=>beginBackground('bg-run','')).toThrow();
 beginBackground('bg-run','深蓝、右侧装饰，左侧留白');api.aiRequest.mockResolvedValue({id:'remote',status:'succeeded',url:'/api/ai/media/remote.png'});await advanceBackground('bg-run');
 const s=useStudio.getState(),r=s.runs[0];expect(r.backgroundDraft?.status).toBe('ready');expect(s.works[0]).toEqual(before);expect(r.generatedBackgroundIds).toHaveLength(1);
 applyBackground('bg-run',r.generatedBackgroundIds![0]);const work=useStudio.getState().works.find(w=>w.id===before.id)!;expect(work.pages[0].backgroundImage).toBe('/api/ai/media/remote.png');expect(work.pages[0].nodes).toEqual(before.pages[0].nodes);
});
it('reuses a submission key after uncertain response and polls known tasks without resubmitting',async()=>{
 beginBackground('bg-run','浅色纸张纹理');api.aiRequest.mockRejectedValueOnce(new Error('网络中断'));await advanceBackground('bg-run');const key=useStudio.getState().runs[0].backgroundDraft!.requestId;expect(()=>beginBackground('bg-run','另一个提示词')).toThrow();
 api.aiRequest.mockResolvedValueOnce({id:'job',status:'queued'}).mockResolvedValueOnce({id:'job',status:'running'});await advanceBackground('bg-run');await advanceBackground('bg-run');expect(api.aiRequest.mock.calls[1][1].idempotencyKey).toBe(key);expect(api.aiRequest.mock.calls[2][0]).toBe('images/job');
 expect(()=>beginBackground('bg-run','另一个提示词')).toThrow();
});
it('keeps old versions when generating another variant, and rejects unsafe output URLs',async()=>{
 beginBackground('bg-run','工业背景');api.aiRequest.mockResolvedValueOnce({id:'a',status:'succeeded',url:'/api/ai/media/a.png'});await advanceBackground('bg-run');const first=useStudio.getState().runs[0].generatedBackgroundIds![0];
 beginBackground('bg-run','工业背景，调整：更暗一些');api.aiRequest.mockResolvedValueOnce({id:'b',status:'succeeded',url:'https://invalid.test/b.png'});await advanceBackground('bg-run');expect(useStudio.getState().runs[0].backgroundDraft?.status).toBe('failed');expect(useStudio.getState().assets.find(a=>a.id===first)).toBeTruthy();
});

it('resumes a server-side failed query with the original immutable request',async()=>{
 beginBackground('bg-run','深蓝背景');api.aiRequest.mockResolvedValueOnce({id:'job',status:'failed',retryable:true});await advanceBackground('bg-run');
 api.aiRequest.mockResolvedValueOnce({id:'job',status:'running'});await advanceBackground('bg-run');expect(api.aiRequest.mock.calls[1]).toEqual(api.aiRequest.mock.calls[0]);
});
it('coalesces concurrent requests and does not overwrite a replaced draft',async()=>{
 beginBackground('bg-run','工业背景');let finish!:(v:any)=>void;api.aiRequest.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));
 const pending=advanceBackground('bg-run');await advanceBackground('bg-run');expect(api.aiRequest).toHaveBeenCalledTimes(1);expect(()=>beginBackground('bg-run','新背景')).toThrow();
 const r=useStudio.getState().runs[0];useStudio.setState({runs:[{...r,backgroundDraft:undefined}]});finish({id:'old',status:'succeeded',url:'/api/ai/media/old.png'});await pending;expect(useStudio.getState().runs[0].generatedBackgroundIds).toBeUndefined();
});
it('rejects removed works, reference-only assets and inaccessible team assets during adoption',async()=>{
 beginBackground('bg-run','工业背景');api.aiRequest.mockResolvedValue({id:'a',status:'succeeded',url:'/api/ai/media/a.png'});await advanceBackground('bg-run');const s=useStudio.getState(),r=s.runs[0],a=s.assets.find(a=>a.id===r.backgroundDraft!.assetId)!;
 expect(()=>applyBackground('missing',a.id)).toThrow();s.addAsset({...a,id:'other',workspaceId:'dongguan'});expect(()=>applyBackground(r.id,'other')).toThrow();
 s.addAsset({...a,id:'reference',metadata:{...a.metadata,business:{...a.metadata!.business!,usage:'reference'}}});expect(()=>applyBackground(r.id,'reference')).toThrow();
 useStudio.setState({works:s.works.map(w=>w.id===r.workId?{...w,deletedAt:new Date().toISOString()}:w)});expect(()=>applyBackground(r.id,a.id)).toThrow();
});
it('supports standalone image results and ignores ready or terminal tasks',async()=>{
 const r=useStudio.getState().runs[0];useStudio.setState({runs:[{...r,workId:undefined,outputKind:'image'}]});expect(()=>beginBackground('missing','x')).toThrow();expect(()=>beginBackground(r.id,'x'.repeat(2001))).toThrow();await advanceBackground('missing');
 beginBackground(r.id,'科技背景');api.aiRequest.mockResolvedValueOnce({id:'a',status:'succeeded',url:'/api/ai/media/a.png'});await advanceBackground(r.id);const a=useStudio.getState().runs[0].backgroundDraft!.assetId!;applyBackground(r.id,a);expect(useStudio.getState().runs[0].assetId).toBe(a);await advanceBackground(r.id);expect(api.aiRequest).toHaveBeenCalledTimes(1);
 beginBackground(r.id,'重生成');api.aiRequest.mockResolvedValueOnce({id:'b',status:'failed',retryable:false});await advanceBackground(r.id);await advanceBackground(r.id);expect(api.aiRequest).toHaveBeenCalledTimes(2);
});

it('allows correcting a rejected submission and ignores stale failed responses',async()=>{
 beginBackground('bg-run','原始描述');api.aiRequest.mockRejectedValueOnce(new AIRequestError('参数不合法',400));await advanceBackground('bg-run');expect(useStudio.getState().runs[0].backgroundDraft?.retryable).toBe(false);expect(()=>beginBackground('bg-run','修改后的描述')).not.toThrow();
 let reject!:(e:Error)=>void;api.aiRequest.mockImplementationOnce(()=>new Promise((_,r)=>reject=r));const pending=advanceBackground('bg-run');const r=useStudio.getState().runs[0];useStudio.setState({runs:[{...r,backgroundDraft:undefined}]});reject(new Error('旧网络错误'));await pending;expect(useStudio.getState().runs[0].backgroundDraft).toBeUndefined();
});
it('rejects unsupported custom aspect ratios before making a request',()=>{
 const s=useStudio.getState();useStudio.setState({works:s.works.map(w=>w.id===s.runs[0].workId?{...w,width:9000,height:1000}:w)});expect(()=>beginBackground('bg-run','全景背景')).toThrow('1:4');expect(api.aiRequest).not.toHaveBeenCalled();
});
it.each(['succeeded','network-error'])('discards late background %s when request ownership moved spaces',async status=>{
 beginBackground('bg-run','旧空间背景');let finish!:(value:any)=>void,reject!:(error:Error)=>void;
 api.aiRequest.mockImplementationOnce(()=>new Promise((resolve,rejectFn)=>{finish=resolve;reject=rejectFn}));
 const pending=advanceBackground('bg-run'),state=useStudio.getState(),count=state.assets.length;
 useStudio.setState({runs:state.runs.map(run=>({...run,workspaceId:'xintai'}))});
 if(status==='succeeded')finish({id:'old',status:'succeeded',url:'/api/ai/media/old.png'});else reject(new Error('旧请求失败'));
 await pending;expect(useStudio.getState().assets).toHaveLength(count);expect(useStudio.getState().runs[0].backgroundDraft?.status).toBe('pending');expect(useStudio.getState().runs[0].generatedBackgroundIds).toBeUndefined();
});
