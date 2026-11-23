import type {Asset} from '../../domain/types';
import type {SourceFile} from '../../domain/document-intake';
import {assetAvailableForAI} from '../../domain/asset-access';
/** Keep references and bounded parsed text; binaries remain in the asset store. */
export function checkpointSources(files:SourceFile[]){return files.map(file=>({assetId:file.asset.id,text:file.text.slice(0,24000),status:file.status.slice(0,200)}));}
export function restoreCheckpointSources(value:unknown,assets:Asset[],workspaceId:string):SourceFile[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(item=>{
  if(!item||typeof item.assetId!=='string'||typeof item.text!=='string'||typeof item.status!=='string')return [];
  const asset=assets.find(asset=>asset.id===item.assetId&&assetAvailableForAI(asset,workspaceId));
  return asset?[{asset,text:item.text.slice(0,24000),status:item.status.slice(0,200)}]:[];
 });
}
