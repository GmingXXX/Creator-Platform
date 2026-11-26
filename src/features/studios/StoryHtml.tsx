import {useEffect,useRef,useState} from 'react';
import {readMediaBlob,resolveMedia} from '../../domain/upload';
import '../../styles/studio-creation.css';

/** Opaque sandbox origin; HTML cannot read the host app, storage or credentials. */
export function StoryHtml({src,title,onComplete}:{src:string;title:string;onComplete?:()=>void}){
 const [resolved,setResolved]=useState(''),frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{let active=true,url='';setResolved('');const load=async()=>{try{url=src.startsWith('idb:')?URL.createObjectURL(new Blob([await readMediaBlob(src)],{type:'text/html;charset=utf-8'})):await resolveMedia(src);if(active)setResolved(url);else if(src.startsWith('idb:'))URL.revokeObjectURL(url);}catch{if(active)setStatus('failed');}};void load();return()=>{active=false;if(url&&src.startsWith('idb:'))URL.revokeObjectURL(url);}},[src]);
 const [status,setStatus]=useState<'loading'|'ready'|'failed'|'complete'>('loading');
 const safe=resolved&&/^(blob:|https?:\/\/|\/[^/])/.test(resolved)?resolved:undefined;
 useEffect(()=>{setStatus('loading');if(!safe)return;const timer=setTimeout(()=>setStatus(s=>s==='loading'?'failed':s),15000);return()=>clearTimeout(timer)},[safe]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow)return;if(event.data?.type==='zhichuang:complete'){setStatus('complete');onComplete?.();}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[onComplete]);
 return <div className="story-html-frame">{status!=='ready'&&<span className="story-html-status" role="status">{status==='loading'?'正在加载交互内容…':status==='complete'?'体验已完成，可继续下一节点':'交互内容未能加载，可返回检查素材或继续下一节点'}</span>}{safe&&<iframe ref={frame} title={title} src={safe} sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={()=>setStatus('ready')} onError={()=>setStatus('failed')}/>}</div>;
}
