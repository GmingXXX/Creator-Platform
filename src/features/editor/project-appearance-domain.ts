import {resolveFontFamily} from '../../domain/text-style';
import type {DesignSystem,MotionConfig,SceneNode,ScenePage,Work} from '../../domain/types';

interface Rect {x:number;y:number;w:number;h:number}
function bounds(group:SceneNode[]):Rect {
 const x=Math.min(...group.map(n=>n.x)),y=Math.min(...group.map(n=>n.y));
 return {x,y,w:Math.max(1,...group.map(n=>n.x+n.w-x)),h:Math.max(1,...group.map(n=>n.y+n.h-y))};
}
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function clusters(nodes:SceneNode[]):SceneNode[][]{
 return nodes.reduce<SceneNode[][]>((groups,node)=>{
  const merging=groups.filter(group=>group.some(other=>overlaps(node,other)));
  return [...groups.filter(group=>!merging.includes(group)),[...merging.flat(),node]];
 },[]).sort((a,b)=>{const first=bounds(a),second=bounds(b);return Math.abs(first.y-second.y)<Math.min(first.h,second.h)*.4?first.x-second.x:first.y-second.y;});
}
function place(n:SceneNode,x:number,y:number,scale:number):SceneNode{
 const sized=(v:number)=>Math.round(v*scale*100)/100;
 return {...n,x:Math.round(x),y:Math.round(y),w:Math.max(1,sized(n.w)),h:Math.max(1,sized(n.h)),fontSize:Math.max(1,sized(n.fontSize)),radius:sized(n.radius||0),
  ...(n.gap!==undefined?{gap:sized(n.gap)}:{}),...(n.titleStyle?.fontSize?{titleStyle:{...n.titleStyle,fontSize:sized(n.titleStyle.fontSize)}}:{}),...(n.bodyStyle?.fontSize?{bodyStyle:{...n.bodyStyle,fontSize:sized(n.bodyStyle.fontSize)}}:{})};
}
function resizePage(page:ScenePage,work:Work,width:number,height:number):ScenePage{
 const sx=width/work.width,sy=height/work.height,k=Math.min(sx,sy);
 const changedOrientation=(work.width>work.height)!==(width>height);
 if(!changedOrientation)return {...page,nodes:page.nodes.map(n=>place(n,n.x*sx,n.y*sy,k))};
 const backdrops=page.nodes.filter(n=>n.x<=0&&n.y<=0&&n.w>=work.width&&n.h>=work.height);
 const groups=clusters(page.nodes.filter(n=>!backdrops.includes(n))),portrait=width<=height;
 const gap=Math.min(Math.min(width,height)*.035,(portrait?height:width)*.25/(groups.length+1));
 const slots=Math.max(1,groups.length),slotWidth=portrait?width-gap*2:(width-gap*(slots+1))/slots,slotHeight=portrait?(height-gap*(slots+1))/slots:height-gap*2;
 const reframed=groups.flatMap((group,i)=>{
  const box=bounds(group),scale=Math.max(.01,Math.min(slotWidth/box.w,slotHeight/box.h));
  const x=gap+(portrait?0:i*(slotWidth+gap))+(slotWidth-box.w*scale)/2,y=gap+(portrait?i*(slotHeight+gap):0)+(slotHeight-box.h*scale)/2;
  return group.map(n=>place(n,x+(n.x-box.x)*scale,y+(n.y-box.y)*scale,scale));
 });
 const byId=new Map(reframed.map(n=>[n.id,n]));
 return {...page,nodes:page.nodes.map(n=>byId.get(n.id)||{...n,x:0,y:0,w:width,h:height})};
}
function resizeMotion(motion:MotionConfig,sx:number,sy:number):MotionConfig{
 const factors:Record<string,number>={x:sx,y:sy,width:sx,height:sy};
 return {...motion,
  ...(motion.keyframes?{keyframes:motion.keyframes.map(frame=>({...frame,x:frame.x*sx}))}:{}),
  ...(motion.sequences?{sequences:motion.sequences.map(sequence=>({...sequence,clips:sequence.clips.map(clip=>({
   ...clip,keys:Object.fromEntries(Object.entries(clip.keys).map(([property,frames])=>[
    property,factors[property]===undefined?frames:frames.map(frame=>({...frame,v:frame.v*factors[property]}))
   ]))
  }))}))}:{})
 };
}
export function motionReviewItems(work:Work,width:number,height:number):string[]{
 if((work.width>work.height)===(width>height))return [];
 return work.pages.flatMap(page=>page.nodes.filter(node=>{
  const m=node.motion;return m&&(m.keyframes?.length||m.sequences?.some(s=>s.clips.length)||m.preset!=='无动效');
 }).map(node=>page.name+' · '+node.name));
}
export function resizeProject(work:Work,width:number,height:number):Work{
 if(![width,height].every(v=>Number.isInteger(v)&&v>=320&&v<=16384))throw new Error('宽度和高度须为 320–16384 之间的整数。');
 if(width===work.width&&height===work.height)return work;
 const storyNodes=work.storyNodes?.map(node=>{
  if(!node.layers?.length)return node;
  // Node-level layers use percentages. Compose in native pixels so overlapping hotspots travel with the media.
  const nodes=node.layers.map((l):SceneNode=>({id:l.id,name:l.name,type:l.kind,content:l.text,x:l.x*work.width/100,y:l.y*work.height/100,w:l.width*work.width/100,h:l.height*work.height/100,fontSize:(l.size||3)*work.width/100,locked:false,hidden:false,opacity:1,rotation:0,radius:0,color:l.color||'',background:''}));
  const fitted=resizePage({id:node.id,name:node.title,background:'',nodes},work,width,height).nodes;
  return {...node,layers:node.layers.map((l,i)=>({...l,x:fitted[i].x/width*100,y:fitted[i].y/height*100,width:fitted[i].w/width*100,height:fitted[i].h/height*100,...(l.size?{size:fitted[i].fontSize/width*100}:{})}))};
 });
 return {...work,width,height,pages:work.pages.map(page=>{
  const fitted=resizePage(page,work,width,height);
  return {...fitted,nodes:fitted.nodes.map(node=>node.motion?{...node,motion:resizeMotion(node.motion,width/work.width,height/work.height)}:node)};
 }),...(storyNodes?{storyNodes}:{})};
}
export function applyProjectStyle(work:Work,next:DesignSystem,prior?:DesignSystem,reset=false):Work{
 const inherits=(value?:string,previous?:string)=>reset||!value||value===previous;
 const storyNodes=work.storyNodes?.map(node=>node.layers?{...node,layers:node.layers.map(layer=>inherits(layer.color,prior?.text)?{...layer,color:next.text}:layer)}:node);
 return {...work,styleId:next.id,...(storyNodes?{storyNodes}:{}),pages:work.pages.map(page=>({...page,
  background:inherits(page.background,prior?.background)||!prior?next.background:page.background,
  backgroundImage:prior&&page.backgroundImage==='/media/'+prior.id+'.svg'?'/media/'+next.id+'.svg':page.backgroundImage,
  nodes:page.nodes.map(node=>({...node,
   color:inherits(node.color,prior?.text)||(!prior&&['#fff','#ffffff','#111','#111111','#242830'].includes(node.color))?next.text:node.color,
   background:node.type==='button'&&inherits(node.background,prior?.accent)?next.accent:node.background,
   fontFamily:inherits(node.fontFamily,resolveFontFamily(prior?.font))?resolveFontFamily(next.font):node.fontFamily,
  }))
 }))};
}
