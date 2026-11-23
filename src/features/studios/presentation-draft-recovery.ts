import type {Work} from '../../domain/types';
import type {PresentationSection} from '../../domain/presentation-generation';
export type PresentationDraftCheckpoint={draftWorkId:string;draftSignature:string};
type PlanInput={title:string;topic:string;sections:PresentationSection[];sources:{assetId:string;text:string;status:string}[];styleId:string;model:string;resolution:string;width:number;height:number;audience:string;usedSkills:unknown[]};
/** Review IDs and the current wizard step do not change the rendered work. */
export function presentationDraftSignature(input:PlanInput):string{
 return JSON.stringify({...input,sections:input.sections.map(({title,narration,bullets,layout,imageAssetId})=>({title,narration,bullets,layout,imageAssetId}))});
}
export function findPresentationDraft(checkpoint:PresentationDraftCheckpoint|undefined,works:Work[],workspaceId:string,requestKey:string,signature:string,canEdit:boolean):Work|undefined{
 if(!canEdit||!checkpoint||checkpoint.draftSignature!==signature)return;
 return works.find(work=>work.id===checkpoint.draftWorkId&&(work.workspaceId||'personal')===workspaceId&&work.kind==='presentation'&&!work.deletedAt&&!work.archived&&work.creationPackage?.params.presentationCreationRequestKey===requestKey&&work.creationPackage.params.presentationDraftSignature===signature);
}
