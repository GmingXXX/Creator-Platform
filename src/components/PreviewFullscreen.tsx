import {useEffect,useState,type RefObject} from 'react';
import {Maximize,Minimize} from 'lucide-react';
import {Button,toast} from './ui';
import {togglePreviewFullscreen} from './preview-fullscreen-domain';
import '../styles/preview-fullscreen.css';
export interface PreviewFullscreenController {active:boolean;toggle:()=>Promise<void>;exit:()=>Promise<void>}
export function usePreviewFullscreen(ref:RefObject<HTMLElement|null>):PreviewFullscreenController {
 const [active,setActive]=useState(false);
 useEffect(()=>{const sync=()=>setActive(Boolean(ref.current&&document.fullscreenElement===ref.current));const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&ref.current&&document.fullscreenElement===ref.current)event.stopPropagation();};sync();document.addEventListener('fullscreenchange',sync);window.addEventListener('keydown',escape,true);return()=>{document.removeEventListener('fullscreenchange',sync);window.removeEventListener('keydown',escape,true);};},[ref]);
 const toggle=async()=>{const surface=ref.current;if(!surface)return;try{await togglePreviewFullscreen(surface,document);}catch(reason){toast(reason instanceof Error&&reason.message.includes('不支持')?reason.message:'浏览器未允许全屏，请重试或使用窗口预览',true);}};
 const exit=async()=>{if(!ref.current||document.fullscreenElement!==ref.current)return;try{await document.exitFullscreen();}catch{toast('暂时无法退出全屏，请按 Esc',true);}};
 return {active,toggle,exit};
}
export function FullscreenButton({fullscreen,className}:{fullscreen:PreviewFullscreenController;className?:string}) {
 return <Button size="sm" className={className} onClick={()=>void fullscreen.toggle()} aria-label={fullscreen.active?'退出全屏':'全屏'} title={fullscreen.active?'退出全屏（Esc）':'全屏'}>{fullscreen.active?<Minimize size={15}/>:<Maximize size={15}/>}<span>{fullscreen.active?'退出全屏':'全屏'}</span></Button>;
}
