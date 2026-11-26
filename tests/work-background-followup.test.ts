import {describe,expect,it} from 'vitest';
import {isWorkBackgroundRequest} from '../src/domain/work-background-request';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {beginSession,startSession,startRelatedOutput} from '../src/domain/creation-session';
describe('已有展项的背景素材',()=>{
 it.each(['生成一张背景图素材','帮我给这个时间轴做一张背景','再来一张更暗的背景图','请按照现在的风格设计背景素材','给这个时间轴配一张背景图','可以给这个时间轴加个背景图吗'])('识别 %s',text=>expect(isWorkBackgroundRequest(text)).toBe(true));
 it.each(['把背景改成暖色','把素材库里的封面图用作背景','用附件里的图片换个背景','生成一段背景音乐','介绍一下这个案例的背景','不要生成新的背景图','生成一个带背景图的交互页面','重新生成整个交互页面，保留背景','另外做一张与当前作品无关的背景图'])('区分 %s',text=>expect(isWorkBackgroundRequest(text)).toBe(false));
 it('在已有背景方案时理解省略了对象的追问',()=>{
  expect(isWorkBackgroundRequest('再暗一点',true)).toBe(true);
  expect(isWorkBackgroundRequest('再暗一点')).toBe(false);
  expect(isWorkBackgroundRequest('把标题颜色再暗一点',true)).toBe(false);
  expect(isWorkBackgroundRequest('另外独立生成一张图片',true)).toBe(false);
 });
 it('把新背景放回目标页面预览，主任务、交互节点及已有画布保持一致',async()=>{
  useStudio.setState({...createInitialData(),creationSessions:[]});
  const state=useStudio.getState();state.updateDraft({text:'做一个交互页面',model:'demo'});
  const session=startSession(state.activeDraftId);await beginSession(session.id);
  const r=useStudio.getState().runs[0],seed=useStudio.getState().works.find(w=>w.kind==='exhibit'&&(w.workspaceId||'personal')==='personal')!;
  const work={...seed,pages:[...seed.pages,{...seed.pages[0],id:'second-page',name:'第二页'}]};
  useStudio.setState({works:[work],runs:[{...r,status:'complete',workId:work.id}]});
  const page=work.pages.at(-1)!;
  expect(startRelatedOutput(session.id,'生成一张背景图素材',[],false,page.id)).toBe(true);
  const after=useStudio.getState();
  expect(after.creationSessions![0].runId).toBe(r.id);expect(after.runs).toHaveLength(1);
  expect(after.runs[0].backgroundDraft).toMatchObject({targetPageId:page.id,targetWorkId:work.id,status:'ready'});
  expect(startRelatedOutput(session.id,'再暗一点',[])).toBe(true);
  expect(useStudio.getState().runs[0].backgroundDraft?.targetPageId).toBe(page.id);
  expect(after.works.find(w=>w.id===work.id)).toEqual(work);
  expect(startRelatedOutput(session.id,'另外做一张与当前作品无关的背景图',[])).toBe(true);
  const standalone=useStudio.getState().runs[0];
  expect(standalone.outputKind).toBe('image');
  expect(standalone.prompt).toBe('另外做一张与当前作品无关的背景图');
  expect(after.creationSessions![0].messages.filter(m=>m.text==='生成一张背景图素材')).toHaveLength(1);
 });
});
