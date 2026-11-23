import {describe,it,expect} from 'vitest';
import {resolveIntent} from '../src/domain/logic';
import {demoKnowledgePresets} from '../src/domain/demo-knowledge-catalog';
describe('knowledge demo creation intent',()=>{
 it('routes each explicit demo artifact independently of fictional-data disclaimer',()=>{
  const kinds={timeline:'exhibit',presentation:'presentation',story:'story',component:'component'};
  for(const preset of demoKnowledgePresets.filter(p=>p.id!=='honors'))expect(resolveIntent(preset.prompt).outputKind).toBe(kinds[preset.id]);
 });
 it('keeps presentation/video requests with timeline subject in their actual format',()=>{
  expect(resolveIntent('生成8页智能演示，用鱼骨时间轴展项说明企业历程').outputKind).toBe('presentation');
  expect(resolveIntent('制作一个鱼骨时间轴展项的介绍视频').outputKind).toBe('video');
  expect(resolveIntent('制作企业大事记交互页面，所有信息为虚构演示').outputKind).toBe('exhibit');
 });
});
