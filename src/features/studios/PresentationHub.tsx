import { PresentationCreationDialog } from './PresentationCreationDialog';
import { workAvailableInSpace } from '../../domain/asset-access';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, FileText, Film, Layers, Plus, Presentation, Sparkles, Upload, X } from 'lucide-react';
import { Button, Badge, Modal, PageHeader, EmptyState, toast } from '../../components/ui';
import { Artwork } from '../../components/Artwork';
import { useStudio } from '../../domain/store';
import { importFile } from '../../domain/upload';
import { makePresentationPages } from './studioLogic';
import { Field, Stepbar } from './StudioShared';
import '../../styles/studios.css';

export function PresentationHubPage(){
 const navigate=useNavigate(),works=useStudio(s=>s.works),workspaceId=useStudio(s=>s.activeWorkspaceId);
 const [searchParams,setSearchParams]=useSearchParams();const tab=searchParams.get('tab')==='video'?'video':'presentation';
 const setTab=(value:'presentation'|'video')=>setSearchParams(value==='video'?{tab:'video'}:{},{replace:true});
 const [creating,setCreating]=useState(false),[topic,setTopic]=useState('');
 const visible=works.filter(w=>w.kind===tab&&!w.archived&&workAvailableInSpace(w,workspaceId));
 const begin=()=>{setTopic('');setCreating(true)};
 return <div className="studio-hub page-content"><PageHeader title="智能演示" description="制作可动态播放、自主讲解和智能问答的幻灯片，创作内容保存在作品库。"><Button onClick={()=>navigate('/projects?category=presentation-video')}>查看作品</Button><Button variant="primary" onClick={begin}><Plus size={16}/>新建{tab==='presentation'?'演示':'视频'}</Button></PageHeader>
  <div className="studio-hub-hero"><div><span className="studio-eyebrow"><Sparkles size={14}/>从资料到讲述</span><h2>把想法，讲得更清楚。</h2><p>整理大纲、设计画面、编写讲稿。<br/>让一份内容，成为可讲解、可追问的展厅体验。</p><Button variant="primary" onClick={begin}>开始创作<ArrowRight size={16}/></Button></div><div className="studio-hero-art"><div className="hero-slide-small"><Layers size={16}/><span>内容大纲</span><i/><i/><i/></div><Artwork type="gallery" styleId="technology" title="创新，让未来发生"/><div className="hero-audio-pill"><span className="mini-wave">▂▅▃▇▅▂▆▃</span>智能讲解 · 随时追问</div></div></div>
  <div className="studio-section-title"><div className="studio-tabs"><button className={tab==='presentation'?'active':''} onClick={()=>setTab('presentation')}><Presentation size={16}/>讲解演示</button><button className={tab==='video'?'active':''} onClick={()=>setTab('video')}><Film size={16}/>视频创作</button></div><span>{visible.length} 个作品</span></div>
  <p className="studio-muted">最近创作 · 保存在作品库</p><div className="studio-work-grid"><button className="studio-new-card" onClick={begin}><span><Plus size={25}/></span><b>创建{tab==='presentation'?'讲解演示':'视频作品'}</b><small>从一句话或已有资料开始</small></button>{visible.map(work=><button className="studio-work-card" key={work.id} onClick={()=>navigate(tab==='presentation'?`/presentations/${work.id}`:`/video/${work.id}`)}><Artwork work={work} title={work.title} styleId={work.styleId} type="gallery"/><div><h3>{work.title}</h3><p><span>{tab==='presentation'?`${work.pages.length} 页演示`:`${work.shots?.length||0} 个分镜`}</span><span>{new Date(work.updatedAt).toLocaleDateString('zh-CN')}</span></p></div></button>)}</div>
  <div className="studio-inspiration"><h3>为下一次表达寻找灵感</h3><div>{[['企业接待讲解','把企业能力与代表案例，讲成一段参观旅程'],['展项汇报方案','向客户讲清内容结构与互动方式'],['品牌开场短片','用节奏、画面与声音建立第一印象']].map(([title,desc])=><button key={title} onClick={()=>{setTopic(title);setTab(title==='品牌开场短片'?'video':'presentation');setCreating(true)}}><FileText size={18}/><span><b>{title}</b><small>{desc}</small></span><ArrowRight size={15}/></button>)}</div></div>
  <PresentationCreationDialog open={creating} onClose={()=>setCreating(false)} initialKind={tab} initialTopic={topic}/>

 </div>;
}
