import type {StoryLayer} from './story-canvas';
import type {Asset,StoryNode} from './types';

export const storyTools={
 text:'文本',button:'互动按钮',mask:'蒙版',qr:'二维码',image:'图片',video:'视频',html:'HTML 互动',
 photo:'拍摄照片',faceImage:'换脸图片',faceVideo:'换脸视频'
} as const;
export type StoryTool=keyof typeof storyTools;
export type LayerBounds=Pick<StoryLayer,'x'|'y'|'width'|'height'>;
export function storyShowsCaption(node:Pick<StoryNode,'showCaption'>){return node.showCaption!==false;}
export function fitStoryLayer(box:LayerBounds,snap:boolean):LayerBounds{
 const round=(v:number)=>snap?Math.round(v/2)*2:Number(v.toFixed(2));
 const width=Math.min(100,Math.max(2,round(box.width))),height=Math.min(100,Math.max(2,round(box.height)));
 return {x:Math.max(0,Math.min(100-width,round(box.x))),y:Math.max(0,Math.min(100-height,round(box.y))),width,height};
}
export function createStoryLayer(tool:StoryTool,asset?:Asset):StoryLayer{
 const name=asset?.name||storyTools[tool];
 const basic={id:crypto.randomUUID(),name,text:'',x:26,y:34,width:48,height:32,color:'#ffffff',size:3};
 switch(tool){
  case 'text':return {...basic,kind:'text',text:'请输入文字',height:12,align:'left'};
  case 'button':return {...basic,kind:'button',text:'继续',x:35,y:44,width:30,height:10,background:'#275c99',radius:12};
  case 'mask':return {...basic,kind:'text',variant:'mask',x:0,y:66,width:100,height:34,background:'#101624',opacity:.55};
  case 'qr':return {...basic,kind:'image',variant:'qr',qrText:'',width:23,height:23};
  case 'photo':case 'faceImage':case 'faceVideo':return {...basic,kind:tool==='faceVideo'?'video':'image',resultSource:tool};
  default:return {...basic,kind:tool,src:asset?.src,assetId:asset?.id,fit:'contain'};
 }
}
export function storyFontPixels(ratio:number|undefined,canvasWidth:number) {
 return Math.round((ratio??3)*canvasWidth/100);
}
export function storyFontRatio(pixels:number,canvasWidth:number) {
 return Math.max(1,Math.min(canvasWidth,Number.isFinite(pixels)?pixels:1))*100/canvasWidth;
}
export function copyStoryLayer(layer:StoryLayer):StoryLayer{
 return {...layer,id:crypto.randomUUID(),name:layer.name+' 副本',locked:false,...fitStoryLayer({...layer,x:layer.x+3,y:layer.y+3},false)};
}
export function reorderStoryLayer(layers:StoryLayer[],id:string,step:number){
 const i=layers.findIndex(l=>l.id===id),next=i+step;
 if(i<0||layers[i].locked||next<0||next>=layers.length)return layers;
 const remaining=layers.filter(l=>l.id!==id);
 return [...remaining.slice(0,next),layers[i],...remaining.slice(next)];
}
export function storyLayerTitle(layer:StoryLayer){return storyTools[layer.variant||layer.resultSource||layer.kind];}
