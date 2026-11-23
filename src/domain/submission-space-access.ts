import type {StudioData,Submission} from './types';
import {workspaceRole} from './workspace-management';
import {skillAvailableToActor} from './skill-access';
/** Published copies remain independent; private submission snapshots follow their original space. */
export function submissionSpaceVisible(state:Pick<StudioData,'workspaces'|'workspaceMembers'|'workspaceActors'|'skills'|'activeWorkspaceId'>,submission:Submission):boolean {
 if(submission.status==='approved')return true;
 if(submission.skill){
  const original=state.skills.find(skill=>skill.id===submission.skill!.id);
  return Boolean(original&&skillAvailableToActor(original,state));
 }
 const source=submission.work||submission.asset||submission.skill;
 return Boolean(workspaceRole(state,source?.workspaceId||'personal'));
}
