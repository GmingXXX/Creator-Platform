import {catalogIsHidden} from './admin-management';
import {withoutPresentationKnowledge,workWithoutPresentationKnowledge} from './presentation-knowledge-sharing';
import type {Asset,StudioData} from './types';
import {collectAssetTreeDependencies,remapAssetReferences} from './workspace-transfer';
import {assetVersion,existingAdoption} from './resource-adoption';
import {assetDependencyError} from './resource-permissions';
import {getAssetMetadata} from './asset-metadata';
import {now,uid} from './scenes';

/** An explicit adoption copies the dependency tree in memory before committing any records. */
export function prepareAssetAdoption(state:StudioData,source:Asset,target:string):{asset:Asset;assets:Asset[]} {
 if(source.public&&catalogIsHidden('asset',source.id))throw new Error('该共享素材已从社区下架，请选择其他素材。');
 const dependencies=collectAssetTreeDependencies(state,source),time=now();
 const local=(asset:Asset)=>asset.source==='builtin'&&!asset.workspaceId||!asset.public&&(asset.workspaceId||'personal')===target;
 const mapping=new Map(dependencies.map(asset=>[asset.id,local(asset)?asset.id:existingAdoption(state.assets,asset,target)?.id||uid('asset')]));
 const copies=dependencies.filter(asset=>!state.assets.some(existing=>existing.id===mapping.get(asset.id))).map(asset=>{
  const mapped=remapAssetReferences(asset,mapping),params=mapped.package?.params;
  const {experienceWorkId:_link,...retainedParams}=params||{};
  return {...mapped,id:mapping.get(asset.id)!,workspaceId:target,public:false,source:asset.public?'community' as const:asset.source,author:'纪鸣',createdAt:time,updatedAt:time,origin:{assetId:asset.id,version:assetVersion(asset)},knowledgeTarget:undefined,metadata:getAssetMetadata(asset),sourceWorkId:undefined,archived:undefined,deletedAt:undefined,...(mapped.package?{package:{...mapped.package,params:withoutPresentationKnowledge(retainedParams)}}:{}),...(mapped.workSnapshot?{workSnapshot:workWithoutPresentationKnowledge(mapped.workSnapshot)}:{})};
 });
 const assets=[...copies,...state.assets],asset=assets.find(item=>item.id===mapping.get(source.id))!;
 const error=assetDependencyError(assets,asset,target);if(error)throw new Error(error);
 return {asset,assets};
}
