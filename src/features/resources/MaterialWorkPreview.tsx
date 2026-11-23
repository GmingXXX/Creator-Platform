import {FullscreenButton,usePreviewFullscreen} from '../../components/PreviewFullscreen';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Work } from '../../domain/types';
import { useStudio } from '../../domain/store';
import { useMedia } from '../../domain/upload';
import { Artwork } from '../../components/Artwork';
import { Button } from '../../components/ui';
import { SceneRenderer } from '../editor/SceneRenderer';
import {StudioImage,StudioVideo} from '../studios/StudioShared';
import '../../styles/material-outputs.css';

type Shot = NonNullable<Work['shots']>[number];
function SlidePreview({ work, pageId }: { work: Work; pageId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const fit = () => setScale(Math.min(element.clientWidth/work.width,element.clientHeight/work.height));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [work.width,work.height]);
  return <div className="res-runtime-preview" ref={host} style={{ aspectRatio: `${work.width} / ${work.height}` }}>
    <div style={{ width: work.width, height: work.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      <SceneRenderer work={work} pageId={pageId} interactive={false} />
    </div>
  </div>;
}

function ShotFrame({ shot, large = false, playing = false }: { shot: Shot; large?: boolean; playing?: boolean }) {
  const isStoredVideo=useStudio(state=>state.assets.some(asset=>asset.src===shot.src&&asset.kind==='video'&&!asset.sourceWorkId&&!asset.workSnapshot));
  const isVideo=/\.(mp4|webm|mov)(?:[?#]|$)/i.test(shot.src)||isStoredVideo;
  return <div className="res-material-shot">
    {isVideo?<StudioVideo src={shot.src} muted playing={playing} controls={large}/>:<StudioImage src={shot.src} alt={shot.title}/>}
    <div className="res-material-caption"><strong>{shot.title}</strong>{large&&<p>{shot.narration}</p>}</div>
  </div>;
}

function VideoMaterialPreview({ work, large,showFullscreen }: { work: Work; large: boolean;showFullscreen:boolean }) {
  const surface=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(surface);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const shots = work.shots || [];
  const total = shots.reduce((sum, shot) => sum + shot.duration, 0);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed(value => Math.min(value + .1, total)), 100);
    return () => clearInterval(timer);
  }, [playing, total]);
  useEffect(() => { if (elapsed >= total) setPlaying(false); }, [elapsed, total]);
  let end = 0;
  const index = shots.findIndex(shot => { end += shot.duration; return elapsed < end; });
  const shot = shots[index < 0 ? shots.length - 1 : index];
  if (!shot) return <div className="res-soft-panel"><p>还没有分镜，继续编辑以添加画面。</p></div>;
  if (!large) return <div className="res-asset-preview res-material-thumbnail"><ShotFrame shot={shots[0]} /><span className="res-asset-kind">视频分镜 · {shots.length} 镜</span></div>;
  return <div ref={surface} className="res-material-preview preview-fullscreen-surface" data-testid="video-material-preview">
    {showFullscreen&&<div className="preview-fullscreen-toolbar"><FullscreenButton fullscreen={fullscreen}/></div>}
    <ShotFrame shot={shot} large playing={playing} />
    <div className="res-material-controls"><Button size="sm" variant="secondary" onClick={() => { if (elapsed >= total) setElapsed(0); setPlaying(value => !value); }}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? '暂停分镜' : '播放分镜'}</Button><input aria-label="素材分镜预览进度" type="range" min="0" max={total} step=".1" value={elapsed} onChange={event => setElapsed(Number(event.target.value))} /><span>{Math.floor(elapsed)} / {total} 秒</span></div>
    <div className="res-page-strip">{shots.map((item, i) => <button key={item.id} className={item.id === shot.id ? 'active' : ''} onClick={() => setElapsed(shots.slice(0, i).reduce((sum, value) => sum + value.duration, 0))}><span>{String(i + 1).padStart(2, '0')}</span>{item.title}</button>)}</div>
    <p className="res-muted res-material-note">按当前分镜播放画面与字幕；完整视频尚未合成。继续编辑可调整画面、文案与时长。</p>
  </div>;
}

export function MaterialWorkPreview({ work, large = false,showFullscreen=true }: { work: Work; large?: boolean;showFullscreen?:boolean }) {
  const surface=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(surface);
  const [pageIndex, setPageIndex] = useState(0);
  if (work.kind === 'video') return <VideoMaterialPreview key={work.id} work={work} large={large} showFullscreen={showFullscreen}/>;
  if (!large) return <div className="res-asset-preview res-material-thumbnail"><Artwork work={work} /><span className="res-asset-kind">演示文稿 · {work.pages.length} 页</span></div>;
  const page = work.pages[Math.min(pageIndex, work.pages.length - 1)];
  return <div ref={surface} className="res-material-preview preview-fullscreen-surface" data-testid="presentation-material-preview">
    {showFullscreen&&<div className="preview-fullscreen-toolbar"><FullscreenButton fullscreen={fullscreen}/></div>}
    <SlidePreview work={work} pageId={page?.id} />
    <div className="res-page-strip">{work.pages.map((item, index) => <button key={item.id} className={item.id === page?.id ? 'active' : ''} onClick={() => setPageIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.name}</button>)}</div>
    <p className="res-muted res-material-note">{work.pages.length} 页可编辑演示文稿 · 包含页面内容与讲稿，继续编辑可调整内容和讲解。</p>
  </div>;
}
