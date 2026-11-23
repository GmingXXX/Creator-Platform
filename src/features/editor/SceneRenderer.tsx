import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronRight, MapPin, Play, Sparkles, Volume2, X } from 'lucide-react';
import type { ContentItem, SceneNode, Work } from '../../domain/types';
import { resolveMedia, useMedia } from '../../domain/upload';
import { graphLayout, isMediaContainer, matchCommands, sceneThemeForBackground, videoPageProgress } from './editor-domain';
import '../../styles/editor.css';
import {nodeTypographyStyle,textRoleStyle} from '../../domain/text-style';
import {FishboneTimeline} from './FishboneTimeline';

function Media({src,kind='image',fit='cover',interactive=false,onPlay,onPause,onMediaTime}:{src?:string;kind?:string;fit?:'cover'|'contain';interactive?:boolean;onPlay?:()=>void;onPause?:()=>void;onMediaTime?:(media:HTMLVideoElement)=>void}){
 const [url,setUrl]=useState(src||'');
 useEffect(()=>{let alive=true;if(src)resolveMedia(src).then(u=>{if(alive)setUrl(u)}).catch(()=>setUrl(''));return()=>{alive=false}},[src]);
 if(kind==='video')return <video data-scene-media src={url} style={{objectFit:fit}} poster="/media/industrial.svg" controls={interactive} playsInline preload="metadata" onPlay={e=>{onPlay?.();onMediaTime?.(e.currentTarget)}} onPause={e=>{onPause?.();onMediaTime?.(e.currentTarget)}} onTimeUpdate={e=>onMediaTime?.(e.currentTarget)} onSeeked={e=>onMediaTime?.(e.currentTarget)} onEnded={e=>onMediaTime?.(e.currentTarget)}/>;
 if(kind==='audio')return interactive?<audio data-scene-media controls src={url}/>:<div className="scene-audio"><Volume2 size={48}/><span>展项讲解音频</span><div className="audio-bars">{Array.from({length:24},(_,i)=><i key={i} style={{height:12+(i*19)%40}}/>)}</div></div>;
 return <img draggable={false} style={{objectFit:fit}} src={url||'/media/technology.svg'} alt="" onError={e=>{if(!e.currentTarget.src.endsWith('/media/technology.svg'))e.currentTarget.src='/media/technology.svg'}}/>;
}
export function NodeContent({node,interactive=false,onItemClick,onPlay,onPause,onMediaTime}:{node:SceneNode;interactive?:boolean;onItemClick?:(item:ContentItem)=>void;onPlay?:()=>void;onPause?:()=>void;onMediaTime?:(media:HTMLVideoElement)=>void}){
 const items=node.items||[];
 const titleStyle=textRoleStyle(node,'title'),bodyStyle=textRoleStyle(node,'body');
 const itemClick=(item:ContentItem)=>interactive?onItemClick?.(item):undefined;
 if(node.type==='text')return <div className="scene-text" style={nodeTypographyStyle(node)}>{node.content}</div>;
 if(isMediaContainer(node.type))return node.src?<Media src={node.src} kind={node.type} fit={node.mediaFit} interactive={interactive} onPlay={onPlay} onPause={onPause} onMediaTime={onMediaTime}/>:null;
 if(node.type==='html'&&node.src)return <HtmlEmbed node={node} interactive={interactive}/>;
 if(node.type==='shape')return <div className="scene-shape"/>;
 if(node.type==='button')return <div className="scene-button" style={nodeTypographyStyle(node)}>{node.content}<ChevronRight size={Math.max(18,node.fontSize)}/></div>;
 if(node.type==='bubble')return <div className={'scene-bubble '+(node.state||'')}><span className="bubble-orb"><Sparkles size={38}/></span><div><b style={titleStyle}>{node.state==='聆听'?'正在聆听…':node.state==='思考'?'正在整理思路…':node.state==='播报'?'为你讲述…':node.content}</b><span style={bodyStyle}>AI 展厅讲解助手</span></div><div className="voice-bars">{Array.from({length:5},(_,i)=><i key={i} style={{animationDelay:`${i*.12}s`}}/>)}</div></div>;
 if(node.type==='timeline'&&node.timelineLayout==='fishbone')return <FishboneTimeline node={node} interactive={interactive} onItemClick={itemClick}/>;
 if(node.type==='timeline')return <div className="scene-timeline"><div className="timeline-track"/>{items.map((item,i)=><button tabIndex={interactive?0:-1} className="timeline-event" key={item.id} onClick={e=>{e.stopPropagation();itemClick(item)}}><strong className="event-year" style={titleStyle}>{item.year||String(1980+i*12)}</strong><span className="event-dot"/><div className="event-card">{item.image&&<Media src={item.image}/>}<div><h3 style={titleStyle}>{item.title}</h3><p style={bodyStyle}>{item.description}</p><span className="event-more" style={bodyStyle}>探索这一年 <ChevronRight size={16}/></span></div></div></button>)}</div>;
 if(node.type==='card'||node.type==='gallery')return <div className="scene-gallery" style={{gridTemplateColumns:`repeat(${node.type==='card'?1:node.columns||3},1fr)`,gap:node.gap??24}}>{(items.length?items:[{id:'single',title:node.content,description:'点击探索完整故事',image:node.src}]).map(item=><button tabIndex={interactive?0:-1} key={item.id} className="scene-content-card" onClick={e=>{e.stopPropagation();itemClick(item)}}>{item.image&&<Media src={item.image}/>}<div><span style={bodyStyle}>{item.category||'创新与实践'}</span><h3 style={titleStyle}>{item.title}</h3><p style={bodyStyle}>{item.description}</p></div><ChevronRight className="card-corner"/></button>)}</div>;
 if(node.type==='graph'){const layout=graphLayout(items);return <div className="scene-graph-tree"><svg className="graph-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none">{layout.map(n=>{const p=layout.find(v=>v.item.id===n.item.parentId);return p?<path key={n.item.id} d={`M${p.x*10} ${(p.y+p.height/2)*10} C${p.x*10} ${(p.y+n.y)*5} ${n.x*10} ${(p.y+n.y)*5} ${n.x*10} ${(n.y-n.height/2)*10}`}/>:null})}</svg>{layout.map(n=><button className={'graph-tree-node '+(n.depth===0?'root':'')} style={{left:`${n.x}%`,top:`${n.y}%`,width:`${n.width}%`,height:`${n.height}%`}} key={n.item.id} tabIndex={interactive?0:-1} onClick={e=>{e.stopPropagation();itemClick(n.item)}}><small style={bodyStyle}>{n.depth===0?'核心主题':items.find(i=>i.id===n.item.parentId)?.title||'关联内容'}</small><h3 style={titleStyle}>{n.item.title}</h3><p style={bodyStyle}>{n.item.description}</p></button>)}</div>}
 if(node.type==='map')return <div className="scene-map"><svg viewBox="0 0 1000 550" preserveAspectRatio="xMidYMid meet"><defs><pattern id={'map-grid-'+node.id} width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="currentColor" opacity=".12"/></pattern></defs><rect width="1000" height="550" fill={`url(#map-grid-${node.id})`}/><path d="M130 160L205 133 232 66 300 89 351 139 414 95 452 140 511 126 561 68 617 80 657 130 702 127 733 188 811 176 838 224 890 248 857 304 791 315 773 371 702 400 661 468 607 429 555 436 520 481 479 443 447 380 376 362 339 320 269 336 227 294 168 279 127 226Z" fill="currentColor" opacity=".12" stroke="currentColor" strokeWidth="2"/></svg>{items.map((item,i)=><button key={item.id} className="map-point" tabIndex={interactive?0:-1} style={{left:`${item.x??32+i*21}%`,top:`${item.y??42+(i%2)*24}%`}} onClick={e=>{e.stopPropagation();itemClick(item)}}><span/><MapPin size={28}/><b style={titleStyle}>{item.title}</b></button>)}</div>;
 if(node.type==='flow')return <div className="scene-flow">{items.map((item,i)=><div key={item.id} className="flow-step"><button tabIndex={interactive?0:-1} onClick={e=>{e.stopPropagation();itemClick(item)}}><span className="flow-number" style={titleStyle}>{String(i+1).padStart(2,'0')}</span><h3 style={titleStyle}>{item.title}</h3><p style={bodyStyle}>{item.description}</p></button>{i<items.length-1&&<ChevronRight className="flow-arrow" size={36}/>}</div>)}</div>;
 if(node.type==='chart')return <div className="scene-chart"><div className="chart-heading"><span style={titleStyle}>{node.content}</span><b style={titleStyle}>创新成果持续增长</b></div><div className="chart-bars">{items.map((item,i)=><div key={item.id}><b style={titleStyle}>{item.value??30+i*23}<small> 项</small></b><div style={{height:`${Math.min(100,item.value??30+i*23)}%`}}/><span style={bodyStyle}>{item.title}</span></div>)}</div><div className="chart-foot" style={bodyStyle}>示例数据 · 成果总览</div></div>;
 return <div className="scene-html"><span className="html-orbit"/><span>互动探索</span><h2 style={titleStyle}>{node.content||'触摸灵感，探索未来'}</h2><p style={bodyStyle}>选择一个方向，发现更多内容</p><div>{['创新技术','应用场景','未来愿景'].map(x=><button tabIndex={interactive?0:-1} key={x} onClick={e=>{e.stopPropagation();itemClick({id:x,title:x,description:'融合数字技术与真实场景，让每一个想法成为可以体验的未来。'})}}>{x}<ChevronRight size={16}/></button>)}</div></div>;
}
function HtmlEmbed({node,interactive}:{node:SceneNode;interactive:boolean}){
 const resolved=useMedia(node.src);
 const src=/^(javascript|vbscript|data):/i.test(resolved.trim())?'':resolved;
 return src?<iframe className="scene-html-embed" title={node.name} src={src} sandbox="allow-scripts" style={{width:'100%',height:'100%',border:0,pointerEvents:interactive?'auto':'none'}}/>:<div className="scene-html">正在读取交互程序…</div>;
}
export function nodeStyle(node:SceneNode):CSSProperties{return {left:node.x,top:node.y,width:node.w,height:node.h,transform:`rotate(${node.rotation}deg)`,opacity:node.opacity,color:node.color,background:node.background,fontSize:node.fontSize,borderRadius:node.radius,...nodeTypographyStyle(node)}}
const frames:Record<string,Keyframe[]>={
 '淡入':[{opacity:0},{opacity:1}], '淡出':[{opacity:1},{opacity:0}],
 '向上移入':[{opacity:0,transform:'translateY(70px)'},{opacity:1,transform:'translateY(0)'}],
 '向下移入':[{opacity:0,transform:'translateY(-70px)'},{opacity:1,transform:'translateY(0)'}],
 '向左移入':[{opacity:0,transform:'translateX(90px)'},{opacity:1,transform:'translateX(0)'}],
 '向右移入':[{opacity:0,transform:'translateX(-90px)'},{opacity:1,transform:'translateX(0)'}],
 '缩放进入':[{opacity:0,transform:'scale(.72)'},{opacity:1,transform:'scale(1)'}],
 '缩放退出':[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.2)'}],
 '轻弹进入':[{opacity:0,transform:'translateY(80px) scale(.8)'},{opacity:1,transform:'translateY(-12px) scale(1.03)',offset:.65},{transform:'translateY(0) scale(1)'}],
 '旋转进入':[{opacity:0,transform:'rotate(-12deg) scale(.8)'},{opacity:1,transform:'rotate(0) scale(1)'}],
 '模糊显现':[{opacity:0,filter:'blur(16px)'},{opacity:1,filter:'blur(0)'}],
 '强调脉冲':[{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],
 '呼吸高亮':[{filter:'brightness(1)'},{filter:'brightness(1.55)'},{filter:'brightness(1)'}],
 '左右摇摆':[{transform:'translateX(0)'},{transform:'translateX(-12px)'},{transform:'translateX(12px)'},{transform:'translateX(-12px)'},{transform:'translateX(0)'}],
 '页面推进':[{transform:'translateX(40%)',opacity:0},{transform:'translateX(0)',opacity:1}],
 '交叉淡化':[{opacity:0},{opacity:1}],
 '翻页转场':[{transform:'perspective(1000px) rotateY(80deg)',opacity:0},{transform:'perspective(1000px) rotateY(0)',opacity:1}]
};
function AnimatedNode({node,interactive,version,children}:{node:SceneNode;interactive:boolean;version:number;children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);const config=JSON.stringify(node.motion);
 useEffect(()=>{const m=node.motion;if(!interactive||!m||m.preset==='无动效'||(node.type==='video'&&m.preset==='页面推进')||!ref.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const keyframes=m.keyframes?.length?m.keyframes.map(k=>({offset:Math.max(0,Math.min(1,k.time/m.duration)),transform:`translateX(${k.x}px)`,opacity:k.opacity})):frames[m.preset]||frames['淡入'];
  const animation=ref.current.animate(keyframes,{duration:Math.max(.1,m.duration)*1000,delay:m.delay*1000,easing:m.easing,fill:m.hold?'both':'backwards'});return()=>animation.cancel();
 },[interactive,config,version]);
 return <div ref={ref} className="scene-node-inner">{children}</div>;
}
export function SceneRenderer({work,pageId,interactive=false,onNodeClick,commandText,commandNonce=0}:{work:Work;pageId?:string;interactive?:boolean;onNodeClick?:(node:SceneNode)=>void;commandText?:string;commandNonce?:number}){
 const [activePage,setActivePage]=useState(pageId||work.pages[0]?.id);
 const [visibility,setVisibility]=useState<Record<string,boolean>>({});
 const [states,setStates]=useState<Record<string,string>>({});const [motionVersions,setMotionVersions]=useState<Record<string,number>>({});
 const [detail,setDetail]=useState<ContentItem|null>(null);const [commandStatus,setCommandStatus]=useState('');const [ambiguous,setAmbiguous]=useState<ReturnType<typeof matchCommands>>([]);
 const [pageProgress,setPageProgress]=useState(0);const mediaTail=useRef<number|null>(null);const mediaVersion=useRef(0);
 const currentPageRef=useRef(activePage);currentPageRef.current=activePage;const sceneRef=useRef<HTMLDivElement>(null);const page=work.pages.find(p=>p.id===activePage)||work.pages[0];const background=useMedia(page?.backgroundImage);
 useEffect(()=>{setActivePage(pageId||work.pages[0]?.id);setVisibility({});setDetail(null)},[pageId,work.id]);
 useEffect(()=>{mediaVersion.current++;setPageProgress(0);if(mediaTail.current)cancelAnimationFrame(mediaTail.current);return()=>{mediaVersion.current++;if(mediaTail.current)cancelAnimationFrame(mediaTail.current)}},[activePage]);
 function act(node:SceneNode,action:string,targetId?:string):boolean{
  if(targetId&&!work.pages.some(p=>p.id===targetId||p.nodes.some(n=>n.id===targetId))){setCommandStatus('目标已删除，请返回编辑器重新绑定');return false}
  if(['navigate','show','hide','toggle'].includes(action)&&!targetId){setCommandStatus('尚未配置动作目标，请返回编辑器绑定');return false}
  if(action==='navigate'){if(targetId&&work.pages.some(p=>p.id===targetId)){setActivePage(targetId);setDetail(null);return true}setCommandStatus('目标不是可跳转的页面');return false}
  if(action==='show'||action==='hide'||action==='toggle'){if(targetId)setVisibility(s=>({...s,[targetId]:action==='show'?true:action==='hide'?false:!(s[targetId]??!page.nodes.find(n=>n.id===targetId)?.hidden)}));return true}
  if(action==='state'){const target=targetId||node.id;setStates(s=>({...s,[target]:s[target]==='聆听'?'播报':'聆听'}));setMotionVersions(v=>({...v,[target]:(v[target]||0)+1}));return true}
  if(action==='play'){const media=Array.from(sceneRef.current?.querySelectorAll<HTMLElement>('[data-node-id]')||[]).find(el=>el.dataset.nodeId===(targetId||node.id))?.querySelector<HTMLMediaElement>('[data-scene-media]');if(media){if(media.paused)void media.play().catch(()=>setCommandStatus('请点击媒体播放按钮开始播放'));else media.pause();return true}setCommandStatus('当前页面找不到可播放媒体');return false}
  if(action!=='detail'){setCommandStatus('此动作暂未支持');return false}
  setDetail({id:node.id,title:node.name,description:node.content,image:node.type==='image'?node.src:node.items?.[0]?.image});return true;
 }
 function executeMatch(match:ReturnType<typeof matchCommands>[number]){if(act(match.node,match.command.action,match.command.targetId))setCommandStatus(`已匹配「${match.command.phrase}」 → 执行动作`);setAmbiguous([])}
 useEffect(()=>{if(!commandText||!interactive||!page)return;const matches=matchCommands(work,page.id,commandText);setAmbiguous([]);if(matches.length===1){executeMatch(matches[0])}else if(matches.length>1){setAmbiguous(matches);setCommandStatus('找到多个同级命令，请选择目标')}else{const suggestions=work.pages.flatMap(p=>p.nodes.flatMap(n=>(n.commands||[]).filter(c=>c.enabled&&(c.scope==='global'||p.id===page.id)).map(c=>c.phrase))).slice(0,3);setCommandStatus(`未匹配口令${suggestions.length?'，可尝试：'+suggestions.join('、'):'，请先在编辑器配置语音命令'}`)}},[commandText,commandNonce]);
 function syncVideo(originPageId:string,node:SceneNode,media:HTMLVideoElement){
  if(originPageId!==currentPageRef.current||!interactive||node.motion?.preset!=='页面推进'||!Number.isFinite(media.duration))return;
  if(mediaTail.current)cancelAnimationFrame(mediaTail.current);const duration=Math.max(media.duration,node.motion.duration);setPageProgress(videoPageProgress(media.currentTime,duration));
  if(media.ended&&duration>media.duration){const start=performance.now(),version=mediaVersion.current;const tick=(now:number)=>{if(version!==mediaVersion.current)return;const time=media.duration+(now-start)/1000;setPageProgress(videoPageProgress(time,duration));if(time<duration)mediaTail.current=requestAnimationFrame(tick)};mediaTail.current=requestAnimationFrame(tick)}
 }
 if(!page)return null;
 return <div ref={sceneRef} data-scene-theme={sceneThemeForBackground(page.background)} className={'scene-renderer '+(interactive?'is-interactive':'')} style={{width:work.width,height:work.height,background:page.background,backgroundImage:background?`url(${background})`:undefined}}>
  <div className="scene-page-content" style={{transform:pageProgress?`translateX(${-pageProgress*4}%) scale(${1+pageProgress*.12})`:undefined,transition:'transform 120ms linear'}}>
  {page.nodes.filter(n=>visibility[n.id]??!n.hidden).map(n=>{const clickable=interactive&&['text','image','shape','bubble','button'].includes(n.type)&&Boolean(n.interactions?.length||onNodeClick);const activate=()=>{onNodeClick?.(n);(n.interactions||[]).filter(i=>i.event==='click').forEach(i=>act(n,i.action,i.targetId))};return <div key={n.id} className={'scene-node scene-node-'+n.type} data-node-id={n.id} style={nodeStyle(n)} {...(clickable?{role:'button',tabIndex:0,'aria-label':n.name,onClick:activate,onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}}}:{})}><AnimatedNode node={n} interactive={interactive} version={motionVersions[n.id]||0}><NodeContent node={{...n,state:states[n.id]||n.state}} interactive={interactive} onItemClick={item=>{const rules=(n.interactions||[]).filter(i=>i.event==='click');if(rules.length)rules.forEach(rule=>rule.action==='detail'?setDetail(item):act(n,rule.action,rule.targetId));else setDetail(item)}} onPlay={()=>{(n.interactions||[]).filter(i=>i.event==='videoStart').forEach(i=>act(n,i.action,i.targetId))}} onMediaTime={media=>syncVideo(page.id,n,media)}/></AnimatedNode></div>})}
  </div>
  {interactive&&activePage!==work.pages[0]?.id&&<button className="scene-return" onClick={()=>setActivePage(work.pages[0].id)}>返回首页</button>}
  {interactive&&commandStatus&&<div className="scene-command-status"><span>{commandStatus}</span><button aria-label="关闭命令结果" onClick={()=>{setCommandStatus('');setAmbiguous([])}}><X size={18}/></button>{ambiguous.map(match=><button key={match.command.id} onClick={()=>executeMatch(match)}>{match.node.name}</button>)}</div>}
  {detail&&<div className="scene-detail-mask"><button className="scene-detail-backdrop" aria-label="收起内容预览" onClick={()=>setDetail(null)}/><div className="scene-detail" role="dialog" aria-modal="true" aria-label={detail.title} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDetail(null)}}}><button className="scene-detail-close" onClick={()=>setDetail(null)} aria-label="关闭详情"><X size={30}/></button>{detail.image&&<Media src={detail.image}/>}<div>{detail.year&&<span>{detail.year}</span>}<h2>{detail.title}</h2><p>{detail.description}</p><button onClick={()=>setDetail(null)}>返回浏览</button></div></div></div>}
 </div>;
}
