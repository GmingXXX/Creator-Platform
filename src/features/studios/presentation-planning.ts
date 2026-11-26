import type {ScenePage} from '../../domain/types';
import type {PresentationPageStudio} from './presentation-studio';

export function suggestTopic(text:string){
 return text.split(/\r?\n/).map(line=>line.trim().replace(/^#+\s*/, '')).find(line=>line.length>1&&!/^\[第\s*\d+\s*页\]$/.test(line))?.slice(0,100)||'';
}
export function planCount(requested:number,text:string){
 return requested?Math.min(60,Math.max(1,Math.round(requested))):Math.max(5,Math.min(40,Math.ceil(text.length/480)||8));
}
export function estimateMinutes(lines:string[]){
 return Math.max(.1,Math.round(lines.reduce((sum,line)=>sum+line.length/3.5+(line.match(/[.!?。！？]/g)?.length||1)*.3,0)/6)/10);
}
export function copySlide(source:ScenePage,settings:PresentationPageStudio):{page:ScenePage;settings:PresentationPageStudio}{
 const id=crypto.randomUUID(),ids=new Map(source.nodes.map(n=>[n.id,crypto.randomUUID()]));
 const page={...structuredClone(source),id,name:source.name+' · 副本',nodes:source.nodes.map(n=>({...structuredClone(n),id:ids.get(n.id)!}))};
 return {page,settings:{...structuredClone(settings),sentences:settings.sentences.map(s=>({...s,id:crypto.randomUUID(),cues:s.cues.map(c=>({...c,id:crypto.randomUUID(),nodeId:ids.get(c.nodeId)||c.nodeId}))})),hotspots:settings.hotspots.map(h=>({...h,id:crypto.randomUUID(),nodeId:ids.get(h.nodeId)||h.nodeId,value:h.action==='page'&&h.value===source.id?id:h.value}))}};
}
export function arrangeSlide(page:ScenePage,w:number,h:number,layout:string):ScenePage{
 const media=page.nodes.filter(n=>['image','video'].includes(n.type)&&!n.locked);
 const texts=page.nodes.filter(n=>n.type==='text'&&!n.locked&&!/页脚|章节标记|主标题|副标题/.test(n.name));
 const vertical=layout==='上图下文',left=layout==='左图右文';
 return {...page,nodes:page.nodes.map(n=>{
  const mi=media.indexOf(n),ti=texts.indexOf(n);
  if(mi>=0)return {...n,x:w*(vertical?.08:left?.06:.55),y:h*(.34+(vertical?.32:.5)*mi/media.length),w:w*(vertical?.84:.39),h:h*(vertical?.29:.46)/media.length};
  if(ti>=0)return {...n,x:w*(left&&media.length?.53:.06),y:h*((vertical&&media.length?.68:.34)+(vertical&&media.length?.21:.52)*ti/texts.length),w:w*(media.length&&!vertical?.41:.87),h:h*(vertical&&media.length?.2:.48)/texts.length};
  return n;
 })};
}
