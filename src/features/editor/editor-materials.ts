import type {Asset, NodeKind, SceneNode, Work} from '../../domain/types';
import {assetAvailableForInsertion} from '../../domain/asset-access';
import {createNode, nodeLabels, uid} from './editor-domain';

export function materialNodeKind(asset:Asset):NodeKind|undefined {
 if (['image','video','audio','html'].includes(asset.kind)) return asset.kind as NodeKind;
 if (asset.kind==='component' && asset.componentType && Object.hasOwn(nodeLabels,asset.componentType)) return asset.componentType;
 return undefined;
}

/** Native schemas provide content only; geometry, media URLs and executable fields are not trusted. */
function componentContent(asset:Asset):Partial<Pick<SceneNode,'content'|'items'>> {
 if(asset.kind!=='component')return {};
 const text=asset.package?.files.find(file=>file.name==='component.schema.json'&&file.type==='component')?.content;
 if(!text||text.length>200_000)return {};
 try {
  const schema:unknown=JSON.parse(text);
  if(!schema||typeof schema!=='object'||Array.isArray(schema))return {};
  const data=schema as Record<string,unknown>;
  if(data.type!==asset.componentType)return {};
  const content=typeof data.content==='string'?data.content.slice(0,10000):undefined;
  const items=Array.isArray(data.items)?data.items.slice(0,100).filter(item=>item&&typeof item==='object'&&!Array.isArray(item)).map(item=>({
   id:uid(),title:typeof item.title==='string'?item.title.slice(0,200):'',description:typeof item.description==='string'?item.description.slice(0,10000):'',
   ...(typeof item.year==='string'?{year:item.year.slice(0,40)}:{}),
  })):undefined;
  return {...(content!==undefined?{content}:{}),...(items?{items}:{})};
 }catch{return {};}
}

/** Community assets are adopted before editing, so saved scenes always pin a private version. */
function usable(work:Work,asset:Asset):boolean {
 return !asset.public && assetAvailableForInsertion(asset,work.workspaceId||'personal') && Boolean(materialNodeKind(asset));
}

export function insertMaterial(work:Work,pageId:string,asset:Asset,point={x:Math.round(work.width*.12),y:Math.round(work.height*.16)}):Work {
 const kind=materialNodeKind(asset);
 if (!kind || !usable(work,asset) || !work.pages.some(page=>page.id===pageId)) return work;
 const base=createNode(kind);
 const width=Math.min(base.w,work.width*.76),height=Math.min(base.h,work.height*.65);
 const node={...base,...componentContent(asset),name:asset.name,src:asset.src,assetId:asset.id,w:width,h:height,x:Math.max(0,Math.min(work.width-width,point.x)),y:Math.max(0,Math.min(work.height-height,point.y))};
 return {...work,pages:work.pages.map(page=>page.id===pageId?{...page,nodes:[...page.nodes,node]}:page)};
}

export function replaceNodeMaterial(work:Work,pageId:string,nodeId:string,asset:Asset):Work {
 const node=work.pages.find(page=>page.id===pageId)?.nodes.find(item=>item.id===nodeId);
 if (!node || node.locked || !usable(work,asset) || !['image','video','audio','html'].includes(node.type) || node.type!==asset.kind) return work;
 return {...work,pages:work.pages.map(page=>page.id===pageId?{...page,nodes:page.nodes.map(item=>item.id===nodeId?{...item,src:asset.src,assetId:asset.id}:item)}:page)};
}

export function replacePageBackground(work:Work,pageId:string,asset:Asset):Work {
 if (asset.kind!=='image' || !usable(work,asset) || !work.pages.some(page=>page.id===pageId)) return work;
 return {...work,pages:work.pages.map(page=>page.id===pageId?{...page,backgroundImage:asset.src,backgroundAssetId:asset.id}:page)};
}

export function replaceItemImage(work:Work,pageId:string,nodeId:string,itemId:string,asset:Asset):Work {
 const node=work.pages.find(page=>page.id===pageId)?.nodes.find(item=>item.id===nodeId);
 if (asset.kind!=='image' || !usable(work,asset) || !node || node.locked || !node.items?.some(item=>item.id===itemId)) return work;
 return {...work,pages:work.pages.map(page=>page.id===pageId?{...page,nodes:page.nodes.map(item=>item.id===nodeId?{...item,items:item.items!.map(content=>content.id===itemId?{...content,image:asset.src,assetId:asset.id}:content)}:item)}:page)};
}
