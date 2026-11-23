import type { Asset, NodeKind, Run } from './types';
import { rankAssets } from './asset-retrieval';
import { systems } from './scenes';

/** A reference package supplies context, but is not an implicit background choice. */
export function needsBackgroundSelection(run: Run): boolean {
  return run.aiPlan?.mode !== 'discuss' && run.outputKind === 'exhibit' && !run.resourceStrategy && !run.backgroundAssetId;
}

export function resumeRunPatch(run: Run): Partial<Run> {
  if (run.aiPlan?.mode === 'discuss') return {status:'waiting',step:1,error:undefined};
  if (run.model.startsWith('deepseek-') && !run.aiPlan && !run.aiImageTaskId) return {status:'running',step:0,error:undefined};
  const waiting = run.step >= 1 && needsBackgroundSelection(run);
  return { status: waiting ? 'waiting' : 'running', step: waiting ? 2 : run.step, error: undefined };
}

export function getBackgroundCandidates(run: Run, assets: Asset[]) {
  const explicitStyle = systems.find(system => system.id === run.styleId)?.name || '';
  const matches = rankAssets({
    assets, workspaceId: run.workspaceId || 'personal', query: `${run.prompt} ${explicitStyle}`.trim(), kind: 'image', forAI: true,
  });
  // Several library records may point to the same image. Show the best usable
  // record once, instead of presenting identical pictures as different ideas.
  return matches.filter((match,index) => matches.findIndex(candidate => candidate.asset.src === match.asset.src) === index).slice(0, 3);
}

/** Only known, adapted component families can produce a native editable schema. */
export function nativeComponentForPrompt(prompt: string): NodeKind | undefined {
  if (/三维|3d|粒子|骨骼|物理模拟|手势|人脸|自定义代码|全新交互/i.test(prompt)) return undefined;
  if (/气泡|声波|语音/.test(prompt)) return 'bubble';
  if (/时间轴|大事记/.test(prompt)) return 'timeline';
  if (/卡片|荣誉|案例卡/.test(prompt)) return 'card';
  return undefined;
}


/** Pausing this client does not cancel an already submitted provider job. */
export function runPauseCopy(run:Run) {
  if (!run.model.startsWith('deepseek-')) return {pause:'停止生成',resume:'继续创作',retry:'重试当前步骤',status:'已停止',description:'你的需求、参考资料和已完成的步骤均已保留。'};
  if (run.aiImageTaskId) return {pause:'暂停查看',resume:'继续查看',retry:'重新查询任务',status:'已暂停查看',description:'云端图片任务会继续运行。继续查看时会查询同一个任务，不会重复提交或重新生成。'};
  return {pause:'暂停创作',resume:'继续创作',retry:'重试当前步骤',status:'已暂停',description:'已暂停本地创作。已提交的远端任务可能继续运行；图片请求恢复时会沿用原任务标识，避免重复提交。'};
}


/** Re-POST the same run key to recover provider polling, never create a new charged task. */
export function retryRunPatch(run:Run):Partial<Run> {
  return {...resumeRunPatch(run),...(run.model.startsWith('deepseek-')&&run.aiImageTaskId?{aiImageTaskId:undefined}:{})};
}


export function realOutputDescription(run:Run):string|undefined {
  return run.model.startsWith('deepseek-')&&run.outputKind==='video'
    ? 'AI 生成分镜与内容，视频素材来自用户提供的文件；当前未接入自动文生视频。'
    : undefined;
}
