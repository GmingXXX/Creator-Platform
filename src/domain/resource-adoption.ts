import type {Asset, Work} from './types';
import {assetAvailableForInsertion} from './asset-access';

/** Include content as well as the advertised version, because legacy publications replace IDs. */
export function assetVersion(asset:Asset):string {
  const snapshot=JSON.stringify({src:asset.src,preview:asset.preview,name:asset.name,kind:asset.kind,
    description:asset.description,tags:asset.tags,componentType:asset.componentType,
    metadata:asset.metadata,package:asset.package,work:asset.workSnapshot,updatedAt:asset.updatedAt});
  let hash=2166136261;
  for(let index=0;index<snapshot.length;index++)hash=Math.imul(hash^snapshot.charCodeAt(index),16777619);
  return `${asset.package?.version||'1'}-${(hash>>>0).toString(16)}`;
}

export function existingAdoption(assets:Asset[],asset:Asset,workspaceId:string):Asset|undefined {
  const version=assetVersion(asset);
  return assets.find(item=>!item.public&&!item.deletedAt&&!item.archived&&(item.workspaceId||'personal')===workspaceId
    &&item.origin?.assetId===asset.id&&item.origin.version===version);
}

/** Pin known library dependencies; unregistered external URLs remain unchanged, not silently imported. */
export function adoptWorkResources(work:Work,assets:Asset[],workspaceId:string,adopt:(id:string,workspaceId:string)=>Asset|undefined,explicitOnly=false):Work {
  const eligible=assets.filter(asset=>assetAvailableForInsertion(asset,workspaceId));
  const resolve=(src:string|undefined,id?:string,kinds:string[]=['image','video','audio','html','component'])=>{
    if(!src||(explicitOnly&&!id&&!/^(idb:|blob:)/.test(src)))return undefined;
    const matches=eligible.filter(asset=>asset.src===src&&kinds.includes(asset.kind));
    const source=matches.find(asset=>asset.id===id)||matches.find(asset=>!asset.public&&asset.workspaceId===workspaceId)||matches[0];
    return source?adopt(source.id,workspaceId):undefined;
  };
  const coverMatches=eligible.filter(asset=>asset.kind==='image'||asset.kind==='video').filter(asset=>asset.src===work.cover||asset.preview===work.cover);
  const coverSource=work.coverAssetId?coverMatches.find(asset=>asset.id===work.coverAssetId):coverMatches[0];
  if(work.coverAssetId&&!coverSource)throw new Error('封面素材已不可用，请重新选择');
  const cover=coverSource?adopt(coverSource.id,workspaceId):undefined;
  const source=work.creationPackage?.sourceId?eligible.find(asset=>asset.id===work.creationPackage?.sourceId):undefined;
  const packageSource=source?adopt(source.id,workspaceId):undefined;
  const pack=work.creationPackage?{...structuredClone(work.creationPackage),...(packageSource?{sourceId:packageSource.id}:{}),
    files:work.creationPackage.files.map(file=>{resolve(file.src);return {...file};})}:undefined;
  return {...work,...(cover?{coverAssetId:cover.id}:{}),...(pack?{creationPackage:pack}:{}),pages:work.pages.map(page=>{
    const background=resolve(page.backgroundImage,page.backgroundAssetId,['image']);
    return {...page,...(background?{backgroundAssetId:background.id}:{}),nodes:page.nodes.map(node=>{
      const asset=resolve(node.src,node.assetId,[node.type]);
      return {...node,...(asset?{assetId:asset.id}:{}),...(node.items?{items:node.items.map(item=>{
        const image=resolve(item.image,item.assetId,['image']);return image?{...item,assetId:image.id}:item;
      })}:{})};
    })};
  }),...(work.shots?{shots:work.shots.map(shot=>{const asset=resolve(shot.src,shot.assetId,['image','video']);return asset?{...shot,assetId:asset.id}:shot;})}:{}),
    ...(work.storyNodes?{storyNodes:work.storyNodes.map(node=>{const asset=resolve(node.media,node.mediaAssetId,['image','video','html']);return asset?{...node,mediaAssetId:asset.id}:node;})}:{}),
  };
}
