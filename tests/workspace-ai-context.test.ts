import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {advanceAIRun} from '../src/domain/ai-run';
import {reviseWorkWithAI} from '../src/domain/ai-revision';
const api=vi.hoisted(()=>({aiChat:vi.fn(),aiRequest:vi.fn()}));vi.mock('../src/domain/ai-client',()=>api);
beforeEach(()=>{useStudio.setState(createInitialData());api.aiChat.mockReset();api.aiRequest.mockReset();});
const metadata=()=>JSON.parse(api.aiChat.mock.calls[0][1].find((message:any)=>message.role==='user').content);
describe('Agent context follows task ownership',()=>{
 it('planning retains the task project even when the user switches the home space',async()=>{
  const state=useStudio.getState();state.setWorkspace('xintai');state.updateDraft({text:'制作当前客户发展历程',model:'deepseek-flash'});const run=state.startRun()!;state.updateRun(run.id,{structureConfirmed:true,resourceStrategy:'reuse'});state.setWorkspace('personal');
  api.aiChat.mockResolvedValue({content:JSON.stringify({mode:'create',title:'项目展项',answer:'编排',type:'时间演进型',sections:[{title:'阶段',body:'用户明确事实'}]})});
  await advanceAIRun(run.id);expect(metadata().workspace).toMatchObject({id:'xintai',name:'信泰企业展厅'});expect(metadata().workspace.knowledge.retrieved).toBe(false);
 });
 it('continued editing receives the work project description without reading unrelated project data',async()=>{
  const state=useStudio.getState(),work=state.createWork({title:'当前作品',type:'时间演进型',width:1920,height:1080,workspaceId:'dongguan'});useStudio.setState(s=>({workspaces:s.workspaces.map(space=>space.id==='dongguan'?{...space,description:'面向博物馆参观者'}:space)}));
  api.aiChat.mockResolvedValue({content:JSON.stringify({summary:'调整标题',patches:[{kind:'work',changes:{title:'新标题'}}]})});
  await reviseWorkWithAI(work.id,'修改标题',undefined,[],undefined,undefined,'deepseek-flash');
  expect(metadata().workspace).toMatchObject({id:'dongguan',description:'面向博物馆参观者'});expect(JSON.stringify(metadata().workspace)).not.toContain('信泰');
 });
});
