import {parseAIPlan,type AIPlan} from './ai-plan';
import {assetAvailableForAI,assetAvailableForInsertion} from './asset-access';
import {getAssetMetadata} from './asset-metadata';
import type {Asset} from './types';

/** Resolve references again at confirmation time; a picker selection is not a permanent permission. */
export function confirmExhibitPlan(plan:AIPlan,attachmentIds:string[],assets:Asset[],workspaceId:string){
 const checked=parseAIPlan(JSON.stringify(plan));
 const selected=checked.sections?.flatMap(section=>section.imageAssetId?[section.imageAssetId]:[])||[];
 for(const id of selected){
  const asset=assets.find(item=>item.id===id);
  if(!asset||asset.kind!=='image'||!assetAvailableForInsertion(asset,workspaceId)||!assetAvailableForAI(asset,workspaceId)||getAssetMetadata(asset).business.usage==='reference')
   throw new Error('部分配图已不可用或仅供参考，请重新选择。');
 }
 return {aiPlan:checked,attachmentIds:[...new Set([...attachmentIds,...selected])]};
}
