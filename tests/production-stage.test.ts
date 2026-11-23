import {describe,expect,it,beforeEach} from 'vitest';
import {productionStageOf,withProductionStage,productionStagePrompt,deliveryChecks,reviewedDeliveryChecks} from '../src/domain/production-stage';
import {publicWorkSnapshot} from '../src/domain/creative-publication';
import {createSceneWork} from '../src/domain/scenes';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
beforeEach(()=>useStudio.setState(createInitialData()));
describe('同一作品售前与交付阶段',()=>{
 it('defaults existing works to presales and preserves artifact when converting',()=>{
  const work=createSceneWork({title:'案例',type:'卡片浏览型',styleId:'industrial',width:1920,height:1080});
  expect(productionStageOf(work)).toBe('presales');
  const delivery=withProductionStage(work,'delivery');
  expect(delivery.id).toBe(work.id);expect(delivery.pages).toEqual(work.pages);expect(work.productionStage).toBeUndefined();
  expect(productionStageOf(delivery)).toBe('delivery');
 });
 it('keeps unconfigured prompts and differentiates factual constraints',()=>{
  expect(productionStagePrompt('做一个时间轴')).toBe('做一个时间轴');
  expect(productionStagePrompt('做一个时间轴','presales')).toContain('不得编造');
  expect(productionStagePrompt('做一个时间轴','delivery')).toContain('待补');
 });
 it('propagates draft stage to run, prompt and generated artifact',()=>{
  const state=useStudio.getState();state.updateDraft({text:'制作交互页面，展示企业发展时间轴',model:'demo',productionStage:'delivery'});
  const run=useStudio.getState().startRun()!;expect(run.productionStage).toBe('delivery');expect(run.prompt).toContain('制作阶段：正式交付');
  state.completeRun(run.id);const completed=useStudio.getState().runs.find(r=>r.id===run.id)!;
  const work=useStudio.getState().works.find(w=>w.id===completed.workId)!;
  expect(productionStageOf(work)).toBe('delivery');
 });
 it('manual checks apply only to their saved revision and depend on output kind',()=>{
  const work=createSceneWork({title:'演示',kind:'presentation',type:'卡片浏览型',styleId:'industrial',width:1920,height:1080});
  expect(deliveryChecks(work).some(c=>c.id==='narration')).toBe(true);
  const checked={...work,deliveryReview:{revision:work.revision,checks:['facts']}};
  expect(reviewedDeliveryChecks(checked)).toEqual(['facts']);
  expect(publicWorkSnapshot(checked).deliveryReview).toBeUndefined();
  expect(reviewedDeliveryChecks({...checked,revision:work.revision+1})).toEqual([]);
 });
});
