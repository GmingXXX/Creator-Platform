import type {Asset, CreationPackage, Work} from './types';
import {assetAvailableForAI, assetAvailableInSpace} from './asset-access';

type AccessMode='manual'|'ai';
interface Context {assets:Asset[];workspaceId:string;mode:AccessMode;visited:Set<string>}
const unavailable='素材依赖包含不可访问、已移除或未授权的私有资源，请先处理依赖后再使用。';
const available=(asset:Asset,context:Context)=>context.mode==='ai'?assetAvailableForAI(asset,context.workspaceId):assetAvailableInSpace(asset,context.workspaceId)&&!asset.deletedAt&&!asset.archived;

function checkAsset(asset:Asset,context:Context):string|undefined {
  if(!available(asset,context))return unavailable;
  if(context.visited.has(asset.id))return;
  if(context.visited.size>64)return '素材依赖层级过深，请整理资料包后重试。';
  const next={...context,visited:new Set([...context.visited,asset.id])};
  return (asset.package?checkPackage(asset.package,next):undefined)||(asset.workSnapshot?checkWork(asset.workSnapshot,next):undefined);
}

function checkReference(src:string|undefined,id:string|undefined,context:Context,preview=false):string|undefined {
  if(id){
    const exact=context.assets.find(asset=>asset.id===id);
    if(!exact||!available(exact,context)||(src&&exact.src!==src&&(!preview||exact.preview!==src)))return unavailable;
    return checkAsset(exact,context);
  }
  if(!src)return;
  if(/^(?:javascript|vbscript|data):/i.test(src.trim()))return unavailable;
  const matches=context.assets.filter(asset=>asset.src===src||(preview&&asset.preview===src));
  if(!matches.length)return src.startsWith('idb:')||src.startsWith('blob:')?unavailable:undefined;
  return matches.some(asset=>!checkAsset(asset,context))?undefined:unavailable;
}

function checkWork(work:Work,context:Context):string|undefined {
  const coverError=checkReference(work.cover,work.coverAssetId,context,true);if(coverError)return coverError;
  const references=work.pages.flatMap(page=>[
    {src:page.backgroundImage,id:page.backgroundAssetId},
    ...page.nodes.flatMap(node=>[{src:node.src,id:node.assetId},...(node.items||[]).map(item=>({src:item.image,id:item.assetId}))]),
  ]);
  references.push(...(work.shots||[]).map(shot=>({src:shot.src,id:shot.assetId})),...(work.storyNodes||[]).map(node=>({src:node.media,id:node.mediaAssetId})));
  for(const reference of references){const error=checkReference(reference.src,reference.id,context);if(error)return error;}
  return work.creationPackage?checkPackage(work.creationPackage,context):undefined;
}

function checkJson(value:unknown,context:Context,depth=0):string|undefined {
  if(depth>64)return unavailable;
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const entry of value){const error=checkJson(entry,context,depth+1);if(error)return error;}return;}
  const object=value as Record<string,unknown>;
  for(const [sourceKey,idKey] of [['src','assetId'],['image','assetId'],['backgroundImage','backgroundAssetId'],['media','mediaAssetId'],['cover','coverAssetId']]){
    const src=typeof object[sourceKey]==='string'?object[sourceKey] as string:undefined;
    const id=typeof object[idKey]==='string'?object[idKey] as string:undefined;
    if(src||id){const error=checkReference(src,id,context,sourceKey==='cover');if(error)return error;}
  }
  for(const entry of Object.values(object)){const error=checkJson(entry,context,depth+1);if(error)return error;}
}

function checkPackage(pack:CreationPackage,context:Context):string|undefined {
  if(pack.sourceId){
    const source=context.assets.find(asset=>asset.id===pack.sourceId);
    if(!source)return unavailable;
    const error=checkAsset(source,context);if(error)return error;
  }
  for(const file of pack.files){
    const sourceError=checkReference(file.src,undefined,context);if(sourceError)return sourceError;
    if(file.content){
      let parsed:unknown;
      try{parsed=JSON.parse(file.content);}catch{/* Prompt and source files can contain ordinary text. */}
      const jsonError=checkJson(parsed,context);if(jsonError)return jsonError;
      for(const match of file.content.matchAll(/(?:idb|blob):[^\s"'<>`\\]+/g)){
        const error=checkReference(match[0],undefined,context);if(error)return error;
      }
    }
  }
}

export function assetDependencyError(assets:Asset[],asset:Asset,workspaceId:string,mode:AccessMode='manual'):string|undefined {
  return checkAsset(asset,{assets,workspaceId,mode,visited:new Set()});
}
export function workDependencyError(assets:Asset[],work:Work,workspaceId:string,mode:AccessMode='manual'):string|undefined {
  return checkWork(work,{assets,workspaceId,mode,visited:new Set()});
}
export function packageDependencyError(assets:Asset[],pack:CreationPackage|undefined,workspaceId:string,mode:AccessMode='ai'):string|undefined {
  return pack?checkPackage(pack,{assets,workspaceId,mode,visited:new Set()}):undefined;
}
