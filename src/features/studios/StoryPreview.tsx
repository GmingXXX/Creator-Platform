import {FullscreenButton,usePreviewFullscreen} from '../../components/PreviewFullscreen';
import { StoryHtml } from './StoryHtml';
import { storyMediaKind } from './creationLogic';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, GitBranch, RotateCcw } from 'lucide-react';
import { useStudio } from '../../domain/store';
import { Button, Badge, EmptyState, Modal } from '../../components/ui';
import type { StoryEdge, StoryNode } from '../../domain/types';
import { StudioImage, StudioVideo } from './StudioShared';
import { isBranchAvailable, nextStoryNode, parseBranch } from './studioLogic';

type StoryExperienceProps = { nodes: StoryNode[]; edges: StoryEdge[]; width?:number; height?:number; showFullscreen?:boolean };

/** Shared runtime for editor trials, project previews and published story templates. */
export function StoryExperience({ nodes: sourceNodes, edges, width=1920, height=1080,showFullscreen=true }: StoryExperienceProps) {
  const surface=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(surface);
  const assets = useStudio(state => state.assets);
  const nodes = sourceNodes.map(node => node.type === 'ending' ? { ...node, type: 'end' } : node);
  const start = nodes.find(node => node.type === 'start')?.id || nodes[0]?.id;
  const [current, setCurrent] = useState(start);
  const [history, setHistory] = useState<string[]>([]);
  const [preference, setPreference] = useState('green');
  const conditional = edges.some(edge => parseBranch(edge.label).condition !== 'any');
  useEffect(() => { setCurrent(start); setHistory([]); }, [start]);
  const node = nodes.find(item => item.id === current);
  if (!node) return <EmptyState title="还没有可预览的故事场景" description="在节点画布中添加开始、场景和结局，并连接体验路径。" />;
  const next = (edgeId: string) => {
    const target = nextStoryNode(nodes, edges, current, edgeId);
    if (target) { setHistory(items => [...items, current]); setCurrent(target.id); }
  };
  const reset = () => { setCurrent(start); setHistory([]); };
  const options = edges.filter(edge => edge.source === current);
  const ending = node.type === 'end';
  const mediaKind=storyMediaKind(node,assets);
  return <div ref={surface} className="story-experience preview-fullscreen-surface">
    <div className="story-preview-config"><Badge tone="blue">互动预览</Badge>{conditional?<><label>探索倾向<select value={preference} onChange={event => setPreference(event.target.value)}><option value="green">绿色能源</option><option value="technology">智能制造</option></select></label><span>用于测试已有条件分支</span></>:<span>根据画面中的选项，探索不同的故事结局</span>}{showFullscreen&&<FullscreenButton fullscreen={fullscreen}/>}</div>
    <div className={`story-preview-scene ${ending ? 'is-ending' : ''} ${mediaKind==='html'?'has-html':''}`} style={{aspectRatio:`${width}/${height}`}}>
      {node.media ? mediaKind==='html'?<StoryHtml key={node.id} src={node.media} title={node.title}/>:mediaKind==='video' ? <StudioVideo key={node.id} src={node.media} autoPlay controls /> : <StudioImage src={node.media} alt={node.title} /> : <div className="story-preview-ambient" />}
      <div className="story-preview-body">
        {ending ? <div className="story-ending-medal"><Award size={30} /></div> : <span className="story-preview-chapter">{node.type === 'choice' ? 'YOUR CHOICE' : 'IMMERSIVE JOURNEY'}</span>}
        <h2>{node.title}</h2><p>{node.text}</p>
        {ending ? <Button onClick={reset}><RotateCcw size={15} />体验另一种结局</Button> : <div className="story-preview-options">{options.map(edge => {
          const branch = parseBranch(edge.label);
          const available = isBranchAvailable(edge.label, preference);
          return <button key={edge.id} disabled={!available} onClick={() => next(edge.id)}><span>{branch.label || '继续'}{!available && <small>需要选择{branch.condition === 'green' ? '绿色能源' : '智能制造'}倾向</small>}</span><ArrowRight size={17} /></button>;
        })}{!options.length && <p>这个场景还没有连接下一节点，请返回节点画布完善体验路径。</p>}</div>}
      </div>
    </div>
    <div className="story-preview-footer"><Button variant="ghost" disabled={!history.length} onClick={() => { setCurrent(history[history.length - 1]); setHistory(items => items.slice(0, -1)); }}><ArrowLeft size={14} />返回上一步</Button><span><GitBranch size={14} />{history.length + 1} 个已访问节点{ending ? ' · 已抵达结局' : ''}</span><Button variant="ghost" onClick={reset}>重新开始</Button></div>
  </div>;
}

export function StoryPreview({ nodes, edges, title, onClose, width, height }: StoryExperienceProps & { title: string; onClose: () => void }) {
  return <Modal open onClose={onClose} title={`试运行 · ${title}`} wide><StoryExperience nodes={nodes} edges={edges} width={width} height={height} /></Modal>;
}
