import type {StoryNode,StoryEdge,Asset} from '../../domain/types';
import {layoutStory,storyKind,storyKinds} from '../../domain/story-canvas';
import {StudioImage} from './StudioShared';
import {storyMediaKind} from './creationLogic';

export function StoryPlanMap({nodes,edges,assets,onPick}:{nodes:StoryNode[];edges:StoryEdge[];assets:Asset[];onPick:(id:string)=>void}){
 const placed=layoutStory(nodes,edges),byId=new Map(placed.map(n=>[n.id,n]));
 const width=Math.max(450,...placed.map(n=>n.x+160)),height=Math.max(120,...placed.map(n=>n.y+90));
 return <section aria-label="节点与素材流程图" className="story-plan-scroll"><div className="story-plan-inner" style={{width,height}}>
  <svg width={width} height={height} aria-hidden="true">{edges.map(e=>{
   const a=byId.get(e.source),b=byId.get(e.target);if(!a||!b)return null;
   const x=a.x+152,y=a.y+34,tx=b.x,ty=b.y+34,mid=(x+tx)/2;
   const back=b.x<=a.x,low=Math.max(a.y,b.y)+82;
   return <g key={e.id}><path d={back?`M${x} ${y} Q${x+10} ${y},${x+10} ${low-8} Q${x+10} ${low},${x} ${low} H${tx-9} V${ty} H${tx}`:`M${x} ${y} C${mid} ${y},${mid} ${ty},${tx} ${ty}`} fill="none" stroke="currentColor"/><text x={mid} y={back?low-4:(y+ty)/2-5} textAnchor="middle">{e.label.slice(0,8)}</text></g>;
  })}</svg>
  {placed.map(n=><button key={n.id} type="button" className="story-plan-card" onClick={()=>onPick(n.id)} style={{left:n.x,top:n.y}}>{n.media&&storyMediaKind(n,assets)==='image'&&<StudioImage src={n.media} alt=""/>}<span>{storyKinds[storyKind(n.type)]}</span><strong>{n.title}</strong><small>{n.media?({html:'HTML 体验',image:'图片',video:'视频'}[storyMediaKind(n,assets)]):'待配素材'}{n.layers?.length?' + '+n.layers.length+' 个控件':''}</small></button>)}
 </div></section>;
}
