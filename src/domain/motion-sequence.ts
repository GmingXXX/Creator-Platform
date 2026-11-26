import type {MotionConfig,SceneNode} from './types';
export const properties={x:'水平移动',y:'垂直移动',width:'宽度变化',height:'高度变化',scale:'缩放',rotation:'旋转',opacity:'不透明度'} as const;
export type Property=keyof typeof properties;
export const base={x:0,y:0,width:0,height:0,scale:1,rotation:0,opacity:1};
export const presetGroups={
 基础:['无动效'],进入:['淡入','向上滑入','轻弹进入'],退出:['淡出','向左滑出'],
 强调:['聚焦放大','缩小复位','放大再复位','旋转强调'],
 页面运镜:['镜头推进','镜头平移','镜头拉远'],交接:['交叉淡化','推拉切换','聚焦展开','方向擦除','圆形揭示'],
};
export const speeds={linear:'匀速',easeIn:'渐快',easeOut:'渐慢',easeInOut:'两端慢、中间快',hold:'保持'} as const;
export type Speed=keyof typeof speeds;
export type Frame={t:number;v:number;ease?:Speed};
export type Clip={id:string;target:string;track:number;start:number;duration:number;preset:string;speed:Speed;custom?:boolean;keys:Partial<Record<Property,Frame[]>>};
export type Join={left:string;right:string;preset:string};
export type Sequence={binding:string;when:'before'|'together'|'after';hold:boolean;clips:Clip[];joins:Join[];mediaAuto?:boolean};
const round=(v:number)=>Math.round(v*1000)/1000;
export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
export const lengthOf=(s:Sequence)=>Math.max(.1,...s.clips.map(c=>c.start+c.duration));
export function makeClip(target:string,preset:string,duration=1):Clip{
 const d=Math.max(.1,duration);
 const curve=(values:number[])=>values.map((v,i)=>({t:round(i*d/(values.length-1)),v}));
 const maps:Record<string,Clip['keys']>={
 '无动效':{},'淡入':{opacity:curve([0,1])},'向上滑入':{y:curve([80,0]),opacity:curve([0,1])},'轻弹进入':{scale:curve([.65,1.08,1]),opacity:curve([0,1])},
 '淡出':{opacity:curve([1,0])},'向左滑出':{x:curve([0,-100]),opacity:curve([1,0])},
 '聚焦放大':{scale:curve([1,1.4])},'缩小复位':{scale:curve([1.4,1])},'放大再复位':{scale:curve([1,1.22,1.22,1])},
 '旋转强调':{rotation:curve([0,-8,8,0])},'镜头推进':{scale:curve([1,1.4,1.4,1]),x:curve([0,-70,-70,0])},'镜头平移':{x:curve([0,100])},'镜头拉远':{scale:curve([1.4,1])},
 '交叉淡化':{opacity:curve([0,1])},'推拉切换':{x:curve([180,0])},'聚焦展开':{scale:curve([.6,1]),opacity:curve([0,1])},'方向擦除':{},'圆形揭示':{}};
 return {id:uid(),target,track:0,start:0,duration:d,preset,speed:'easeInOut',keys:maps[preset]||{}};
}
export function focusCamera(clip:Clip,source:Pick<SceneNode,'x'|'y'|'w'|'h'>,page:{width:number;height:number}):Clip{
 if(clip.preset!=='镜头推进')return clip;
 const scale=1.4,pan=(center:number,size:number)=>Math.max(-size*(scale-1)/2,Math.min(size*(scale-1)/2,(size/2-center)*scale));
 const axis=(initial:number,peak:number)=>[0,.2,.8,1].map((ratio,i)=>({t:round(clip.duration*ratio),v:i===1||i===2?peak:initial}));
 return {...clip,keys:{...clip.keys,x:axis(0,pan(source.x+source.w/2,page.width)),y:axis(0,pan(source.y+source.h/2,page.height)),scale:axis(1,scale)}};
}
export function stamp(c:Clip,p:Property,time:number,value:number,ease?:Speed):Clip{
 const t=round(Math.max(0,Math.min(c.duration,time))),previous=c.keys[p]||[],first=previous.length||t===0?[]:[{t:0,v:base[p]}];
 return {...c,custom:true,keys:{...c.keys,[p]:[...first,...previous.filter(k=>k.t!==t),{t,v:value,ease:ease??previous.find(k=>k.t===t)?.ease}].sort((a,b)=>a.t-b.t)}};
}
export function resizeClip(c:Clip,n:number):Clip{
 const inside=Object.values(c.keys).flat().filter(k=>k.t<c.duration).map(k=>k.t);
 const duration=round(Math.max(.1,n,...inside.map(t=>t+.01)));
 return {...c,duration,keys:Object.fromEntries(Object.entries(c.keys).map(([p,keys])=>[p,keys.map(k=>k.t===c.duration?{...k,t:duration}:k)]))};
}
export function moveClip(clips:Clip[],id:string,start:number,track:number){
 const c=clips.find(x=>x.id===id);if(!c)return clips;
 start=Math.max(0,round(start));
 if(clips.some(x=>x.id!==id&&x.target===c.target&&x.start<start+c.duration-.0001&&start<x.start+x.duration-.0001))return clips;
 return clips.map(x=>x.id===id?{...x,start,track}:x);
}
export const canJoin=(a:Clip,b:Clip)=>a.track===b.track&&a.id!==b.id&&Math.abs(a.start+a.duration-b.start)<.005;
export const tidyJoins=(clips:Clip[],joins:Join[])=>joins.filter(j=>clips.some(a=>a.id===j.left&&clips.some(b=>b.id===j.right&&canJoin(a,b))));
export function sample(c:Clip,time:number){
 const out={...base};
 for(const p of Object.keys(c.keys) as Property[]){
  const keys=c.keys[p]||[];if(!keys.length)continue;
  const i=keys.findIndex(k=>k.t>=time);
  if(i<=0){out[p]=(i===0?keys[0]:keys[keys.length-1]).v;continue}
  const a=keys[i-1],b=keys[i],t=Math.min(1,(time-a.t)/(b.t-a.t)),ease=a.ease||c.speed;
  const f=ease==='linear'?t:ease==='hold'?(t>=1?1:0):ease==='easeIn'?t*t:ease==='easeOut'?1-(1-t)**2:t*t*(3-2*t);
  out[p]=a.v+(b.v-a.v)*f;
 }
 return out;
}
export function sampleStyle(c:Clip,time:number):Record<string,string>{
 const v=sample(c,time),f=Math.max(0,Math.min(1,time/c.duration));
 const result:Record<string,string>={transform:'translate('+v.x+'px,'+v.y+'px) rotate('+v.rotation+'deg) scale('+v.scale+')',opacity:String(v.opacity)};
 if(v.width)result.width='calc(100% + '+v.width+'px)';
 if(v.height)result.height='calc(100% + '+v.height+'px)';
 if(c.preset==='方向擦除')result.clipPath='inset(0 '+(1-f)*100+'% 0 0)';
 if(c.preset==='圆形揭示')result.clipPath='circle('+f*145+'% at 50% 50%)';
 return result;
}
export function fromLegacy(n:SceneNode):Sequence{
 const m=n.motion,cam=m?.preset==='页面推进',aliases:Record<string,string>={'页面推进':'镜头推进','强调脉冲':'放大再复位','向上移入':'向上滑入','轻弹进入':'轻弹进入'};
 let c=makeClip(cam?'@page':n.id,m?aliases[m.preset]||m.preset:'无动效',m?.duration||1);
 for(const k of m?.keyframes||[]){c=stamp(stamp(c,'x',k.time,k.x),'opacity',k.time,k.opacity)}
 return {binding:n.type==='video'?'videoStart':'click',when:'together',hold:m?.hold||false,mediaAuto:n.type==='video',clips:[{...c,start:m?.delay||0}],joins:[]};
}
export function readSequences(n:SceneNode):Sequence[]{return n.motion?.sequences||[fromLegacy(n)]}
export function storeSequences(previous:MotionConfig|undefined,sequences:Sequence[]):MotionConfig{
 return {...(previous||{preset:'无动效',duration:1,delay:0,easing:'linear',hold:false}),sequences};
}
