import type {EditTarget,SceneNode,ScenePage,Work} from './types';
interface Rect {x:number;y:number;w:number;h:number}
interface LayoutResult {ok:boolean;summary:string;work?:Work}
const round=(value:number)=>Math.round(value*10)/10;
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const reject=(summary:string):LayoutResult=>({ok:false,summary});
/** Only a single explicit layout intent takes the deterministic path; mixed requests stay with the model. */
export function isLocalRelayoutRequest(prompt:string):boolean {
 const value=prompt.trim().replace(/[。！!\s]/g,'');
 return /^(?:(?:请|帮我|请帮我|请你|麻烦))*((?:重新|自动)(?:排版|布局)(?:(?:一下)?(?:当前|整个|全部|整份|所有|这张|这页)?(?:页面|作品|演示|幻灯片|页|内容)?)?|(?:优化|调整|整理)(?:当前|整个|全部|整份)?(?:页面|作品|演示)?(?:排版|布局))$/.test(value);
}
/** Partition the free canvas around fixed obstacles, never moving or covering locked elements. */
function freeArea(bounds:Rect,obstacles:Rect[]):Rect|undefined {
 const spaces=obstacles.reduce<Rect[]>((available,obstacle)=>available.flatMap(area=>{
  if(!overlaps(area,obstacle))return [area];
  const left=Math.max(area.x,obstacle.x),right=Math.min(area.x+area.w,obstacle.x+obstacle.w);
  const top=Math.max(area.y,obstacle.y),bottom=Math.min(area.y+area.h,obstacle.y+obstacle.h);
  return [
   {x:area.x,y:area.y,w:area.w,h:top-area.y},
   {x:area.x,y:bottom,w:area.w,h:area.y+area.h-bottom},
   {x:area.x,y:top,w:left-area.x,h:bottom-top},
   {x:right,y:top,w:area.x+area.w-right,h:bottom-top},
  ].filter(rect=>rect.w>=100&&rect.h>=80);
 }),[bounds]);
 return spaces.sort((a,b)=>b.w*b.h-a.w*a.h)[0];
}
function fitted(node:SceneNode,rect:Rect):SceneNode {
 const box={x:round(rect.x),y:round(rect.y),w:round(rect.w),h:round(rect.h)};
 return node.x===box.x&&node.y===box.y&&node.w===box.w&&node.h===box.h?node:{...node,...box};
}
function textHeight(node:SceneNode,width:number):number {
 const font=node.fontSize||24,lineHeight=node.lineHeight||1.5;
 const lines=(node.content||'').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(Array.from(line).reduce((length,char)=>length+(/[\u0000-\u007f]/.test(char)?.62:1),0)*font/width)),0);
 return Math.max(40,lines*font*lineHeight+4);
}
function grid(nodes:SceneNode[],area:Rect,gap:number):SceneNode[]|undefined {
 if(!nodes.length)return [];
 const columns=nodes.length===1?1:Math.min(nodes.length,area.w/area.h>1.15?Math.ceil(Math.sqrt(nodes.length*area.w/area.h)):Math.ceil(Math.sqrt(nodes.length)));
 const rows=Math.ceil(nodes.length/columns),w=(area.w-gap*(columns-1))/columns,h=(area.h-gap*(rows-1))/rows;
 if(w<100||h<45)return;
 return nodes.map((node,index)=>fitted(node,{x:area.x+index%columns*(w+gap),y:area.y+Math.floor(index/columns)*(h+gap),w,h}));
}
function stacked(nodes:SceneNode[],area:Rect,gap:number):SceneNode[]|undefined {
 if(!nodes.length)return [];
 const heights=nodes.map(node=>node.type==='text'?textHeight(node,area.w):80),minimum=heights.reduce((sum,h)=>sum+h,0),extra=(area.h-minimum-gap*(nodes.length-1))/nodes.length;
 if(area.w<100||extra<-.01)return;
 return nodes.map((node,index)=>fitted(node,{...area,y:area.y+heights.slice(0,index).reduce((sum,h)=>sum+h+Math.max(0,extra)+gap,0),h:heights[index]+Math.max(0,extra)}));
}
function layoutPage(page:ScenePage,work:Work):ScenePage|undefined {
 const nodes=page.nodes.filter(node=>!node.locked&&!node.rotation&&!node.hidden&&node.type!=='shape');
 if(!nodes.length)return page;
 const margin=Math.min(work.width,work.height)*.05,gap=Math.min(work.width,work.height)*.025;
 // Preserve rotated objects and reserve their actual bounding boxes along with locked objects.
 const fixed=page.nodes.filter(node=>(node.locked||node.rotation)&&!node.hidden&&node.type!=='shape').map(node=>{
  const angle=node.rotation*Math.PI/180,w=Math.abs(node.w*Math.cos(angle))+Math.abs(node.h*Math.sin(angle))+gap,h=Math.abs(node.w*Math.sin(angle))+Math.abs(node.h*Math.cos(angle))+gap;
  return {x:node.x+node.w/2-w/2,y:node.y+node.h/2-h/2,w,h};
 });
 const area=freeArea({x:margin,y:margin,w:work.width-2*margin,h:work.height-2*margin},fixed);
 if(!area||area.w<240||area.h<160)return;
 const title=nodes.find(node=>node.type==='text'&&/^(主标题|页面标题|标题)$/.test(node.name));
 const top=nodes.filter(node=>node.type==='text'&&/章节标记|展项标识|副标题|展项简介|引导语/.test(node.name));
 const foot=nodes.filter(node=>node.type==='text'&&/页脚|操作提示/.test(node.name));
 const header=[...top.filter(node=>/章节|标识/.test(node.name)),...(title?[title]:[]),...top.filter(node=>!/章节|标识/.test(node.name))];
 const main=nodes.filter(node=>!header.includes(node)&&!foot.includes(node));
 const headerHeight=header.reduce((sum,node)=>sum+textHeight(node,area.w),0)+Math.max(0,header.length-1)*gap*.4;
 const footHeight=foot.reduce((sum,node)=>sum+textHeight(node,area.w),0)+Math.max(0,foot.length-1)*gap*.3;
 const headerNodes=stacked(header,{...area,h:headerHeight},gap*.4);
 const footerNodes=stacked(foot,{...area,y:area.y+area.h-footHeight,h:footHeight},gap*.3);
 const body={...area,y:area.y+headerHeight+(header.length?gap:0),h:area.h-headerHeight-footHeight-(header.length?gap:0)-(foot.length?gap:0)};
 if(!headerNodes||!footerNodes||body.h<40)return;
 const text=main.filter(node=>node.type==='text'),visual=main.filter(node=>node.type!=='text');
 let bodyNodes:SceneNode[]|undefined;
 if(text.length&&visual.length&&body.w/body.h>1.1){
  const leftWidth=(body.w-gap)*.48,rightWidth=body.w-gap-leftWidth;
  const left=stacked(text,{...body,w:leftWidth},gap*.65),right=grid(visual,{...body,x:body.x+leftWidth+gap,w:rightWidth},gap);
  bodyNodes=left&&right?[...left,...right]:undefined;
 }else bodyNodes=text.length===main.length?stacked(main,body,gap*.65):grid(main,body,gap);
 if(!bodyNodes)return;
 const updates=new Map([...headerNodes,...bodyNodes,...footerNodes].map(node=>[node.id,node]));
 const nextNodes=page.nodes.map(node=>updates.get(node.id)||node);
 return nextNodes.every((node,index)=>node===page.nodes[index])?page:{...page,nodes:nextNodes};
}
export function relayoutWork(work:Work,target:EditTarget):LayoutResult {
 if(work.deletedAt)return reject('作品已删除，请恢复后再重新排版。');
 if(!['exhibit','presentation'].includes(work.kind))return reject('本地排版目前支持交互页面和智能演示；故事节点与视频分镜请在对应画布调整。');
 if(target.scope==='node')return reject('重新排版需要页面或作品范围，请先切换修改范围；当前组件未改变。');
 if(!['work','page'].includes(target.scope)||!work.pages.length||target.scope==='page'&&!work.pages.some(page=>page.id===target.pageId))return reject('目标页面已不存在，请重新选择修改范围。');
 if(!Number.isFinite(work.width)||!Number.isFinite(work.height)||work.width<320||work.height<240)return reject('当前画布尺寸不足以自动排版。');
 const pages=work.pages.map(page=>target.scope==='work'||page.id===target.pageId?layoutPage(page,work):page);
 if(pages.some(page=>!page))return reject('可用画布不足以容纳全部内容，请减少组件或调整锁定组件后重试；本次未改变作品。');
 const changed=pages.filter((page,index)=>page!==work.pages[index]);
 if(!changed.length)return reject('当前布局已符合本地排版规则，或没有可移动内容，无需重复修改。');
 const count=changed.reduce((sum,page)=>sum+page!.nodes.filter((node,index)=>node!==work.pages.find(original=>original.id===page!.id)!.nodes[index]).length,0);
 return {ok:true,work:{...work,pages:pages as ScenePage[]},summary:`已按本地规则重新排版 ${changed.length} 页、${count} 个元素：整理标题、图文区域和间距。文字、素材、交互、锁定及隐藏元素均保留；HTML 仅调整容器。可撤销本次调整。`};
}
