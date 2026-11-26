import type {Asset, Work} from '../../domain/types';
import {assetAvailableForAI,assetAvailableForInsertion} from '../../domain/asset-access';
import {createNode} from './editor-domain';
import {replacePageBackground} from './editor-materials';

export function editorBackgroundContext(work:Work, targetId?:string) {
  if(work.kind==='story'){
    const node=targetId?work.storyNodes?.find(item=>item.id===targetId):work.storyNodes?.[0];
    if(!node)return;
    const nodes=(node.layers||[]).map(layer=>({
      ...createNode(layer.kind),id:layer.id,name:layer.name,content:layer.text,
      x:layer.x*work.width/100,y:layer.y*work.height/100,w:layer.width*work.width/100,h:layer.height*work.height/100,
      hidden:Boolean(layer.hidden),color:layer.color||''
    }));
    const page={id:node.id,name:node.title,notes:[node.backgroundBrief,node.text].filter(Boolean).join("。"),background:'',backgroundImage:node.media,backgroundAssetId:node.mediaAssetId,nodes};
    return {work:{...work,pages:[page]},page,targetId:node.id,name:node.title};
  }
  const page=targetId?work.pages.find(item=>item.id===targetId):work.pages[0];
  if(page)return {work,page,targetId:page.id,name:page.name};
}

export function applyEditorBackground(work:Work,targetId:string,asset:Asset):Work {
  if(work.kind!=='story')return replacePageBackground(work,targetId,asset);
  if(asset.public||asset.kind!=='image'||!assetAvailableForInsertion(asset,work.workspaceId||'personal')||
     !work.storyNodes?.some(node=>node.id===targetId))return work;
  return {...work,storyNodes:work.storyNodes.map(node=>node.id===targetId?{...node,media:asset.src,mediaAssetId:asset.id}:node)};
}

export function editorBackgroundHistory(work:Work,targetId:string|undefined,assets:Asset[]):string[] {
  const pageId=targetId||(work.kind==='story'?work.storyNodes?.[0]?.id:work.pages[0]?.id);
  if(!pageId)return [];
  return assets.filter(asset=>asset.kind==='image'&&asset.package?.params.targetWorkId===work.id
    &&asset.package.params.targetPageId===pageId&&asset.package.params.userPrompt&&assetAvailableForAI(asset,work.workspaceId||'personal'))
    .slice(0,3).reverse().map(asset=>asset.package!.params.userPrompt);
}
