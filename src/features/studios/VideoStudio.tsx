import {FullscreenButton,usePreviewFullscreen} from '../../components/PreviewFullscreen';
import {FloatingWorkAgent} from '../editor/FloatingWorkAgent';
import { assetAvailableForInsertion } from '../../domain/asset-access';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Film, Image, Music2, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button, Badge, EmptyState, Menu, Modal, toast } from '../../components/ui';
import { useStudio } from '../../domain/store';
import type { Work } from '../../domain/types';
import { Field, StudioImage, StudioMediaPlaceholder, StudioTopbar, StudioVideo, downloadJSON, useUnsavedWarning } from './StudioShared';
import { reorder } from './studioLogic';
import '../../styles/studios.css';
import { navigateInWorkspace } from '../workspace/output-navigation';
import { MaterialPicker } from '../resources/MaterialPicker';
type Shot=NonNullable<Work['shots']>[number];
export function VideoStudioPage(){
 const {id}=useParams();const navigate=useNavigate();const source=useStudio(s=>s.works.find(w=>w.id===id&&!w.deletedAt));const saveWork=useStudio(s=>s.saveWork);const allAssets=useStudio(s=>s.assets);const assets=allAssets.filter(a=>assetAvailableForInsertion(a,source?.workspaceId));
 const [work,setWork]=useState<Work|undefined>(()=>source&&structuredClone(source));const [selected,setSelected]=useState(0);const [dirty,setDirty]=useState(false);const [preview,setPreview]=useState(false);const [picker,setPicker]=useState(false);const [playing,setPlaying]=useState(false);const [time,setTime]=useState(0);const [preset,setPreset]=useState(false);
 const previewSurface=useRef<HTMLDivElement>(null);const fullscreen=usePreviewFullscreen(previewSurface);
 useEffect(()=>{setWork(source&&structuredClone(source));setSelected(0);setDirty(false)},[id]);useUnsavedWarning(dirty);
 const shots=work?.shots||[];const total=shots.reduce((a,s)=>a+s.duration,0);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setTime(t=>t+.1),100);return()=>clearInterval(timer)},[playing]);
 useEffect(()=>{if(time>=total&&playing){setPlaying(false);setTime(0)}},[time,total,playing]);
 if(!work)return <EmptyState title="没有找到这个视频工程" action={<Button onClick={()=>navigate('/projects?category=presentation-video')}>返回作品</Button>}/>;
 const shot=shots[selected];let accumulator=0;const liveShot=shots.find(s=>{accumulator+=s.duration;return time<accumulator})||shot;
 const change=(patch:Partial<Work>)=>{setWork(w=>w?{...w,...patch}:w);setDirty(true)};
 const patchShot=(patch:Partial<Shot>)=>change({shots:shots.map((s,i)=>i===selected?{...s,...patch}:s)});
 const save=()=>{try{saveWork(work);setDirty(false);toast('视频作品已保存到作品库');return true}catch(e){toast(e instanceof Error?e.message:'保存失败');return false}};
 const openProjects=()=>{if(dirty&&!save())return;navigateInWorkspace(navigate,work.workspaceId,'/projects?category=presentation-video')};
 const add=()=>{change({shots:[...shots,{id:crypto.randomUUID(),title:`分镜 ${shots.length+1}`,narration:'在这里写下这一段画面的讲述。',duration:8,src:''}]});setSelected(shots.length)};
 const downloadSample=()=>{const a=document.createElement('a');a.href='/media/demo-loop.mp4';a.download='智创平台-预置视频样片.mp4';a.click();toast('下载预置样片；工程中的修改请导出 JSON 保存')};
 const media=(s:Shot,mode:'thumbnail'|'stage'|'preview'='thumbnail')=>{
  const isVideo=/\.(mp4|webm|mov)(?:[?#]|$)/i.test(s.src)||assets.some(a=>a.src===s.src&&a.kind==='video');
  if(!isVideo)return <StudioImage src={s.src} alt={s.title}/>;
  return mode==='thumbnail'?<span className="studio-video-thumbnail"><Film size={18}/>视频素材</span>:<StudioVideo src={s.src} controls playing={mode==='preview'?playing:undefined} muted loop={mode==='preview'}/>;
 };
 return <div className="studio-editor video-editor"><StudioTopbar workspaceId={work.workspaceId} title={work.title} back="/projects?category=presentation-video" saved={!dirty} onSave={save}><FloatingWorkAgent work={work} nodeId={shot?.id} onBeforeApply={()=>{if(dirty){saveWork(work);setDirty(false)}}} onApplied={next=>{setWork(next);setDirty(false)}}/><Button onClick={openProjects}>查看作品</Button><Menu trigger={<Button><Download size={14}/>导出</Button>} items={[{label:'视频工程（JSON）',onClick:()=>downloadJSON({...work,renderStatus:'not-rendered'},`${work.title}-视频工程.json`)},{label:'下载预置样片（MP4）',onClick:downloadSample}]}/><Button variant="primary" onClick={()=>{setPreview(true);setPlaying(true);setTime(0)}}><Play size={15}/>预览分镜</Button></StudioTopbar>
  <div className="video-workspace"><aside className="video-shot-rail"><div className="studio-panel-heading"><b>故事分镜</b><Badge>{shots.length}</Badge><Button variant="ghost" size="icon" aria-label="添加分镜" onClick={add}><Plus size={16}/></Button></div><div className="video-shot-list">{shots.map((s,i)=><button className={i===selected?'active':''} key={s.id} onClick={()=>setSelected(i)}><span>{String(i+1).padStart(2,'0')}</span><div className="shot-thumb">{media(s)}</div><div><b>{s.title}</b><small>{s.duration} 秒</small></div></button>)}</div><Button onClick={add}><Plus size={14}/>添加分镜</Button></aside>
   <main className="video-main"><div className="video-stage-heading"><div><Badge>分镜 {selected+1}</Badge><h2>{shot?.title||'添加第一个分镜'}</h2></div><span>16:9 · 1920 × 1080</span></div><div className="video-preview-stage">{shot?media(shot,'stage'):<StudioMediaPlaceholder/>}<span className="video-scene-mark"><Film size={13}/>分镜画面预览</span>{shot&&<div className="video-scene-caption">{shot.narration}</div>}</div><div className="video-scene-actions"><span><Image size={15}/>素材来自素材库</span><Button size="sm" onClick={()=>setPicker(true)} disabled={!shot}>替换画面</Button></div>
    <div className="video-timeline"><div><h3>视频时间线</h3><span>总时长 {total} 秒</span></div><div className="video-timeline-track">{shots.map((s,i)=><button key={s.id} style={{flex:s.duration}} className={i===selected?'active':''} onClick={()=>setSelected(i)}><span>{i+1}</span><b>{s.title}</b><small>{s.duration}s</small></button>)}</div><div className="video-audio-track"><Music2 size={13}/><span>{work.voice||'专业讲解'} · 讲解音轨</span><i/></div></div>
    <div className="video-sample-note"><Sparkles size={17}/><div><b>制作流程演示</b><p>分镜与字幕可编辑和预览，当前作品尚未合成为视频。预置样片仅展示播放效果，不包含本作品的修改。</p></div><Button size="sm" onClick={()=>setPreset(true)}>查看样片</Button></div>
   </main><aside className="studio-inspector"><div className="studio-panel-heading"><b>分镜属性</b></div><div className="studio-inspector-body"><Field label="作品名称"><input maxLength={80} value={work.title} onChange={e=>change({title:e.target.value})}/></Field>{shot&&<><Field label="分镜标题"><input value={shot.title} onChange={e=>patchShot({title:e.target.value})}/></Field><Field label="讲述文案"><textarea rows={6} value={shot.narration} onChange={e=>patchShot({narration:e.target.value})}/></Field><Field label="画面时长（秒）"><input type="number" min="2" max="120" value={shot.duration} onChange={e=>patchShot({duration:Math.max(2,Math.min(120,Number(e.target.value)||2))})}/></Field><Field label="讲解声音"><select value={work.voice||'专业讲解'} onChange={e=>change({voice:e.target.value})}>{['专业讲解','自然亲和','沉稳叙事'].map(x=><option key={x}>{x}</option>)}</select></Field><div className="studio-property-divider"/><div className="studio-form-row"><Button disabled={selected===0} onClick={()=>{change({shots:reorder(shots,selected,-1)});setSelected(selected-1)}}><ArrowUp size={14}/>前移</Button><Button disabled={selected===shots.length-1} onClick={()=>{change({shots:reorder(shots,selected,1)});setSelected(selected+1)}}><ArrowDown size={14}/>后移</Button></div><Button variant="danger" disabled={shots.length<=1} onClick={()=>{change({shots:shots.filter(s=>s.id!==shot.id)});setSelected(Math.max(0,selected-1))}}><Trash2 size={14}/>删除分镜</Button></>}</div></aside>
  </div><MaterialPicker open={picker} onClose={()=>setPicker(false)} workspaceId={work.workspaceId||'personal'} kinds={['image','video']} title="选择画面素材" onSelect={asset=>patchShot({src:asset.src,assetId:asset.id})}/>
  <Modal open={preview} onClose={()=>{if(fullscreen.active){void fullscreen.exit();return;}setPreview(false);setPlaying(false)}} title="分镜动态预览" wide><div ref={previewSurface} className="video-trial-fullscreen preview-fullscreen-surface"><div className="preview-fullscreen-toolbar"><FullscreenButton fullscreen={fullscreen}/></div><div className="video-sequence-preview">{liveShot&&media(liveShot,'preview')}<div><b>{liveShot?.title}</b><p>{liveShot?.narration}</p></div></div><div className="video-play-controls"><Button onClick={()=>setPlaying(v=>!v)}>{playing?'暂停':'继续播放'}</Button><input aria-label="预览进度" type="range" min="0" max={total} step=".1" value={time} onChange={e=>setTime(Number(e.target.value))}/><span>{Math.floor(time)} / {total}s</span></div><p className="studio-muted">此预览按分镜时长播放画面与字幕。所选声音保存在作品中，当前尚未合成为完整视频。</p></div></Modal>
  <Modal open={preset} onClose={()=>setPreset(false)} title="预置视频样片" wide footer={<Button onClick={downloadSample}><Download size={14}/>下载预置样片</Button>}><StudioVideo src="/media/demo-loop.mp4" poster="/media/technology.svg" controls autoPlay/><p className="studio-muted">这是用于展示最终播放效果的预制样片，不包含当前工程的修改。</p></Modal>
 </div>;
}
