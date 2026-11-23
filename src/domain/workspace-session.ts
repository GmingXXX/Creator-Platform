import type {StudioData} from './types';
import {createDraft} from './fixtures';
import {workspaceRole} from './workspace-management';
import {workspaceOf} from './workspaces';

/** The chosen space owns its draft; a stale activeDraftId must never choose the space. */
export function restoreWorkspaceSession(state:StudioData,previous:Partial<StudioData>={}):Pick<StudioData,'activeWorkspaceId'|'activeDraftId'|'drafts'|'workspaceRestoreNotice'> {
 const requested=state.activeWorkspaceId||'personal',exists=state.workspaces.some(space=>space.id===requested);
 const oldActor=previous.workspaceActors?.[requested];
 const revoked=Boolean(oldActor&&oldActor!=='self'&&!state.workspaceMembers[requested]?.some(member=>member.id===oldActor&&member.status==='member'));
 const accessible=exists&&!state.workspaces.find(space=>space.id===requested)?.archivedAt&&!revoked&&Boolean(workspaceRole(state,requested));
 const activeWorkspaceId=accessible?requested:'personal';
 const existing=state.drafts.find(draft=>draft.id===state.activeDraftId&&workspaceOf(draft)===activeWorkspaceId)||state.drafts.find(draft=>workspaceOf(draft)===activeWorkspaceId);
 const preferredModel=state.drafts.find(draft=>draft.id===state.activeDraftId)?.model;
 const active=existing||createDraft({workspaceId:activeWorkspaceId,...(preferredModel?{model:preferredModel}:{})});
 return {activeWorkspaceId,activeDraftId:active.id,drafts:existing?state.drafts:[active,...state.drafts],workspaceRestoreNotice:accessible?undefined:exists?'原空间的访问权限已变化，已返回个人空间；原空间资料没有移动。':'原空间已不可用，已返回个人空间；原空间资料没有移动。'};
}
