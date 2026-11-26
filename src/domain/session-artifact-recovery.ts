import {assetAvailableForInsertion, workAvailableInSpace} from './asset-access';
import {getAssetMetadata} from './asset-metadata';
import {applyBackground} from './background-generation';
import {useStudio} from './store';
import {workspaceCanEdit} from './workspace-management';

type StudioState = ReturnType<typeof useStudio.getState>;

export function findRecoverableExhibit(state: StudioState, sessionId: string) {
  const session = state.creationSessions?.find(item => item.id === sessionId);
  if (!session || session.queued?.length || session.workspaceId !== state.activeWorkspaceId || !workspaceCanEdit(state, session.workspaceId)) return;
  const output = state.runs.find(item => item.id === session.runId);
  if (!output || output.status !== 'complete' || output.outputKind !== 'image' || output.workId || (output.workspaceId || 'personal') !== session.workspaceId) return;
  const image = state.assets.find(item => item.id === output.assetId && item.kind === 'image' && (item.workspaceId || 'personal') === session.workspaceId && assetAvailableForInsertion(item, session.workspaceId));
  if (!image) return;
  for (const id of [...session.priorRunIds || []].reverse()) {
    const source = state.runs.find(item => item.id === id);
    if (!source || source.status !== 'complete' || source.outputKind !== 'exhibit' || (source.workspaceId || 'personal') !== session.workspaceId) continue;
    const work = state.works.find(item => item.id === source.workId && item.kind === 'exhibit' && !item.archived && workAvailableInSpace(item, session.workspaceId));
    if (work) return {source, work, image, output, canAdopt: !!work.pages.length && getAssetMetadata(image).business.usage !== 'reference'};
  }
}

export function returnToExhibit(sessionId: string, sourceId: string, imageId: string, adoptPageId?: string) {
  const match = findRecoverableExhibit(useStudio.getState(), sessionId);
  if (!match || match.source.id !== sourceId || match.image.id !== imageId) throw new Error('会话中的作品或图片已变化，请重新选择。');
  if (adoptPageId !== undefined) {
    if (!match.canAdopt || !match.work.pages.some(page => page.id === adoptPageId)) throw new Error('当前页面或图片无法用于替换背景。');
    applyBackground(sourceId, imageId, adoptPageId);
  }
  useStudio.setState(state => ({creationSessions: state.creationSessions?.map(session => {
    if (session.id !== sessionId) return session;
    const prior = (session.priorRunIds || []).filter(id => id !== sourceId && id !== match.output.id);
    return {...session, priorRunIds: [...prior, match.output.id], runId: sourceId, lastKind: match.source.outputKind, retryKind: undefined, error: undefined};
  })}));
}
