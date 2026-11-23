import { describe, expect, it } from 'vitest';
import { generateArtifact, isAssetReferenced } from '../src/domain/generation';
import { getBackgroundCandidates, needsBackgroundSelection, resumeRunPatch, runPauseCopy, retryRunPatch, realOutputDescription } from '../src/domain/generation-resource';
import type { Asset, Run } from '../src/domain/types';

const run: Run = { id:'run-background', workspaceId:'xintai', prompt:'为钢铁企业制作发展大事记', model:'GPT', styleId:'', skillIds:[], attachmentIds:[], status:'running', step:1, outputKind:'exhibit', createdAt:'2026-11-06' };
const background: Asset = { id:'background-xintai',workspaceId:'xintai',name:'客户确认的工厂背景',kind:'image',src:'/media/technology.svg',preview:'/media/technology.svg',description:'背景',tags:['工业'],author:'纪鸣',createdAt:'2026-11-06',source:'uploaded',public:false };

describe('background selection and recovery', () => {
  it('allows style-background reuse without a forced resource-selection pause', () => {
    expect(needsBackgroundSelection(run)).toBe(true);
    expect(needsBackgroundSelection({...run,resourceStrategy:'reuse'})).toBe(false);
    expect(needsBackgroundSelection({...run,backgroundAssetId:background.id,resourceStrategy:'reuse'})).toBe(false);
    expect(needsBackgroundSelection({...run,resourceStrategy:'generate'})).toBe(false);
    expect(needsBackgroundSelection({...run,outputKind:'presentation'})).toBe(false);
  });
  it('retry and resume do not bypass an unmade background decision', () => {
    expect(resumeRunPatch({...run,status:'failed',step:2})).toMatchObject({status:'waiting',step:2,error:undefined});
    expect(resumeRunPatch({...run,status:'stopped',step:0})).toMatchObject({status:'running',step:0});
    expect(resumeRunPatch({...run,status:'failed',step:4,resourceStrategy:'generate'})).toMatchObject({status:'running',step:4});
  });
  it('applies the explicitly selected asset while preserving native exhibit content', () => {
    const result=generateArtifact({...run,resourceStrategy:'reuse',backgroundAssetId:background.id},[background]);
    expect(result.work?.pages[0].backgroundImage).toBe(background.src);
    expect(result.work?.pages[0].backgroundAssetId).toBe(background.id);
    expect(result.work?.pages[0].nodes.some(node=>node.type==='timeline')).toBe(true);
    expect(result.work?.pages[0].nodes.length).toBeGreaterThan(2);
    expect(result.asset).toBeUndefined();
  });
  it.each([
    {workspaceId:'dongguan'}, {deletedAt:'2026-11-06'}, {kind:'video' as const}, {sourceWorkId:'video-engineering'},
  ])('refuses an inaccessible or incompatible selected background: %j', patch => {
    expect(()=>generateArtifact({...run,resourceStrategy:'reuse',backgroundAssetId:background.id},[{...background,...patch}])).toThrow(/背景/);
  });
  it('fails visibly when a selected background has disappeared', () => {
    expect(()=>generateArtifact({...run,resourceStrategy:'reuse',backgroundAssetId:'missing'},[])).toThrow(/背景/);
  });
  it('protects selected backgrounds from deletion before the work has finished', () => {
    expect(isAssetReferenced({runs:[{...run,backgroundAssetId:background.id}],works:[],assets:[background],drafts:[]},background.id,background.src)).toBe(true);
  });
  it('does not present identical media as several different background ideas', () => {
    const eligible={...background,source:'generated' as const};
    const candidates=getBackgroundCandidates(run,[eligible,{...eligible,id:'community-copy',public:true,source:'community'}]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].asset.id).toBe(background.id);
  });
});

describe('component generation boundaries', () => {
  it.each([['AI 语音气泡组件','bubble'],['横向时间轴组件','timeline'],['企业荣誉卡片组件','card']])('generates an adapted component for %s', (prompt,type) => {
    const result=generateArtifact({...run,prompt,outputKind:'component'});
    expect(result.asset?.kind).toBe('component');
    expect(result.asset?.componentType).toBe(type);
    expect(result.asset?.description).toContain('已适配');
    expect(JSON.parse(result.asset?.package?.files.find(file=>file.name==='component.schema.json')?.content || '{}').type).toBe(type);
  });
  it('keeps an unknown custom component as an embedded program needing adaptation', () => {
    const result=generateArtifact({...run,prompt:'生成一个手势驱动的三维粒子组件',outputKind:'component'});
    expect(result.asset?.kind).toBe('html');
    expect(result.asset?.componentType).toBeUndefined();
    expect(result.asset?.description).toContain('适配');
    expect(result.asset?.package?.files.some(file=>file.name==='component.schema.json')).toBe(false);
    expect(result.work?.pages[0].nodes).toHaveLength(1);
    expect(result.work?.pages[0].nodes[0].type).toBe('html');
  });
});


describe('real AI pause and recovery',()=>{
 it('preserves a discussion as a plan choice instead of requesting a background',()=>{const discussion={...run,model:'deepseek-flash',status:'stopped' as const,aiPlan:{mode:'discuss' as const,answer:'请选择方案'},step:1};expect(needsBackgroundSelection(discussion)).toBe(false);expect(resumeRunPatch(discussion)).toMatchObject({status:'waiting',step:1});});
 it('resumes an interrupted real planning request before resource selection',()=>{expect(resumeRunPatch({...run,model:'deepseek-flash',status:'failed',step:2})).toMatchObject({status:'running',step:0});});
 it('continues checking the existing image task without clearing its id',()=>{const image={...run,model:'deepseek-flash',aiImageTaskId:'existing-paid-task',status:'stopped' as const,step:3,resourceStrategy:'generate' as const};expect({...image,...resumeRunPatch(image)}).toMatchObject({aiImageTaskId:'existing-paid-task',status:'running'});expect(runPauseCopy(image)).toMatchObject({pause:'暂停查看',resume:'继续查看',retry:'重新查询任务'});expect(runPauseCopy(image).description).toContain('不会重复提交');});
 it('does not imply cancellation of a remote submission when the task id is not yet known',()=>{const copy=runPauseCopy({...run,model:'deepseek-flash'});expect(copy.pause).toBe('暂停创作');expect(copy.description).toContain('可能继续');expect(runPauseCopy(run).pause).toBe('停止生成');});
});

it('recovers a failed image lookup through the same run id without replacing the paid task key',()=>{const image={...run,model:'deepseek-flash',aiImageTaskId:'failed-lookup',status:'failed' as const,step:3,resourceStrategy:'generate' as const};expect({...image,...retryRunPatch(image)}).toMatchObject({id:run.id,aiImageTaskId:undefined,status:'running',step:3});});

it('describes supplied video media without implying generated footage',()=>{expect(realOutputDescription({...run,model:'deepseek-flash',outputKind:'video'})).toContain('未接入自动文生视频');expect(realOutputDescription({...run,model:'deepseek-flash',outputKind:'story'})).toBeUndefined();expect(realOutputDescription(run)).toBeUndefined();});
