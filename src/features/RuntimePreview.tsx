import {FullscreenButton,usePreviewFullscreen} from '../components/PreviewFullscreen';
import {workspaceCanEdit} from '../domain/workspace-management';
import {currentPreviewReturn} from './workspace/editor-return';
import {getProjectCategory} from '../domain/project-taxonomy';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, RotateCcw } from 'lucide-react';
import { useStudio } from '../domain/store';
import { Button, EmptyState, useDocumentTitle } from '../components/ui';
import { SceneRenderer } from './editor/SceneRenderer';
import { workRoute } from './AppShell';
import {readEditorView} from './editor/editor-session';
import { StoryExperience } from './studios/StoryPreview';
import { MaterialWorkPreview } from './resources/MaterialWorkPreview';
import '../styles/studios.css';
import { navigateInWorkspace } from './workspace/output-navigation';

export function RuntimePreview(){
 const {id}=useParams(),navigate=useNavigate(),work=useStudio(s=>s.works.find(w=>w.id===id&&!w.deletedAt));
 const editable=useStudio(s=>work?workspaceCanEdit(s,work.workspaceId||'personal'):false);
 const surface=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(surface);
 const host=useRef<HTMLDivElement>(null),[scale,setScale]=useState(.5),[restart,setRestart]=useState(0),[command,setCommand]=useState(''),[sent,setSent]=useState(''),[commandNonce,setCommandNonce]=useState(0);
 useDocumentTitle(work?.title||'运行预览');
 useEffect(()=>{if(!host.current||!work)return;const observer=new ResizeObserver(([entry])=>setScale(Math.min(entry.contentRect.width/work.width,entry.contentRect.height/work.height)));observer.observe(host.current);return()=>observer.disconnect()},[work]);
 if(!work)return <EmptyState title="作品不存在" action={<Button onClick={()=>navigate('/projects')}>返回作品</Button>}/>;
 if(work.kind==='video'||work.kind==='presentation')return <div ref={surface} className="runtime-page preview-fullscreen-surface"><header><Button variant="ghost" onClick={()=>navigateInWorkspace(navigate,work.workspaceId,(editable?currentPreviewReturn(work.id,`/projects?category=${getProjectCategory(work)}`):'/projects'))}><ArrowLeft/>返回</Button><strong>{work.title}</strong><span>{work.kind==='video'?`视频工程 · ${work.shots?.length||0} 个分镜`:`讲解演示 · ${work.pages.length} 个页面`}</span><FullscreenButton fullscreen={fullscreen}/><Button variant="primary" disabled={!editable} onClick={()=>navigateInWorkspace(navigate,work.workspaceId,workRoute(work))}><Pencil/>{work.kind==='video'?'编辑视频工程':'编辑讲解演示'}</Button></header><main className="runtime-material-stage"><MaterialWorkPreview key={work.id} work={work} large showFullscreen={false}/></main></div>;
 if(work.kind==='story')return <div ref={surface} className="runtime-page preview-fullscreen-surface"><header><Button variant="ghost" onClick={()=>navigateInWorkspace(navigate,work.workspaceId,(editable?currentPreviewReturn(work.id,`/projects?category=${getProjectCategory(work)}`):'/projects'))}><ArrowLeft/>返回</Button><strong>{work.title}</strong><span>互动影片 · {work.storyNodes?.length||0} 个节点</span><FullscreenButton fullscreen={fullscreen}/><Button variant="primary" disabled={!editable} onClick={()=>navigateInWorkspace(navigate,work.workspaceId,workRoute(work))}><Pencil/>编辑互动影片</Button></header><main className="runtime-story-stage"><StoryExperience projectMusic={work.storyMusic} styleId={work.styleId} key={work.id} nodes={work.storyNodes||[]} edges={work.storyEdges||[]} width={work.width} height={work.height} showFullscreen={false}/></main></div>;
 return <div ref={surface} className="runtime-page preview-fullscreen-surface"><header><Button variant="ghost" onClick={()=>navigateInWorkspace(navigate,work.workspaceId,(editable?currentPreviewReturn(work.id,`/projects?category=${getProjectCategory(work)}`):'/projects'))}><ArrowLeft/>返回</Button><strong>{work.title}</strong><span>{work.width} × {work.height}</span><Button variant="ghost" onClick={()=>setRestart(restart+1)}><RotateCcw/>重新开始</Button><FullscreenButton fullscreen={fullscreen}/><Button variant="primary" disabled={!editable} onClick={()=>navigateInWorkspace(navigate,work.workspaceId,workRoute(work))}><Pencil/>编辑展项</Button></header><div ref={host} className="runtime-stage"><div style={{width:work.width*scale,height:work.height*scale,position:'relative'}}><div style={{transform:`scale(${scale})`,transformOrigin:'top left'}}><SceneRenderer key={restart} work={work} pageId={readEditorView(work)?.pageId} interactive commandText={sent} commandNonce={commandNonce}/></div></div></div><footer><span>运行预览 · 点击内容体验交互</span><form onSubmit={e=>{e.preventDefault();setSent(command);setCommandNonce(n=>n+1);setCommand('')}}><input aria-label="预览语音口令" value={command} onChange={e=>setCommand(e.target.value)} placeholder="输入语音口令进行演示"/><Button type="submit" size="sm">执行口令</Button></form></footer></div>
}
