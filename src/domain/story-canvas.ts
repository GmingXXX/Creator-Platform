import type {StoryNode,StoryEdge} from './types';
export const storyKinds={start:'开始节点',scene:'普通节点',photo:'拍照节点',end:'结束节点'} as const;
export function storyKind(value:string):keyof typeof storyKinds {
 if(value==='ending'||value==='end')return 'end';
 if(value==='start'||value==='photo')return value;
 return 'scene';
}
export const storyTriggers={delay:'进入后等待',click:'点击选项',videoEnd:'视频播放完毕',htmlComplete:'互动体验完成',photoConfirm:'确认照片',photoSkip:'跳过拍照',layerClick:'点击画面控件'} as const;
export type StoryTrigger=keyof typeof storyTriggers;
export interface StoryEffect {id:string;kind:"show"|"hide";layerId:string}
export interface StoryLayer {
 variant?:'qr'|'mask';resultSource?:'photo'|'faceImage'|'faceVideo';qrText?:string;
 locked?:boolean;opacity?:number;fontFamily?:string;background?:string;radius?:number;weight?:number;align?:'left'|'center'|'right';
 fit?:'contain'|'cover'|'fill';volume?:number;loop?:boolean;autoplay?:boolean;
 hidden?:boolean;id:string;name:string;kind:'text'|'button'|'image'|'video'|'html';text:string;x:number;y:number;width:number;height:number;color?:string;size?:number;src?:string;assetId?:string}
export function storyRoute(edges:StoryEdge[],source:string,trigger:StoryTrigger,layerId?:string){
 return edges.find(edge=>(edge.target||edge.stay)&&edge.source===source&&(edge.trigger||'click')===trigger&&edge.layerId===layerId);
}
export function endingReachabilityError(nodes:StoryNode[],edges:StoryEdge[]){
 const reached=new Set(nodes.filter(n=>storyKind(n.type)==='end').map(n=>n.id)),queue=[...reached];
 for(let i=0;i<queue.length;i++)for(const e of edges){
  if(!e.stay&&e.target===queue[i]&&!reached.has(e.source)){reached.add(e.source);queue.push(e.source);}
 }
 const blocked=nodes.filter(n=>!reached.has(n.id)).map(n=>'「'+n.title+'」');
 return blocked.length?'无法抵达结局：'+blocked.join('、')+'。请添加一条前往结局的路径。':'';
}
export function layoutStory(nodes:StoryNode[],allEdges:StoryEdge[]){
 const visited=new Set<string>(),active=new Set<string>(),returns=new Set<string>();
 const visit=(id:string)=>{if(visited.has(id))return;visited.add(id);active.add(id);for(const e of allEdges.filter(e=>e.source===id&&e.target)){if(active.has(e.target))returns.add(e.id);else visit(e.target);}active.delete(id);};
 nodes.filter(n=>n.type==='start').forEach(n=>visit(n.id));nodes.forEach(n=>visit(n.id));
 const edges=allEdges.filter(e=>!returns.has(e.id)&&e.target);
 const depths=new Map<string,number>(),pending=new Set(nodes.map(n=>n.id));
 for(let step=0;step<nodes.length&&pending.size;step++){
  for(const node of nodes){
   if(!pending.has(node.id))continue;
   const parents=edges.filter(e=>e.target===node.id&&pending.has(e.source));
   if(parents.length)continue;
   const depth=Math.max(0,...edges.filter(e=>e.target===node.id).map(edge=>(depths.get(edge.source)??-1)+1));
   depths.set(node.id,depth);pending.delete(node.id);
  }
 }
 const rows=new Map<number,number>();
 return nodes.map(n=>{const depth=depths.get(n.id)??0,row=rows.get(depth)||0;rows.set(depth,row+1);return {...n,x:depth*226+18,y:row*102+24};});
}
