import type {Asset,Work} from '../../domain/types';
import {assetAvailableForInsertion} from '../../domain/asset-access';
export function editorAssetSample(work:Work,kind:'image'|'video'|'component',prompt:string):Asset {
 const words=prompt.trim();if(!words)throw new Error('请描述需要的素材。');
 const src=kind==='image'?'/media/technology.svg':kind==='video'?'/media/demo-loop.mp4':'/media/interactive.html';
 return {id:crypto.randomUUID(),workspaceId:work.workspaceId||'personal',name:'演示样稿 · '+words.slice(0,24),kind:kind==='component'?'html':kind,src,preview:kind==='video'?'/media/demo-loop-poster.jpg':kind==='image'?src:'/media/technology.svg',description:'本地预置演示素材。需求：'+words,source:'generated',tags:['本地样稿'],createdAt:new Date().toISOString(),author:'当前用户',public:false};
}
export function insertStoryAsset(work:Work,nodeId:string,asset:Asset):Work{
 if(!assetAvailableForInsertion(asset,work.workspaceId||'personal')||!work.storyNodes?.some(n=>n.id===nodeId))return work;
 const kind=asset.kind;
 if(kind!=='image'&&kind!=='video'&&kind!=='html')return work;
 const layer={id:crypto.randomUUID(),name:asset.name,kind,text:'',x:15,y:15,width:70,height:65,src:asset.src,assetId:asset.id};
 return {...work,storyNodes:work.storyNodes.map(n=>n.id===nodeId?{...n,layers:[...(n.layers||[]),layer]}:n)};
}
