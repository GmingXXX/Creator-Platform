import {assetAvailableForAI} from './asset-access';
import {getAssetMetadata} from './asset-metadata';
import type {Asset,DesignSystem,NodeKind,SceneNode,ScenePage,Work} from './types';

const nodeNames:Record<NodeKind,string>={text:'文字',image:'图片',video:'视频',audio:'音频',shape:'形状',card:'卡片',timeline:'时间轴',gallery:'照片流',graph:'关系图',map:'热点图',flow:'流程图',chart:'数据看板',bubble:'语音气泡',button:'交互控件',html:'交互程序'};

function targetPage(work:Work,pageId:string){
 const page=work.pages.find(p=>p.id===pageId);
 if(!page)throw new Error('目标页面已不存在，请重新选择页面');
 return page;
}
function compact(value:string|undefined,limit:number){
 return (value||'').replace(/\s+/g,' ').trim().slice(0,limit);
}
function layoutNote(node:SceneNode,work:Work){
 const percent=(n:number,total:number)=>Math.round(n/total*100);
 const area=`左${percent(node.x,work.width)}% 上${percent(node.y,work.height)}% 宽${percent(node.w,work.width)}% 高${percent(node.h,work.height)}%`;
 const items=node.items?.slice(0,5).map(i=>compact([i.year,i.title].filter(Boolean).join(' '),28)).join('、');
 const text=node.type==='text'?compact(node.content,60):'';
 return [node.timelineLayout==='fishbone'?'鱼骨时间轴':nodeNames[node.type],compact(node.name,35),area,text,items].filter(Boolean).join(' · ');
}
export function appliedBackgroundReference(page:ScenePage,assets:Asset[],workspaceId?:string){
 const asset=assets.find(a=>page.backgroundAssetId?a.id===page.backgroundAssetId:!!page.backgroundImage&&a.src===page.backgroundImage);
 return asset&&assetAvailableForAI(asset,workspaceId)?asset:undefined;
}
export function describeBackgroundReference(asset:Asset){
 const metadata=getAssetMetadata(asset);
 const description=asset.package?.params.userPrompt||metadata.business.note||asset.description||metadata.analysis.summary;
 return [compact(asset.name,45),compact(description,85)].filter(Boolean).join(' · ');
}
export function buildWorkBackgroundPrompt(work:Work,pageId:string,userText:string,system?:DesignSystem,priorInstructions:string[]=[],currentBackground?:Asset):string {
 const page=targetPage(work,pageId);
 const notes=page.nodes.filter(n=>!n.hidden&&n.opacity!==0).slice(0,10).map(n=>layoutNote(n,work)).join('\n');
 const colors=[page.background,system?.accent,...page.nodes.filter(n=>!n.hidden).slice(0,4).map(n=>n.color)].filter(Boolean);
 const context=[
  `为现有作品《${compact(work.title,70)}》的「${compact(page.name,55)}」制作背景底图。`,
  `版式 ${work.type}，画布 ${work.width}×${work.height}。设计风格 ${compact(system?.name||work.styleId,55)}。当前配色 ${compact([...new Set(colors)].join('、'),110)}。`,
  currentBackground?`本页已用背景：${describeBackgroundReference(currentBackground)}`:'',
  page.notes?`本页说明：${compact(page.notes,120)}`:'',
  priorInstructions.length?`延续本页先前的背景要求（以本次要求为准）：${priorInstructions.map(s=>compact(s,90)).join('；')}`:'',
  '为以下已有内容保留低对比度留白，让观众清楚阅读现有内容。前景文字、卡片、图表和按钮均由编辑器绘制，背景只绘制氛围与纹理。',
  notes,
 ].filter(Boolean).join('\n');
 const instruction=compact(userText,900);
 return [`本次要求：${instruction}`,context].join('\n').slice(0,1500);
}
function hexColor(color:string|undefined,fallback:string){
 return color&&/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)?color:fallback;
}
/** Local composition preview. Keep decoration in the least occupied corner of the existing page. */
export function makeWorkBackgroundSample(work:Work,pageId:string,system?:DesignSystem,userText=''):string {
 const page=targetPage(work,pageId);
 const w=work.width,h=work.height;
 const nodes=page.nodes.filter(n=>!n.hidden&&n.opacity!==0);
 const corners=[{x:.85,y:.85},{x:.15,y:.85},{x:.85,y:.15},{x:.15,y:.15}];
 const score=(x:number,y:number)=>nodes.reduce((sum,n)=>{
  const dx=Math.max(n.x-x*w,0,x*w-(n.x+n.w))/w,dy=Math.max(n.y-y*h,0,y*h-(n.y+n.h))/h;
  return sum+1/(.04+dx*dx+dy*dy);
 },0);
 const whitespace=[...userText.matchAll(/([左右上下])(?:侧|边|部|方)?(?:保留|留下|预留)?留白/g)].at(-1)?.[1];
 const usable=corners.filter(c=>whitespace==='左'?c.x>.5:whitespace==='右'?c.x<.5:whitespace==='上'?c.y>.5:whitespace==='下'?c.y<.5:true);
 const corner=usable.map(c=>({...c,score:score(c.x,c.y)})).sort((a,b)=>a.score-b.score)[0];
 const bg=hexColor(page.background,hexColor(system?.background,'#172532'));
 const tint=[...userText.matchAll(/暖色|暖调|暖金|金色|冷色|冷调|蓝色|绿色|紫色/g)].at(-1)?.[0];
 const palette:Record<string,string>={'暖色':'#d6a16d','暖调':'#d6a16d','暖金':'#cfa85d','金色':'#cfa85d','冷色':'#7bb9d5','冷调':'#7bb9d5','蓝色':'#6ca5dc','绿色':'#7cad91','紫色':'#b498ca'};
 const accent=tint?palette[tint]:hexColor(system?.accent,hexColor(nodes[0]?.color,'#91aeba'));
 const tone=[...userText.matchAll(/暗一点|深一点|深色|调暗|更暗|亮一点|浅一点|浅色|提亮|更亮/g)].at(-1)?.[0];
 return sampleUrl(w,h,corner,bg,accent,tone?(/暗|深/.test(tone)?'dark':'light'):'none');
}
type Tone='dark'|'light'|'none';
const imagePrefix='data:image/svg+xml;charset=utf-8,';
function sampleUrl(w:number,h:number,corner:{x:number;y:number},bg:string,accent:string,tone:Tone){
 const key=[w,h,Math.round(corner.x*100),Math.round(corner.y*100),bg.slice(1),accent.slice(1),tone].join('_');
 const veil=tone!=='none'?`<rect width="100%" height="100%" fill="${tone==='dark'?'#000':'#fff'}" opacity=".24"/>`:'';

 const circles=[.13,.19,.26,.34].map(r=>`<circle cx="${corner.x*w}" cy="${corner.y*h}" r="${r*Math.min(w,h)}"/>`).join('');
 const svg=`<!--bg_${key}--><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="glow" cx="${corner.x*100}%" cy="${corner.y*100}%" r="75%"><stop stop-color="${accent}" stop-opacity=".22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="${bg}"/><rect width="100%" height="100%" fill="url(#glow)"/><g fill="none" stroke="${accent}" opacity=".1" stroke-width="${Math.max(1,w/1400)}">${circles}</g>${veil}</svg>`;
 return imagePrefix+encodeURIComponent(svg).replace(/\(/g,'%28').replace(/\)/g,'%29');
}

/** Decode only our fixed geometry and palette, then require a byte-for-byte match to the static renderer. */
export function isWorkBackgroundSample(src:string):boolean {
 if(!src.startsWith(imagePrefix)||src.length>5000)return false;
 const signature=src.slice(imagePrefix.length, imagePrefix.length+150).match(/^%3C!--bg_([0-9.]+)_([0-9.]+)_(15|85)_(15|85)_([a-f0-9]{3,6})_([a-f0-9]{3,6})_(dark|light|none)--%3E/i);
 if(!signature)return false;
 const [,width,height,x,y,bg,accent,tone]=signature;
 const w=Number(width),h=Number(height);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return false;
 return src===sampleUrl(w,h,{x:Number(x)/100,y:Number(y)/100},'#'+bg,'#'+accent,tone as Tone);
}
