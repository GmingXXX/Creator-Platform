import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import type {Run} from '../src/domain/types';
const api=vi.hoisted(()=>({aiChat:vi.fn(),aiRequest:vi.fn()}));
vi.mock('../src/domain/ai-client',()=>api);
import {advanceAIRun,isRealModel,stopInactiveAI} from '../src/domain/ai-run';
const createPlan={mode:'create' as const,answer:'按内容编排',title:'创新之路',type:'时间演进型' as const,sections:[{title:'创立',body:'示例企业成立',year:'1998'},{title:'创新',body:'示例研发投入',year:'2025'}],imagePrompt:'无文字工业背景'};
const base=(patch:Partial<Run>={}):Run=>({structureConfirmed:true,id:'real-run',workspaceId:'personal',prompt:'制作企业历史展项',model:'deepseek-flash',styleId:'industrial',skillIds:[],attachmentIds:[],status:'running',step:0,outputKind:'exhibit',createdAt:new Date().toISOString(),...patch});
const setRun=(patch:Partial<Run>={})=>{const run=base(patch);useStudio.setState({runs:[run]});return run;};
const result=()=>useStudio.getState().runs[0];
beforeEach(()=>{useStudio.setState(createInitialData());api.aiChat.mockReset();api.aiRequest.mockReset();api.aiChat.mockResolvedValue({content:JSON.stringify(createPlan)});});

describe('real AI orchestration without provider calls',()=>{
 it('recognizes real models and ignores missing or stopped runs',async()=>{
  expect(isRealModel('deepseek-flash')).toBe(true);expect(isRealModel('demo')).toBe(false);await advanceAIRun('missing');setRun({status:'stopped'});await advanceAIRun('real-run');expect(api.aiChat).not.toHaveBeenCalled();
 });
 it('keeps discussion proposals waiting without creating an artifact',async()=>{
  setRun();const before=useStudio.getState().works.length;api.aiChat.mockResolvedValue({content:JSON.stringify({mode:'discuss',answer:'先比较三种形式',options:[{title:'时间轴',description:'按年份',prompt:'制作时间轴'}]})});await advanceAIRun('real-run');expect(result()).toMatchObject({status:'waiting',aiPlan:{mode:'discuss'}});expect(useStudio.getState().works).toHaveLength(before);expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it('asks for the background decision after valid planning',async()=>{
  setRun();await advanceAIRun('real-run');expect(result()).toMatchObject({status:'waiting',step:2,aiPlan:{title:'创新之路'}});expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it('keeps the persisted image task ID while queued, then polls it instead of submitting twice',async()=>{
  setRun({aiPlan:createPlan,resourceStrategy:'generate'});api.aiRequest.mockResolvedValueOnce({id:'task-one',status:'queued'}).mockResolvedValueOnce({id:'task-one',status:'running'});
  await advanceAIRun('real-run');expect(result()).toMatchObject({status:'running',aiImageTaskId:'task-one'});await advanceAIRun('real-run');expect(api.aiRequest.mock.calls[0][0]).toBe('images');expect(api.aiRequest.mock.calls[0][1]).toMatchObject({workspaceId:'personal',idempotencyKey:'real-run'});expect(api.aiRequest.mock.calls[1][0]).toBe('images/task-one');expect(api.aiRequest.mock.calls[1][1]).toBeUndefined();expect(api.aiChat).not.toHaveBeenCalled();
 });
 it('persists a generated image and the complete editable exhibit exactly once',async()=>{
  setRun({aiPlan:createPlan,resourceStrategy:'generate'});const old=useStudio.getState().works.length;api.aiRequest.mockResolvedValue({id:'task-one',status:'succeeded',url:'/api/ai/media/task-one.png'});await advanceAIRun('real-run');const completed=result();expect(completed.status).toBe('complete');const state=useStudio.getState(),work=state.works.find(w=>w.id===completed.workId)!;expect(work.pages[0].nodes.length).toBeGreaterThan(2);expect(work.pages[0].backgroundImage).toBe('/api/ai/media/task-one.png');expect(state.assets.find(a=>a.id===completed.assetId)?.package?.prompt).toBe(createPlan.imagePrompt);expect(state.works).toHaveLength(old+1);await advanceAIRun('real-run');expect(api.aiRequest).toHaveBeenCalledTimes(1);expect(useStudio.getState().works).toHaveLength(old+1);
 });
 it('creates only a library asset for pure image requests and falls back to the original prompt',async()=>{
  setRun({outputKind:'image',styleId:'',workspaceId:undefined,aiPlan:{...createPlan,imagePrompt:undefined}});const old=useStudio.getState().works.length;api.aiRequest.mockResolvedValue({id:'image-only',status:'succeeded',url:'/api/ai/media/image-only.png'});await advanceAIRun('real-run');expect(result()).toMatchObject({status:'complete',workId:undefined});expect(useStudio.getState().works).toHaveLength(old);expect(useStudio.getState().assets.find(a=>a.id===result().assetId)?.workspaceId).toBe('personal');expect(api.aiRequest.mock.calls[0][1].prompt).toBe(base().prompt);
 });
 it('saves a non-image project in its starting space after the user switches spaces',async()=>{
  setRun({outputKind:'exhibit',resourceStrategy:'reuse',workspaceId:'xintai',aiPlan:createPlan});useStudio.getState().setWorkspace('dongguan');await advanceAIRun('real-run');expect(result().status).toBe('complete');expect(useStudio.getState().works.find(w=>w.id===result().workId)?.workspaceId).toBe('xintai');expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it.each([{status:'failed',error:'额度不足'},{status:'failed'},{status:'succeeded',url:'https://attacker.test/p.png'}])('fails visibly without inventing a result for %j',async(task)=>{
  setRun({aiPlan:createPlan,outputKind:'image'});const old=useStudio.getState().assets.length;api.aiRequest.mockResolvedValue(task);await advanceAIRun('real-run');expect(result().status).toBe('failed');expect(result().error).toBeTruthy();expect(useStudio.getState().assets).toHaveLength(old);
 });
 it('records malformed model output as a failure and does not call image generation',async()=>{
  setRun();api.aiChat.mockResolvedValue({content:'not json'});await advanceAIRun('real-run');expect(result().status).toBe('failed');expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it('coalesces repeated advancement while an async planner is running',async()=>{
  setRun({outputKind:'exhibit',resourceStrategy:'reuse'});let finish!:(value:any)=>void;api.aiChat.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const first=advanceAIRun('real-run');await advanceAIRun('real-run');expect(api.aiChat).toHaveBeenCalledTimes(1);finish({content:JSON.stringify(createPlan)});await first;expect(result().status).toBe('complete');
 });
 it('does not apply a planner response after cancellation',async()=>{
  setRun();let finish!:(value:any)=>void;api.aiChat.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const running=advanceAIRun('real-run');useStudio.getState().updateRun('real-run',{status:'stopped'});stopInactiveAI();expect(api.aiChat.mock.calls[0][2].aborted).toBe(true);finish({content:JSON.stringify(createPlan)});await running;expect(result().status).toBe('stopped');expect(result().aiPlan).toBeUndefined();
 });
 it('does not install generated image or work after cancellation while polling',async()=>{
  setRun({aiPlan:createPlan,outputKind:'image',aiImageTaskId:'pending'});let finish!:(value:any)=>void;api.aiRequest.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const before=useStudio.getState().assets.length;const running=advanceAIRun('real-run');useStudio.getState().updateRun('real-run',{status:'stopped'});finish({id:'pending',status:'succeeded',url:'/api/ai/media/pending.png'});await running;expect(result().status).toBe('stopped');expect(useStudio.getState().assets).toHaveLength(before);
 });
 it('rejects unadapted embedded/custom programs instead of claiming editable output',async()=>{
  setRun({outputKind:'html',aiPlan:createPlan});await advanceAIRun('real-run');expect(result()).toMatchObject({status:'waiting',studioReview:true});
 });
 it('includes only accessible attachments and selected skill/reference context in planning',async()=>{
  const state=useStudio.getState(),asset=state.assets.find(a=>a.source==='builtin'||a.workspaceId==='personal'||!a.workspaceId)!;setRun({outputKind:'exhibit',resourceStrategy:'reuse',attachmentIds:[asset.id],skillIds:[state.skills[0].id],reference:{id:'ref',version:'1',prompt:'参考来源',files:[],skillIds:[],params:{kind:'example'},complete:true}});await advanceAIRun('real-run');const context=JSON.parse(api.aiChat.mock.calls[0][1][1].content);expect(context.attachments[0]).toMatchObject({id:asset.id,kind:asset.kind});expect(context.request).toBe(base().prompt);expect(context.reference.prompt).toBe('参考来源');expect(api.aiChat.mock.calls[0][1].map((m:any)=>m.content).join('\n')).toContain(state.skills[0].name);
 });
});


describe('resource eligibility and supported native outputs',()=>{
 it.each(['AI语音气泡','企业大事记时间轴','荣誉卡片'])('stores an adapted native component for %s without an image job',async(prompt)=>{
  setRun({prompt,outputKind:'component',aiPlan:createPlan});const old=useStudio.getState().works.length;await advanceAIRun('real-run');expect(result().status).toBe('complete');const asset=useStudio.getState().assets.find(a=>a.id===result().assetId)!;expect(asset.kind).toBe('component');expect(asset.package?.files?.[0].content).toContain(createPlan.sections[0].body);expect(useStudio.getState().works).toHaveLength(old);expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it('rejects a genuinely unadapted component family',async()=>{
  setRun({prompt:'三维粒子语音气泡',outputKind:'component',aiPlan:createPlan});await advanceAIRun('real-run');expect(result()).toMatchObject({status:'waiting',studioReview:true});expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it.each([{attachmentIds:['missing-asset']},{skillIds:['missing-skill']},{backgroundAssetId:'missing-background'}])('rejects unavailable references before a paid request: %j',async(patch)=>{
  setRun(patch);await advanceAIRun('real-run');expect(result().status).toBe('failed');expect(api.aiChat).not.toHaveBeenCalled();expect(api.aiRequest).not.toHaveBeenCalled();
 });
 it('rejects oversized context before sending it to the planner',async()=>{
  setRun({prompt:'材料'.repeat(7000)});await advanceAIRun('real-run');expect(result().error).toMatch(/参考资料过多/);expect(api.aiChat).not.toHaveBeenCalled();
 });
 it('rechecks a reference revoked during image generation before installing output',async()=>{
  const reference=useStudio.getState().assets.find(a=>a.source==='builtin'||a.workspaceId==='personal'||!a.workspaceId)!;
  setRun({aiPlan:createPlan,outputKind:'image',attachmentIds:[reference.id]});let finish!:(value:any)=>void;api.aiRequest.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const running=advanceAIRun('real-run');
  useStudio.setState(state=>({assets:state.assets.filter(a=>a.id!==reference.id)}));finish({id:'generated',status:'succeeded',url:'/api/ai/media/generated.png'});await running;expect(result().status).toBe('failed');expect(result().error).toMatch(/参考素材已不可用/);expect(useStudio.getState().assets.some(a=>a.id==='asset-real-run')).toBe(false);
 });
 it('uses a selected eligible background without generating a new one',async()=>{
  const reference=useStudio.getState().assets.find(a=>a.kind==='image'&&(a.source==='builtin'||a.workspaceId==='personal'||!a.workspaceId))!;
  setRun({aiPlan:createPlan,backgroundAssetId:reference.id});await advanceAIRun('real-run');expect(result().status).toBe('complete');expect(api.aiRequest).not.toHaveBeenCalled();expect(useStudio.getState().works.find(w=>w.id===result().workId)?.pages[0].backgroundImage).toBe(reference.src);
 });
 it('handles an unexpected non-Error rejection with a user-facing fallback',async()=>{
  setRun();api.aiChat.mockRejectedValue(null);await advanceAIRun('real-run');expect(result()).toMatchObject({status:'failed',error:'AI 创作未完成，请重试。'});
 });
});

it('waits for explicit event confirmation before creating an exhibit',async()=>{setRun({structureConfirmed:false,aiPlan:createPlan,resourceStrategy:'reuse'});const before=useStudio.getState().works.length;await advanceAIRun('real-run');expect(result()).toMatchObject({status:'waiting',step:1});expect(useStudio.getState().works).toHaveLength(before);});
it.each(['presentation','story'] as const)('routes %s into shared confirmation instead of fixed example generation',async outputKind=>{setRun({outputKind});await advanceAIRun('real-run');expect(result()).toMatchObject({status:'waiting',studioReview:true});expect(api.aiChat).not.toHaveBeenCalled();});
