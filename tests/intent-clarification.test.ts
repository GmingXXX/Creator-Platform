import {beforeEach,describe,expect,it} from 'vitest';
import {clarificationNeeded,interpretExhibitAnswer,confirmedIntent,creationPrompt,updateClarificationAnswer} from '../src/domain/intent-clarification';
import {createDraft,createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {demoPresetData} from '../src/features/home/demo-preset-data';

const prompt='帮我把公司的荣誉资质和技术案例做成一个可演示的展项，内容从当前绑定的知识本地场获取。';
beforeEach(()=>useStudio.setState(createInitialData()));
describe('荣誉案例需求澄清',()=>{
 it('asks about vague honors and cases, not the original explicit presets',()=>{
  expect(clarificationNeeded(prompt)).toBe(true);
  for(const p of demoPresetData.filter(p=>p.id!=='honors'))expect(clarificationNeeded(p.prompt)).toBe(false);
  for(const text of ['把荣誉案例做成交互页面','用智能演示介绍荣誉案例','荣誉案例制作成互动影片','制作企业案例卡片浏览页面','生成荣誉证书海报'])expect(clarificationNeeded(text)).toBe(false);
 });
 it('understands purpose without deciding from venue alone',()=>{
  expect(interpretExhibitAnswer('长期放在展厅')).toBeUndefined();
  expect(interpretExhibitAnswer('临时给客户看')).toBeUndefined();
  expect(interpretExhibitAnswer('保留全部内容，可以筛选和点击详情')).toBe('browse');
  expect(interpretExhibitAnswer('精选几个重点，给客户讲解五分钟')).toBe('present');
  expect(interpretExhibitAnswer('让访客选择故事分支，进入不同结局')).toBe('story');
  expect(interpretExhibitAnswer('不要智能演示，完整展示并筛选案例')).toBe('browse');
  expect(interpretExhibitAnswer('既要完整浏览，也要精选讲解')).toBeUndefined();
 });
 it('requires confirmation matching the current prompt and collects presentation context',()=>{
  const draft=createDraft({text:prompt,intentClarification:{sourcePrompt:prompt,choice:'present',confirmed:true}});
  expect(confirmedIntent(draft)).toBeUndefined();
  const complete={...draft,intentClarification:{...draft.intentClarification!,audience:'客户',duration:'5 分钟'}};
  expect(confirmedIntent(complete)).toBe('presentation');
  expect(confirmedIntent({...complete,text:'改做图片'})).toBeUndefined();
  expect(confirmedIntent({...complete,intentClarification:{...complete.intentClarification,confirmed:false}})).toBeUndefined();
 });
 it('blocks startRun until clarified, preserving the draft',()=>{
  useStudio.getState().updateDraft({text:prompt});
  const id=useStudio.getState().activeDraftId;
  expect(useStudio.getState().startRun()).toBeUndefined();
  expect(useStudio.getState().runs).toHaveLength(0);
  expect(useStudio.getState().activeDraftId).toBe(id);
 });
 it.each(['browse','present','story'] as const)('routes confirmed %s instead of reclassifying prompt keywords',choice=>{
  const state=useStudio.getState();state.updateDraft({text:prompt,styleId:'industrial',model:'demo',intentClarification:{sourcePrompt:prompt,choice,answer:'资料中包含讲解视频和组件截图',audience:'客户',duration:'5 分钟',confirmed:true}});
  const draft=useStudio.getState().drafts.find(d=>d.id===state.activeDraftId)!;
  const run=useStudio.getState().startRun()!;
  expect(run.outputKind).toBe({browse:'exhibit',present:'presentation',story:'story'}[choice]);
  expect(run.prompt).toBe(creationPrompt(draft));
  expect(run.prompt).toContain('资料中包含讲解视频和组件截图');
  expect(run.styleId).toBe('industrial');
  expect(run.model).toBe('demo');
 });
 it('invalidates old answers when the original prompt changes',()=>{
  const state=useStudio.getState();state.updateDraft({text:prompt,intentClarification:{sourcePrompt:prompt,choice:'browse',confirmed:true}});
  state.updateDraft({text:prompt+'换一家公司'});
  expect(useStudio.getState().drafts.find(d=>d.id===state.activeDraftId)?.intentClarification).toBeUndefined();
 });
 it('retains explicit choices for supplementary details but accepts corrections',()=>{
  const value={sourcePrompt:prompt,choice:'present' as const,audience:'客户',duration:'5 分钟'};
  expect(updateClarificationAnswer(value,'只展示2024年后的成果')).toMatchObject({choice:'present',audience:'客户',duration:'5 分钟'});
  expect(updateClarificationAnswer(value,'完整浏览并支持筛选')).toMatchObject({choice:'browse'});
  expect(updateClarificationAnswer(value,'完整浏览，同时精选讲解').choice).toBeUndefined();
  expect(updateClarificationAnswer(value,'不要智能演示').choice).toBeUndefined();
  expect(updateClarificationAnswer({...value,choiceSource:'answer'},'').choice).toBeUndefined();
 });
 it('extracts audience and time from the free answer without asking twice',()=>{
  expect(updateClarificationAnswer({sourcePrompt:prompt},'精选重点，给客户讲解5分钟')).toMatchObject({choice:'present',audience:'客户与合作伙伴',duration:'5 分钟'});
 });
});

describe('一般模糊展项需求',()=>{
 it('clarifies experience without inferring format from venue',()=>{
  for(const prompt of ['根据这些资料做个展厅展示','介绍公司给客户看','帮我做一个可演示的展项'])expect(clarificationNeeded(prompt)).toBe(true);
  for(const prompt of ['制作企业时间轴','制作展厅地图','生成企业介绍视频','制作企业介绍PPT','制作成果卡片组件'])expect(clarificationNeeded(prompt)).toBe(false);
 });
});
