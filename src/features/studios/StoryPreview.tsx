import {photoSampleResults} from '../../domain/story-photo';
import {storyShowsCaption} from '../../domain/story-layer-editing';
import {StorySoundPlayer} from './StorySound';
import type {StoryAudioTrack} from '../../domain/story-audio';
import {storyScenePaint} from './story-scene-paint';
import {StoryPhotoFrame,StoryPhotoExperience} from './StoryPhoto';
import {StoryLayers} from './StoryLayers';
import {conditionAllows,readVisitCondition} from '../../domain/story-events';
import {storyRoute,type StoryTrigger} from '../../domain/story-canvas';
import {FullscreenButton,usePreviewFullscreen} from '../../components/PreviewFullscreen';
import { StoryHtml } from './StoryHtml';
import { storyMediaKind } from './creationLogic';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, GitBranch, RotateCcw } from 'lucide-react';
import { useStudio } from '../../domain/store';
import { Button, Badge, EmptyState, Modal } from '../../components/ui';
import type { StoryEdge, StoryNode } from '../../domain/types';
import { StudioImage, StudioVideo } from './StudioShared';
import { nextStoryNode, parseBranch } from './studioLogic';

type StoryExperienceProps = { projectMusic?:StoryAudioTrack; nodes: StoryNode[]; edges: StoryEdge[]; width?:number; height?:number; styleId?:string; showFullscreen?:boolean };

/** Shared runtime for editor trials, project previews and published story templates. */
export function StoryExperience({ nodes: sourceNodes, edges,projectMusic, width=1920, height=1080,styleId,showFullscreen=true }: StoryExperienceProps) {
  const surface=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(surface);
  const style=useStudio(state=>state.systems.find(v=>v.id===styleId));
  const assets = useStudio(state => state.assets);
  const nodes = sourceNodes.map(node => node.type === 'ending' ? { ...node, type: 'end' } : node);
  const start = nodes.find(node => node.type === 'start')?.id || nodes[0]?.id;
  const [current, setCurrent] = useState(start);
  const [history, setHistory] = useState<string[]>([]);
  const [resultMedia,setResultMedia]=useState<Partial<Record<'photo'|'faceImage'|'faceVideo',string>>>({});
  const [visibility,setVisibility]=useState<Record<string,boolean>>({});
  useEffect(()=>{setVisibility({});},[current]);
  const [preference, setPreference] = useState('green');
  const conditional = edges.some(edge => ['green','technology'].includes(parseBranch(edge.label).condition));
  useEffect(() => { setCurrent(start); setHistory([]); }, [start]);
  const node = nodes.find(item => item.id === current);
  const available=(edge:StoryEdge)=>conditionAllows(parseBranch(edge.label).condition,history,preference);
  const next = (edgeId: string) => {
    const rule=edges.find(e=>e.source===current&&e.id===edgeId);
    if(!rule||!available(rule))return;
    if(rule.effects?.length)setVisibility(v=>({...v,...Object.fromEntries(rule.effects!.map(f=>[f.layerId,f.kind==='show']))}));
    if(rule?.stay)return;
    const target = nextStoryNode(nodes, edges, current, edgeId);
    if (target) { setHistory(items => [...items, current]); setCurrent(target.id); }
  };
  const [restart,setRestart]=useState(0);
  const reset = () => { setCurrent(start); setHistory([]);setVisibility({});setResultMedia({});setRestart(v=>v+1); };
  const options = edges.filter(edge => edge.source === current);
  const latestTimer=useRef<(seconds:number)=>void>(()=>{});
  latestTimer.current=(seconds:number)=>{
    const route=options.find(edge=>edge.trigger==='delay'&&(edge.delaySeconds||5)===seconds&&available(edge)&&(edge.stay||nodes.some(n=>n.id===edge.target)));
    if(route)next(route.id);
  };
  const waits=Array.from(new Set(options.filter(e=>e.trigger==='delay').map(e=>e.delaySeconds||5))).sort((a,b)=>a-b).join(',');
  useEffect(()=>{
    if(!waits||node?.type==='end')return;
    const timers=waits.split(',').map(Number).filter(s=>s>=1&&s<=3600).map(s=>window.setTimeout(()=>latestTimer.current(s),s*1000));
    return ()=>timers.forEach(clearTimeout);
  },[current,waits,restart,node?.type]);
  if (!node) return <EmptyState title="还没有可预览的故事场景" description="在节点画布中添加开始、场景和结局，并连接体验路径。" />;
  const ending = node.type === 'end';
  const emit=(trigger:StoryTrigger,layerId?:string)=>{const edge=storyRoute(options.filter(available),current,trigger,layerId);if(edge)next(edge.id);};
  const mediaKind=storyMediaKind(node,assets);
  return <div ref={surface} className="story-experience preview-fullscreen-surface">
    <div className="story-preview-config"><Badge tone="blue">互动预览</Badge>{conditional?<><label>探索倾向<select value={preference} onChange={event => setPreference(event.target.value)}><option value="green">绿色能源</option><option value="technology">智能制造</option></select></label><span>用于测试已有条件分支</span></>:<span>根据画面中的选项，探索不同的故事结局</span>}<StorySoundPlayer projectMusic={projectMusic} sound={node.sound} nodeId={node.id} restart={restart}/>{showFullscreen&&<FullscreenButton fullscreen={fullscreen}/>}</div>
    <div key={node.id+'-'+restart} className={`story-preview-scene story-authored-scene ${node.media?'has-scene-media':''} ${ending ? 'is-ending' : ''} ${mediaKind==='html'?'has-html':''}`} style={{...storyScenePaint(style,!!node.media,storyShowsCaption(node)),aspectRatio:`${width}/${height}`}}>
      {node.media ? mediaKind==='html'?<StoryHtml key={node.id} src={node.media} title={node.title} onComplete={()=>emit('htmlComplete')}/>:mediaKind==='video' ? <StudioVideo key={node.id} src={node.media} volume={node.sound?.videoVolume??.5} autoPlay controls onEnded={()=>emit('videoEnd')} /> : <StudioImage src={node.media} alt={node.title} /> : null}
      {node.type==='photo'&&<StoryPhotoFrame value={node.photo}/>}
      <div className="story-preview-body" style={{fontFamily:'inherit',color:'inherit'}}>
        {storyShowsCaption(node)&&<>{ending ? <div className="story-ending-medal"><Award size={30} /></div> : <span className="story-preview-chapter">{node.type === 'choice' ? 'YOUR CHOICE' : 'IMMERSIVE JOURNEY'}</span>}
        <h2>{node.title}</h2><p>{node.text}</p></>}
        {node.type==='photo'&&<StoryPhotoExperience key={node.id+'-'+restart} value={node.photo}
          onConfirm={src=>{setResultMedia(photoSampleResults(node.photo,src));emit('photoConfirm');}}
          onSkip={options.some(edge=>edge.trigger==='photoSkip'&&available(edge)&&(edge.stay||nodes.some(n=>n.id===edge.target)))?()=>emit('photoSkip'):undefined}/>}
        {ending ? <Button onClick={reset}><RotateCcw size={15} />体验另一种结局</Button> : <div className="story-preview-options">{options.filter(e=>!e.trigger||e.trigger==='click').map(edge => {
          const branch = parseBranch(edge.label);
          const connected=edge.stay||nodes.some(n=>n.id===edge.target);
          const enabled = connected&&available(edge);
          const visit=readVisitCondition(branch.condition);const required=nodes.find(n=>n.id===visit?.nodeId);
          return <button key={edge.id} disabled={!enabled} onClick={() => next(edge.id)}><span>{branch.label || '继续'}{!connected&&<small>待连接后续节点</small>}{connected&&!enabled && <small>{visit?(visit.mode==='visited'?'需要先到达':'仅在尚未到过')+'「'+(required?.title||'原节点已移除')+'」': '需要选择'+(branch.condition==='green'?'绿色能源':'智能制造')+'倾向'}</small>}</span><ArrowRight size={17} /></button>;
        })}{!options.length && <p>这个场景还没有连接下一节点，请返回节点画布完善体验路径。</p>}</div>}
      </div>
      <StoryLayers clickableIds={options.filter(e=>e.trigger==='layerClick'&&e.layerId&&available(e)).map(e=>e.layerId!)} resultMedia={resultMedia} layers={(node.layers||[]).filter(l=>visibility[l.id]??!l.hidden)} onEvent={emit}/>
    </div>
    <div className="story-preview-footer"><Button variant="ghost" disabled={!history.length} onClick={() => { setCurrent(history[history.length - 1]); setHistory(items => items.slice(0, -1)); }}><ArrowLeft size={14} />返回上一步</Button><span><GitBranch size={14} />{history.length + 1} 个已访问节点{ending ? ' · 已抵达结局' : ''}</span><Button variant="ghost" onClick={reset}>重新开始</Button></div>
  </div>;
}

export function StoryPreview({ nodes, edges, projectMusic, title, onClose, width, height, styleId }: StoryExperienceProps & { title: string; onClose: () => void }) {
  return <Modal open onClose={onClose} title={`试运行 · ${title}`} wide><StoryExperience projectMusic={projectMusic} styleId={styleId} nodes={nodes} edges={edges} width={width} height={height} /></Modal>;
}
