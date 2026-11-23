import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Work, NodeKind, SceneNode, ContentItem } from '../domain/types';
import { useMedia } from '../domain/upload';
import { systems } from '../domain/scenes';
import '../styles/artwork.css';

export interface ArtworkProps { work?: Work; type?: NodeKind; styleId?: string; title?: string; image?: string; className?: string }
const palettes: Record<string, { bg: string; fg: string; dim: string; accent: string }> = Object.fromEntries(
  systems.map(system => [system.id, { bg: system.background, fg: system.text, dim: `${system.text}ad`, accent: system.accent }]),
);
const titles: Partial<Record<NodeKind, string>> = { timeline: '时间里的创新足迹', graph: '让技术，连接更多可能', gallery: '每一份成果，都值得被看见', card: '聚焦创新 · 探索实践', map: '立足中国，连接世界', flow: '从创想到创造', chart: '以数据，读懂发展', bubble: '让每一次对话自然发生', html: '探索下一种交互', image: '为创意，留一片空间', video: '让故事，在光影中发生' };
const fallbackItems: ContentItem[] = [
  {id:'a', title:'始于探索', year:'1998', description:'以创新为起点，开启发展新篇章'},
  {id:'b', title:'向新而行', year:'2008', description:'核心技术突破，连接产业价值'},
  {id:'c', title:'共创未来', year:'2024', description:'让智慧赋能每一种可能'},
];
function textLimit(s: string, n=18) { return s.length > n ? `${s.slice(0,n)}…` : s; }

function Diagram({kind, items=fallbackItems, accent, fg, dim, id}: {kind:NodeKind; items?:ContentItem[]; accent:string; fg:string; dim:string; id:string}) {
  const rows = items.length ? items : fallbackItems;
  if(kind==='bubble' || kind==='audio') return <g>
    <ellipse cx="330" cy="215" rx="130" ry="28" fill={accent} opacity=".08"/>
    <rect x="115" y="65" width="430" height="150" rx="72" fill={fg} opacity=".06" stroke={accent} strokeOpacity=".4"/>
    <circle cx="190" cy="140" r="37" fill={accent} opacity=".15"/>
    {Array.from({length:26},(_,i)=><rect key={i} x={249+i*8} y={140-(9+Math.sin(i*.7)**2*27)} width="3" height={18+Math.sin(i*.7)**2*54} rx="2" fill={accent} opacity={.3+i/40}/>)}
    <text x="330" y="264" fill={dim} textAnchor="middle" fontSize="15">聆听 · 理解 · 自然回应</text>
  </g>;
  if(kind==='graph') return <g>
    <path d="M330 140L130 70M330 140L540 65M330 140L105 235M330 140L550 240M330 140L330 290" stroke={accent} strokeWidth="1.4" opacity=".55"/>
    {[{x:330,y:140,t:'创新引擎',r:53},{x:130,y:70,t:rows[0]?.title||'核心技术',r:38},{x:540,y:65,t:rows[1]?.title||'应用场景',r:38},{x:105,y:235,t:'产业生态',r:38},{x:550,y:240,t:'协同研发',r:38},{x:330,y:290,t:'价值共创',r:33}].map((n,i)=><g key={i}><circle cx={n.x} cy={n.y} r={n.r+8} fill="none" stroke={accent} opacity=".15"/><circle cx={n.x} cy={n.y} r={n.r} fill={i===0?accent:fg} fillOpacity={i===0?.18:.055} stroke={accent} strokeOpacity=".6"/><circle cx={n.x} cy={n.y-n.r} r="2" fill={accent}/><text x={n.x} y={n.y+4} fill={fg} textAnchor="middle" fontSize={i===0?17:12}>{textLimit(n.t,6)}</text></g>)}
  </g>;
  if(kind==='timeline') return <g>
    <path d="M20 182H640" stroke={accent} strokeOpacity=".4"/>
    {rows.slice(0,4).map((n,i)=>{const x=20+i*(590/Math.max(2,Math.min(rows.length,4)-1));return <g key={n.id} transform={`translate(${x},0)`}><circle cy="182" r="5" fill={accent}/><circle cy="182" r="12" fill="none" stroke={accent} opacity=".3"/><text y="157" fill={accent} fontSize="28" fontWeight="500">{n.year||String(1990+i*10)}</text><path d="M0 202v20" stroke={accent} opacity=".4"/><text y="245" fill={fg} fontSize="15">{textLimit(n.title,10)}</text><text y="270" fill={dim} fontSize="10">{textLimit(n.description,17)}</text><g transform="translate(0,25)"><rect width="126" height="88" rx="3" fill={fg} opacity=".055"/><path d="M8 70L38 43L70 62L103 21L126 45" fill="none" stroke={accent} strokeOpacity=".5"/><path d="M8 74V40M28 74V24M48 74V48M68 74V15M88 74V35M108 74V8" stroke={accent} strokeWidth="6" opacity=".12"/></g></g>})}
  </g>;
  if(kind==='map') return <g transform="translate(65,-10)">
    <path d="M96 97l55-25 23-40 39 10 23-25 28 17 21 45 38-1 18 31 47 5 40 31-18 21-14 39-47 15-13 35-34 13-17 48-26-10-20-40-42-11-8-32-44 6-38-28-42-6-5-35z" fill={accent} fillOpacity=".07" stroke={accent} strokeOpacity=".5"/>
    {[{x:280,y:100,t:'北京'},{x:360,y:180,t:'上海'},{x:290,y:262,t:'深圳'},{x:200,y:208,t:'成都'},{x:280,y:190,t:'武汉'}].map((p,i)=><g key={i}><path d={`M${p.x} ${p.y}Q${p.x-50} ${p.y-80} 360 180`} stroke={accent} fill="none" opacity=".4"/><circle cx={p.x} cy={p.y} r="12" fill={accent} opacity=".12"/><circle cx={p.x} cy={p.y} r="4" fill={accent}/><text x={p.x+11} y={p.y-12} fontSize="12" fill={fg}>{p.t}</text></g>)}
    <text x="20" y="310" fontSize="12" fill={dim}>协同网络 · 持续拓展</text>
  </g>;
  if(kind==='chart') return <g>
    {[['研发投入','12.8'],['创新成果','386'],['服务客户','120+']].map(([label,value],i)=><g key={label} transform={`translate(${i*225},8)`}><text fontSize="11" fill={dim}>{label}</text><text y="47" fontSize="40" fontWeight="500" fill={fg}>{value}</text><path d="M0 65H180" stroke={fg} opacity=".15"/></g>)}
    {[0,1,2,3].map(i=><path key={i} d={`M0 ${120+i*51}H650`} stroke={fg} opacity=".08"/>)}
    {[72,89,65,112,130,115,163,188,160,209,224,239].map((h,i)=><rect key={i} x={i*53+5} y={325-h*.72} width="22" height={h*.72} rx="2" fill={accent} opacity={.22+i*.05}/>)}
    <path d="M10 240L66 225L118 235L173 194L224 183L277 195L332 152L385 132L439 150L490 100L545 91L610 63" stroke={accent} strokeWidth="2.5" fill="none"/>
  </g>;
  if(kind==='flow') return <g>
    {[0,1,2,3].map(i=><g key={i} transform={`translate(${i*165+10},85)`}>{i<3&&<path d="M120 45h45m-8-5 8 5-8 5" stroke={accent} fill="none" strokeOpacity=".6"/>}<rect width="120" height="98" rx="7" fill={fg} fillOpacity=".045" stroke={accent} strokeOpacity=".25"/><text x="18" y="30" fill={accent} fontSize="12">{String(i+1).padStart(2,'0')}</text><text x="18" y="59" fontSize="15" fill={fg}>{textLimit(rows[i]?.title||['原料甄选','智能制造','品质检验','价值交付'][i],6)}</text><path d="M18 78h56" stroke={fg} opacity=".13"/></g>)}
    <text x="330" y="240" textAnchor="middle" fontSize="12" fill={dim}>全流程协同，让每一步创造价值</text>
  </g>;
  if(kind==='video' || kind==='html') return <g>
    <rect x="40" y="10" width="580" height="305" rx="8" fill={fg} fillOpacity=".035" stroke={fg} strokeOpacity=".15"/>
    <path d="M40 42h580" stroke={fg} opacity=".12"/>{[0,1,2].map(i=><circle key={i} cx={57+i*12} cy="26" r="2.5" fill={fg} opacity=".3"/>)}
    <circle cx="330" cy="166" r="48" fill={accent} opacity=".12"/>
    <circle cx="330" cy="166" r="84" fill="none" stroke={accent} strokeOpacity=".12"/>
    {kind==='video'?<path d="M319 147l31 19-31 19z" fill={fg}/>:<><path d="M313 150l-20 16 20 16m34-32 20 16-20 16m-10-39-16 78" stroke={accent} strokeWidth="2" fill="none"/><text x="330" y="279" textAnchor="middle" fill={dim} fontSize="12">触摸探索，发现更多可能</text></>}
  </g>;
  return <g>{Array.from({length:6},(_,i)=>{const x=(i%3)*225,y=Math.floor(i/3)*162; const item=rows[i%rows.length];return <g key={i} transform={`translate(${x},${y})`}><rect width="205" height="145" rx="5" fill={fg} fillOpacity=".045" stroke={fg} strokeOpacity=".1"/><g clipPath={`url(#${id}-card)`}><path d={`M0 94L48 ${24+i*3} 92 70 133 ${6+i*7} 205 56V94z`} fill={accent} opacity={.07+i*.025}/><path d="M0 94L50 56 91 77 148 25 205 52" stroke={accent} strokeOpacity=".35" fill="none"/><circle cx={160-i*7} cy={35+i*3} r={18+i*3} stroke={accent} fill="none" opacity=".2"/></g><path d="M0 94h205" stroke={fg} opacity=".1"/><text x="13" y="117" fontSize="13" fill={fg}>{textLimit(item.title,13)}</text><text x="13" y="134" fontSize="9" fill={dim}>{textLimit(item.description,19)}</text></g>})}</g>;
}

function NodePreview({node, palette, id}: {node:SceneNode; palette:typeof palettes.industrial; id:string}) {
  const resolvedSrc=useMedia(node.src);
  if(node.hidden) return null;
  const sx=node.w/660,sy=node.h/330;
  if(node.type==='text' || node.type==='button') return <g transform={`translate(${node.x} ${node.y}) rotate(${node.rotation} ${node.w/2} ${node.h/2})`} opacity={node.opacity}>
    {node.type==='button'&&<rect width={node.w} height={node.h} rx={node.radius} fill={node.background||palette.accent}/>}
    <text x={node.type==='button'?node.w/2:0} y={Math.min(node.h,node.fontSize*1.1)} textAnchor={node.type==='button'?'middle':'start'} fill={node.color||palette.fg} fontSize={node.fontSize} fontWeight={node.fontSize>35?600:400}>{textLimit(node.content,42)}</text>
  </g>;
  if(node.type==='shape') return <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={node.radius} fill={node.background||palette.accent} opacity={node.opacity}/>;
  if(node.type==='image' && resolvedSrc) return <image x={node.x} y={node.y} width={node.w} height={node.h} href={resolvedSrc} opacity={node.opacity} preserveAspectRatio="xMidYMid slice"/>;
  return <g transform={`translate(${node.x} ${node.y}) rotate(${node.rotation} ${node.w/2} ${node.h/2}) scale(${sx} ${sy})`} opacity={node.opacity}>
    <Diagram kind={node.type} items={node.items} accent={node.color||palette.accent} fg={node.color||palette.fg} dim={node.color||palette.dim} id={id}/>
  </g>;
}

export function Artwork({work,type,styleId,title,image,className=''}:ArtworkProps) {
  const id=useId().replace(/:/g,'');
  const style=styleId||work?.styleId||'industrial';
  const p=palettes[style]||palettes.industrial;
  const kind=type||({时间演进型:'timeline',关系图谱型:'graph',卡片浏览型:'gallery',空间分布型:'map',流程架构型:'flow',媒体叙事型:'video',数据总览型:'chart'}[work?.type||'时间演进型'] as NodeKind);
  const label=title||work?.title||titles[kind]||'让创意，成为下一份作品';
  const page=work?.pages[0];
  const resolvedImage=useMedia(image||work?.cover);
  const resolvedBackground=useMedia(page?.backgroundImage);
  const actual=!!page;
  const background=actual?resolvedBackground:`/media/${style in palettes?style:'industrial'}.svg`;
  const styleProps={'--art-bg':page?.background||p.bg,'--art-fg':p.fg} as CSSProperties;
  return <div className={`artwork ${className}`} style={styleProps} role="img" aria-label={`${label}效果预览`}>
    {resolvedImage ? <img className="artwork-image" src={resolvedImage} alt={label} loading="lazy"/> : <svg viewBox={actual?`0 0 ${work.width} ${work.height}`:'0 0 800 500'} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><clipPath id={`${id}-card`}><rect width="205" height="94" rx="5"/></clipPath></defs>
      <rect width={actual?work.width:800} height={actual?work.height:500} fill={page?.background||p.bg}/>
      {background&&<image href={background} width={actual?work.width:800} height={actual?work.height:500} preserveAspectRatio="xMidYMid slice"/>}
      {actual?page.nodes.map(n=><NodePreview key={n.id} node={n} palette={p} id={id}/>):<>
        <path d="M50 44h26" stroke={p.accent} strokeWidth="2"/>
        <text x="50" y="88" fill={p.fg} fontSize="28" fontWeight="500" letterSpacing="1">{textLimit(label,22)}</text>
        <text x="51" y="112" fill={p.dim} fontSize="11" letterSpacing="1.5">以创新为起点，让内容连接价值</text>
        <g transform="translate(65,150)"><Diagram kind={kind} accent={p.accent} fg={p.fg} dim={p.dim} id={id}/></g>
        <text x="50" y="477" fill={p.dim} fontSize="8" letterSpacing="2">智创平台 · 内容设计样张</text>
        <path d="M700 472h50" stroke={p.accent} opacity=".4"/>
      </>}
    </svg>}
  </div>;
}

export default Artwork;
