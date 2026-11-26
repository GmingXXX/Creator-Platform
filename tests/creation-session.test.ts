import {describe, expect, it} from 'vitest';
import {beginSession,classifyRequest,continueQueuedAsset,startRelatedOutput,startSession,submitSessionReply} from '../src/domain/creation-session';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';

describe('创作会话先于作品',()=>{
 it.each([
 ['把荣誉和案例做成一个可演示的展项',undefined],
 ['让参观者按行业筛选，点击案例看详情','exhibit'],
 ['接待领导时自动讲五分钟','presentation'],
 ['访客的选择会改变接下来的结局','story'],
 ['生成一张数学家的海报','image'],
 ])('%s', (text,kind)=>expect(classifyRequest(String(text))).toBe(kind));
 it('先保存需求，含糊回答继续澄清，后续回答成为作品需求的一部分',async()=>{
  useStudio.setState({...createInitialData(),creationSessions:[]});
  const state=useStudio.getState();
  state.updateDraft({text:'做一个数学史展项',model:'demo'});
  const session=startSession(state.drafts.find(d=>d.id===state.activeDraftId)!.id);
  await submitSessionReply(session.id,'长期放在展厅');
  expect(useStudio.getState().creationSessions?.[0].runId).toBeUndefined();
  await submitSessionReply(session.id,'想让访客选择不同结局');
  const current=useStudio.getState(),run=current.runs.find(r=>r.id===current.creationSessions?.[0].runId);
  expect(run?.outputKind).toBe('story');expect(run?.prompt).toContain('长期放在展厅');
 });

 function fixture(text:string){
  useStudio.setState({...createInitialData(),creationSessions:[]});
  const state=useStudio.getState();state.updateDraft({text,model:'demo'});
  return startSession(state.activeDraftId);
 }
 it('保留未完成方案，用同一会话切换类型',async()=>{
  const s=fixture('做一个交互页面');await beginSession(s.id);
  const before=useStudio.getState().creationSessions![0].runId!;
  await submitSessionReply(s.id,'改成互动影片');
  const state=useStudio.getState(),next=state.creationSessions![0];
  expect(next.priorRunIds).toContain(before);expect(state.runs.find(r=>r.id===before)?.status).toBe('stopped');
  expect(state.runs.find(r=>r.id===next.runId)?.outputKind).toBe('story');
 });
 it('独立素材生成时追加的要求带上产物继续创作，队列只消费一次',async()=>{
  const s=fixture('帮我生成一张海报');await beginSession(s.id);
  const rid=useStudio.getState().creationSessions![0].runId!;
  await submitSessionReply(s.id,'以这张海报制作智能演示');const state=useStudio.getState();state.completeRun(rid);
  const run=useStudio.getState().runs.find(r=>r.id===rid)!;expect(run.assetId).toBeTruthy();
  continueQueuedAsset(s.id,run);continueQueuedAsset(s.id,run);
  const next=useStudio.getState();expect(next.creationSessions![0].queued).toHaveLength(0);
  expect(next.runs).toHaveLength(2);expect(next.runs[0].attachmentIds).toContain(run.assetId);
 });
 it('完成后分派新的独立产物，仅在明确的新创作意图时换工具',async()=>{
  const s=fixture('制作互动影片');await beginSession(s.id);
  expect(startRelatedOutput(s.id,'把标题改短',[])).toBe(false);
  expect(startRelatedOutput(s.id,'先生成一张封面',[])).toBe(true);
  expect(useStudio.getState().runs[0].outputKind).toBe('image');
 });
 it('空间切换后拒绝追加和改派，其他空间的草稿保持原状',async()=>{
  const s=fixture('做一个数学史展项');await beginSession(s.id);
  useStudio.getState().setWorkspace('xintai');
  await expect(submitSessionReply(s.id,'制作智能演示')).rejects.toThrow('原空间');
  expect(useStudio.getState().runs).toHaveLength(0);
 });
});
