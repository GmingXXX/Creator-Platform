import {beforeEach,expect,it,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {reviseWorkWithAI} from '../src/domain/ai-revision';
import {advanceAIRun} from '../src/domain/ai-run';
import {advanceBackground,beginBackground} from '../src/domain/background-generation';
import {generateVideo} from '../src/domain/video-generation';
import {generateReviewImage} from '../src/features/creation/generation-materials';
import {generateReviewVideo} from '../src/features/creation/generation-review-video';
import type {Run} from '../src/domain/types';
const api=vi.hoisted(()=>({aiChat:vi.fn(),aiRequest:vi.fn()}));
const access=vi.hoisted(()=>({denied:new Set<string>()}));
vi.mock('../src/domain/ai-client',async original=>({...await original<object>(),...api}));
vi.mock('../src/domain/workspace-management',async original=>({...await original<object>(),workspaceCanEdit:(_state:unknown,id:string)=>!access.denied.has(id)}));
const response={content:JSON.stringify({summary:'已改标题',patches:[{kind:'work',changes:{title:'AI新标题'}}]}),model:'deepseek-flash'};
const run=(patch:Partial<Run>={}):Run=>({id:'access-run',workspaceId:'xintai',prompt:'生成图片',model:'deepseek-flash',styleId:'',skillIds:[],attachmentIds:[],status:'running',step:0,outputKind:'image',createdAt:'',...patch});
beforeEach(()=>{access.denied.clear();useStudio.setState(createInitialData());api.aiChat.mockReset();api.aiRequest.mockReset();});
function fixtureWork(){const w={...useStudio.getState().works[0],workspaceId:'xintai',aiModel:'deepseek-flash'};useStudio.setState({works:[w]});return w;}
it('拒绝查看者的AI修改，调用模型前就结束',async()=>{
 const work=fixtureWork();access.denied.add('xintai');await expect(reviseWorkWithAI(work.id,'改标题')).rejects.toThrow('权限');expect(api.aiChat).not.toHaveBeenCalled();expect(useStudio.getState().works[0]).toEqual(work);
});
it('AI修改晚返回时复核权限，不写作品或修改记录',async()=>{
 const work=fixtureWork();let finish!:(value:typeof response)=>void;api.aiChat.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const task=reviseWorkWithAI(work.id,'改标题');access.denied.add('xintai');finish(response);
 await expect(task).rejects.toThrow('权限');expect(useStudio.getState().works[0]).toEqual(work);expect(useStudio.getState().conversationTurns).toEqual([]);
});
it('按原任务空间复核权限，不被当前空间影响',async()=>{
 const work=fixtureWork();api.aiChat.mockResolvedValue(response);useStudio.getState().setWorkspace('dongguan');access.denied.add('dongguan');await reviseWorkWithAI(work.id,'改标题');expect(useStudio.getState().works[0].title).toBe('AI新标题');
});
it('查看者不能开启背景生成或执行已有AI任务',async()=>{
 useStudio.setState({runs:[run()]});access.denied.add('xintai');expect(()=>beginBackground('access-run','概念背景')).toThrow('权限');await advanceAIRun('access-run');expect(api.aiChat).not.toHaveBeenCalled();expect(api.aiRequest).not.toHaveBeenCalled();
});
it('背景晚返回不写素材或生成记录',async()=>{
 useStudio.setState({runs:[run()]});beginBackground('access-run','概念背景');const before=structuredClone(useStudio.getState().runs[0]);let finish!:(value:unknown)=>void;api.aiRequest.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const task=advanceBackground('access-run');access.denied.add('xintai');finish({id:'remote',status:'succeeded',url:'/api/ai/media/remote.png'});await task;
 expect(useStudio.getState().runs[0]).toEqual(before);expect(useStudio.getState().assets.some(a=>a.src==='/api/ai/media/remote.png')).toBe(false);
});
it('图片生成晚返回不写素材或完成任务',async()=>{
 useStudio.setState({runs:[run({aiPlan:{mode:'create',answer:'生成',title:'图片',type:'时间演进型',sections:[]}})]});let finish!:(value:unknown)=>void;api.aiRequest.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const task=advanceAIRun('access-run');access.denied.add('xintai');finish({id:'remote',status:'succeeded',url:'/api/ai/media/remote.png'});await task;
 expect(useStudio.getState().assets.some(a=>a.id==='asset-access-run')).toBe(false);expect(useStudio.getState().runs[0].status).not.toBe('complete');
});
it('视频生成校验调用前及结果落库前的权限',async()=>{
 access.denied.add('xintai');await expect(generateVideo('企业概念',{workspaceId:'xintai',requestKey:'access-video'})).rejects.toThrow('权限');expect(api.aiRequest).not.toHaveBeenCalled();access.denied.clear();
 let finish!:(value:unknown)=>void;api.aiRequest.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const task=generateVideo('企业概念',{workspaceId:'xintai',requestKey:'access-video'});access.denied.add('xintai');const id='a'.repeat(32);finish({id,workspaceId:'xintai',status:'succeeded',url:`/api/ai/video-media/${id}.mp4`,duration:5,size:'1280*720'});await expect(task).rejects.toThrow('权限');expect(useStudio.getState().assets.some(a=>a.id===`video-${id}`)).toBe(false);
});

it('确认配图入口拒绝查看者，晚返回不写素材和本地完成状态',async()=>{
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)});
 try{const input={workspaceId:'xintai',prompt:'概念图',requestKey:'permission-review-image'};access.denied.add('xintai');await expect(generateReviewImage(input)).rejects.toThrow('权限');expect(values.size).toBe(0);expect(api.aiRequest).not.toHaveBeenCalled();
 access.denied.clear();const id='a'.repeat(32);let finish!:(value:unknown)=>void;api.aiRequest.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const task=generateReviewImage(input);const before=new Map(values);access.denied.add('xintai');finish({id,status:'pending'});await expect(task).rejects.toThrow('权限');expect(values).toEqual(before);expect(api.aiRequest).toHaveBeenCalledTimes(1);
 }finally{vi.unstubAllGlobals();}
});
it('确认视频入口在创建本地任务或API调用前拒绝查看者',async()=>{
 access.denied.add('xintai');await expect(generateReviewVideo({workspaceId:'xintai',prompt:'概念视频',requestKey:'permission-review-video'})).rejects.toThrow('权限');expect(api.aiRequest).not.toHaveBeenCalled();
});
it('旧版未标空间的作品按个人空间修改，不受项目查看权限影响',async()=>{
 const work={...fixtureWork(),workspaceId:undefined};useStudio.setState({works:[work]});access.denied.add('xintai');api.aiChat.mockResolvedValue(response);await reviseWorkWithAI(work.id,'改标题');expect(useStudio.getState().works[0].title).toBe('AI新标题');
});
