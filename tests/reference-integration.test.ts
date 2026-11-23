import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {createExhibitReference} from '../src/domain/exhibit-references';
import {advanceAIRun} from '../src/domain/ai-run';
import {reviseWorkWithAI} from '../src/domain/ai-revision';
const api=vi.hoisted(()=>({aiChat:vi.fn(),aiRequest:vi.fn()}));
vi.mock('../src/domain/ai-client',()=>api);
const plan={mode:'create',answer:'使用当前客户内容',title:'当前客户历程',type:'时间演进型',sections:[{title:'起步',body:'当前客户提供的事件'}]};
const refs=()=>{
 const state=useStudio.getState(),template=state.templates[0];
 return [createExhibitReference(state,'personal',{sourceKind:'template',sourceId:template.id,dimension:'interaction',scope:'work',note:''}),createExhibitReference(state,'personal',{sourceKind:'template',sourceId:template.id,dimension:'ui',scope:'work',note:''})];
};
beforeEach(()=>{useStudio.setState(createInitialData());api.aiChat.mockReset();api.aiRequest.mockReset();api.aiChat.mockResolvedValue({content:JSON.stringify(plan)});});
describe('multi-reference lifecycle integration',()=>{
 it('freezes references into the run without clearing unrelated input before submit',()=>{
  const state=useStudio.getState(),references=refs();state.updateDraft({text:'制作当前客户发展历程',model:'deepseek-flash',references});
  const run=state.startRun()!;expect(run.references).toEqual(references);expect(run.references).not.toBe(references);
  expect(useStudio.getState().drafts.find(d=>d.id===useStudio.getState().activeDraftId)?.references||[]).toHaveLength(0);
 });
 it('passes distinct reference dimensions to the model and preserves provenance on the new work',async()=>{
  const state=useStudio.getState();state.updateDraft({text:'制作当前客户发展历程',model:'deepseek-flash',references:refs()});const run=state.startRun()!;
  state.updateRun(run.id,{structureConfirmed:true,resourceStrategy:'reuse'});await advanceAIRun(run.id);
  const messages=api.aiChat.mock.calls[0][1],metadata=JSON.parse(messages.find((m:any)=>m.role==='user').content);
  expect(metadata.references).toHaveLength(2);expect(metadata.references.map((r:any)=>r.dimension)).toEqual(['interaction','ui']);
  const current=useStudio.getState(),done=current.runs.find(r=>r.id===run.id)!;expect(done.status).toBe('complete');
  const work=current.works.find(w=>w.id===done.workId)!;expect(work.references).toHaveLength(2);expect(work.creationPackage?.references).toHaveLength(2);
 });
 it('rechecks removed sources before model requests and preserves the draft',()=>{
  const state=useStudio.getState(),references=refs();state.updateDraft({text:'制作当前客户发展历程',references});
  useStudio.setState({templates:[]});expect(useStudio.getState().startRun()).toBeUndefined();expect(api.aiChat).not.toHaveBeenCalled();
  expect(useStudio.getState().drafts.find(d=>d.id===useStudio.getState().activeDraftId)?.references).toHaveLength(2);
 });
 it('feeds references into follow-up editing without changing the selected scope',async()=>{
  const state=useStudio.getState(),original=state.works.find(w=>(w.workspaceId||'personal')==='personal')!;
  const work={...original,references:refs(),aiModel:'deepseek-flash'};useStudio.setState(s=>({works:s.works.map(w=>w.id===work.id?work:w)}));
  api.aiChat.mockResolvedValue({content:JSON.stringify({summary:'已调整标题',patches:[{kind:'work',changes:{title:'新的标题'}}]})});
  await reviseWorkWithAI(work.id,'改标题');
  const metadata=JSON.parse(api.aiChat.mock.calls[0][1].find((m:any)=>m.role==='user').content);expect(metadata.references).toHaveLength(2);expect(metadata.target.scope).toBe('work');
  expect(useStudio.getState().works.find(w=>w.id===work.id)?.references).toHaveLength(2);
 });
 it('does not save a late generated result if its source became unavailable',async()=>{
  const state=useStudio.getState();state.updateDraft({text:'制作当前客户发展历程',model:'deepseek-flash',references:refs()});const run=state.startRun()!;state.updateRun(run.id,{structureConfirmed:true,resourceStrategy:'reuse'});
  api.aiChat.mockImplementation(async()=>{useStudio.setState({templates:[]});return {content:JSON.stringify(plan)};});
  await advanceAIRun(run.id);const result=useStudio.getState().runs.find(r=>r.id===run.id)!;expect(result.status).toBe('failed');expect(result.workId).toBeUndefined();
 });
});
