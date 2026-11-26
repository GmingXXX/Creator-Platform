import {useEffect,useRef,useState} from 'react';
import {Check,Maximize2,Play,RotateCcw} from 'lucide-react';
import {Button,Modal} from '../../components/ui';
import {FullscreenButton,usePreviewFullscreen} from '../../components/PreviewFullscreen';
import type {Work} from '../../domain/types';
import {SceneRenderer} from '../editor/SceneRenderer';
import {MaterialWorkPreview} from '../resources/MaterialWorkPreview';
import {StoryExperience} from '../studios/StoryPreview';
import {StudioImage} from '../studios/StudioShared';
import {referenceKindLabel,type ReferenceSourceChoice} from './reference-source-choices';
import './reference-source-picker.css';
function SceneFrame({work,pageId,interactive=false}:{work:Work;pageId?:string;interactive?:boolean}){
 const host=useRef<HTMLDivElement>(null),[scale,setScale]=useState(0);
 useEffect(()=>{if(!host.current)return;const fit=()=>setScale(host.current!.clientWidth/work.width);fit();const observer=new ResizeObserver(fit);observer.observe(host.current);return()=>observer.disconnect();},[work.width]);
 return <div className="reference-scene-frame" ref={host} style={{aspectRatio:`${work.width}/${work.height}`}}><div style={{width:work.width,height:work.height,transform:`scale(${scale})`,transformOrigin:'top left'}}><SceneRenderer work={work} pageId={pageId} interactive={interactive}/></div></div>;
}
function StoryThumbnail({work}:{work:Work}){
 const node=work.storyNodes?.find(item=>item.type==='start')||work.storyNodes?.[0];
 return <div className="reference-story-thumbnail" style={{aspectRatio:`${work.width}/${work.height}`}}>{node?.media&&<StudioImage src={node.media} alt={node.title}/>}<span><b>{node?.title||work.title}</b><small>{node?.text||`${work.storyNodes?.length||0} 个故事节点`}</small></span></div>;
}
function Thumbnail({work}:{work:Work}){
 if(work.kind==='story')return <StoryThumbnail work={work}/>;
 if(work.kind==='video')return <MaterialWorkPreview work={work}/>;
 if(!work.pages.length)return <div className="reference-preview-empty">空白作品</div>;
 return <SceneFrame work={work}/>;
}
function LargePreview({choice,onSelect,onClose}:{choice:ReferenceSourceChoice;onSelect:()=>void;onClose:()=>void}){
 const {work}=choice,host=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(host),[index,setIndex]=useState(0),[running,setRunning]=useState(false),[restart,setRestart]=useState(0);
 const page=work.pages[Math.min(index,work.pages.length-1)];
 const canRun=work.kind==='exhibit'||work.kind==='story';
 return <Modal open onClose={()=>{if(fullscreen.active)void fullscreen.exit();else onClose();}} title={`展项预览 · ${choice.title}`} wide footer={<><Button onClick={onClose}>返回选择</Button><Button variant="primary" onClick={onSelect}><Check size={14}/>选择此展项</Button></>}><div ref={host} className="reference-preview-host preview-fullscreen-surface"><div className="reference-preview-tools"><span>{referenceKindLabel(work)} · {choice.kind==='work'?'当前空间':'社区模板'}</span>{canRun&&<Button size="sm" onClick={()=>setRunning(value=>!value)}><Play size={14}/>{running?'停止试运行':'试运行'}</Button>}{running&&<Button size="sm" onClick={()=>setRestart(value=>value+1)}><RotateCcw size={14}/>重新开始</Button>}<FullscreenButton fullscreen={fullscreen}/></div>
  <div className="reference-preview-content">{work.kind==='story'?(running?<StoryExperience projectMusic={work.storyMusic} styleId={work.styleId} key={restart} nodes={work.storyNodes||[]} edges={work.storyEdges||[]} width={work.width} height={work.height} showFullscreen={false}/>:<StoryThumbnail work={work}/>):work.kind==='video'?<MaterialWorkPreview work={work} large showFullscreen={false}/>:page?<SceneFrame key={`${page.id}:${running}:${restart}`} work={work} pageId={page.id} interactive={running}/>:<div className="reference-preview-empty">作品还没有页面</div>}</div>
  {work.pages.length>0&&work.kind!=='video'&&<div className="reference-preview-pages" aria-label="参考展项页面">{work.pages.map((item,i)=><button key={item.id} aria-pressed={i===index} onClick={()=>setIndex(i)}>{i+1} · {item.name}</button>)}</div>}
 </div></Modal>;
}
export function ReferenceSourcePicker({choices,value,onChange}:{choices:ReferenceSourceChoice[];value:string;onChange:(value:string)=>void}){
 const [preview,setPreview]=useState<string>();
 const current=choices.find(choice=>choice.value===preview);
 return <><div className="reference-source-grid" role="group" aria-label="参考展项"><>{choices.map(choice=><article className="reference-source-card" key={choice.value} data-reference-source={choice.value} data-selected={choice.value===value}><div className="reference-source-thumbnail" aria-hidden="true" inert><Thumbnail work={choice.work}/></div><button type="button" className="reference-source-select" aria-label={`选择参考 ${choice.title}`} aria-pressed={choice.value===value} onClick={()=>onChange(choice.value)}><strong>{choice.title}</strong><small>{choice.kind==='work'?'当前空间':'社区模板'} · {referenceKindLabel(choice.work)}{choice.work.pages.length>0?` · ${choice.work.pages.length} 页`:''}</small>{choice.value===value&&<Check className="reference-source-check" size={17}/>}</button><button type="button" className="reference-source-preview" aria-label={`预览参考 ${choice.title}`} onClick={()=>setPreview(choice.value)}><Maximize2 size={13}/>放大预览</button></article>)}</></div>{!choices.length&&<p className="reference-manager-hint">没有匹配的参考展项，请尝试其他关键词。</p>}{current&&<LargePreview key={current.value} choice={current} onClose={()=>setPreview(undefined)} onSelect={()=>{onChange(current.value);setPreview(undefined);}}/>}</>;
}
