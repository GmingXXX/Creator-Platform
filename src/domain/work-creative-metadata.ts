import type {Work} from './types';
import {pushHistory,type History} from '../features/editor/editor-domain';

/** Creative records have their own history; canvas undo/save must not rewind them. */
export function retainCreativeMetadata(content:Work,owner:Work):Work {
 const pack=content.creationPackage||owner.creationPackage;
 return {...content,experience:owner.experience,references:owner.references,referenceHistory:owner.referenceHistory,referenceSnapshots:owner.referenceSnapshots,
  ...(pack?{creationPackage:{...pack,experience:owner.experience||owner.creationPackage?.experience,references:owner.references||owner.creationPackage?.references,referenceHistory:owner.referenceHistory||owner.creationPackage?.referenceHistory}}:{}),
 };
}
function canvasContent(work:Work){
 const {experience:_experience,references:_references,referenceHistory:_history,referenceSnapshots:_snapshots,revision:_revision,updatedAt:_time,workspaceId,creationPackage,...content}=work;
 if(!creationPackage)return {...content,workspaceId:workspaceId||'personal'};
 const {experience:_pe,references:_pr,referenceHistory:_ph,...pack}=creationPackage;
 return {...content,workspaceId:workspaceId||'personal',creationPackage:pack};
}
export function syncCreativeHistory(history:History<Work>,next:Work):History<Work>{
 const synchronized={past:history.past.map(work=>retainCreativeMetadata(work,next)),present:retainCreativeMetadata(history.present,next),future:history.future.map(work=>retainCreativeMetadata(work,next))};
 return JSON.stringify(canvasContent(history.present))===JSON.stringify(canvasContent(next))?{...synchronized,present:next}:pushHistory(synchronized,next);
}
