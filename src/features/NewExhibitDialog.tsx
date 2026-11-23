import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, FilePlus2, LayoutTemplate, MousePointer2, Presentation, Clapperboard } from 'lucide-react';
import { useStudio } from '../domain/store';
import { exhibitTypes, resolutions } from '../domain/fixtures';
import type { ExhibitType } from '../domain/types';
import { Artwork } from '../components/Artwork';
import { Button, Modal, Field, toast } from '../components/ui';
import '../styles/v14-navigation.css';
import {ContentPurposePicker} from './resources/ProjectFilters';
import {PresentationCreationDialog} from './studios/PresentationCreationDialog';
import {StoryCreationDialog} from './studios/StoryCreationDialog';

type CreationStep = 'category' | 'interactive' | 'canvas' | 'presentation' | 'story';

export function NewExhibitDialog({open,onClose}:{open:boolean;onClose:()=>void}) {
 const [step,setStep]=useState<CreationStep>('category');
 const [session,setSession]=useState(0);
 const [title,setTitle]=useState('未命名作品');
 const [type,setType]=useState<ExhibitType|''>('');
 const [purposes,setPurposes]=useState<string[]>([]);
 const [resolution,setResolution]=useState('1920×1080');
 const [width,setWidth]=useState(1920),[height,setHeight]=useState(1080),[error,setError]=useState('');
 const createWork=useStudio(state=>state.createWork),navigate=useNavigate();
 useEffect(()=>{if(!open){setStep('category');setError('');setSession(value=>value+1);}},[open]);
 const close=()=>onClose();
 const enter=(path:string)=>{close();navigate(path);};
 const create=()=>{
  const [w,h]=resolution==='custom'?[width,height]:resolution.split('×').map(Number);
  if(!title.trim())return setError('请填写作品名称');
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<320||h<320||w>16384||h>16384)return setError('宽高需为 320–16384 之间的整数');
  try {
   const work=createWork({title:title.trim(),type:type||'卡片浏览型',displayForm:type||null,contentPurposes:purposes,width:w,height:h});
   close();navigate(`/editor/${work.id}`);toast('交互页面作品已创建，可以开始添加组件');
  } catch(reason){setError(reason instanceof Error?reason.message:'作品创建失败，请重试');}
 };
 const isStudio=step==='presentation'||step==='story';
 const dialogStep=isStudio?'category':step;
 const titles={category:'新建作品',interactive:'新建交互页面',canvas:'设置你的新作品'};
 const descriptions={category:'选择这次想制作的内容，作品会保存在当前空间。',interactive:'从空白画布开始，或复用一份成熟的模板。',canvas:'设置名称和屏幕尺寸，展示内容与展示形式可以暂不选择。'};
 const footer=step==='category'?undefined:<><Button variant="ghost" onClick={()=>{setStep(step==='canvas'?'interactive':'category');setError('');}}><ArrowLeft/>返回上一步</Button>{step==='canvas'&&<Button variant="primary" onClick={create}>创建作品<ArrowUpRight/></Button>}</>;
 return <><PresentationCreationDialog key={`presentation-${session}`} open={open&&step==='presentation'} onClose={close} onBack={()=>setStep('category')} keepDraftOnClose/><StoryCreationDialog key={`story-${session}`} open={open&&step==='story'} onClose={close} onBack={()=>setStep('category')} keepDraftOnClose/><Modal open={open&&!isStudio} onClose={close} title={titles[dialogStep]} description={descriptions[dialogStep]} wide={step!=='canvas'} footer={footer}>
  {step==='category'?<div className="project-creation-kinds">
   <button aria-label="交互页面" onClick={()=>setStep('interactive')}><span className="project-creation-icon"><MousePointer2 size={23}/></span><strong>交互页面</strong><p>制作可点击、浏览与探索的展示内容</p><span className="project-creation-hint">页面、组件与交互<ArrowUpRight size={16}/></span></button>
   <button aria-label="智能演示" onClick={()=>setStep('presentation')}><span className="project-creation-icon"><Presentation size={23}/></span><strong>智能演示</strong><p>把资料变成会演示、会讲解、能问答的动态幻灯片</p><span className="project-creation-hint">动态播放、自主讲解与智能问答<ArrowUpRight size={16}/></span></button>
   <button aria-label="互动影片" onClick={()=>setStep('story')}><span className="project-creation-icon"><Clapperboard size={23}/></span><strong>互动影片</strong><p>让观众参与选择，探索故事的不同结局</p><span className="project-creation-hint">场景、节点与分支<ArrowUpRight size={16}/></span></button>
  </div>:step==='interactive'?<div className="creation-options">
   <button onClick={()=>setStep('canvas')}><div className="blank-canvas-illustration"><div><FilePlus2 size={26}/><span>你的下一件作品</span></div></div><div className="creation-option-copy"><FilePlus2/><span><strong>从空白画布新建</strong><small>自由搭建内容、组件与交互</small></span><ArrowUpRight/></div></button>
   <button onClick={()=>enter('/community?tab=templates&category=interactive')}><Artwork type="timeline" styleId="industrial" title="企业发展大事记"/><div className="creation-option-copy"><LayoutTemplate/><span><strong>从模板新建</strong><small>按展示内容寻找合适的交互页面</small></span><ArrowUpRight/></div></button>
  </div>:<div className="form-stack">
   <Field label="作品名称"><input autoFocus value={title} onChange={event=>{setTitle(event.target.value);setError('');}} maxLength={60}/></Field>
   <ContentPurposePicker value={purposes} onChange={setPurposes}/>
   <Field label="展示形式"><select aria-label="展示形式" value={type} onChange={event=>setType(event.target.value as ExhibitType)}><option value="">无</option>{exhibitTypes.map(item=><option key={item}>{item}</option>)}</select></Field>
   <Field label="屏幕分辨率"><select aria-label="屏幕分辨率" value={resolution} onChange={event=>setResolution(event.target.value)}>{resolutions.map(item=><option key={`${item.width}×${item.height}`} value={`${item.width}×${item.height}`}>{item.width}×{item.height} · {item.label}</option>)}<option value="custom">自定义尺寸</option></select></Field>
   {resolution==='custom'&&<div className="form-grid"><Field label="宽度 px"><input type="number" value={width} onChange={event=>setWidth(+event.target.value)}/></Field><Field label="高度 px"><input type="number" value={height} onChange={event=>setHeight(+event.target.value)}/></Field></div>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <p className="field-help">创建后可继续编辑；投稿到共创社区时，展示内容和展示形式至少填写一项。</p>
  </div>}
 </Modal></>;
}
