import {useState} from 'react';
import {ClipboardCheck,Monitor,Palette} from 'lucide-react';
import {Button,Modal} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {deliveryChecks,reviewedDeliveryChecks} from '../../domain/production-stage';
import type {Work} from '../../domain/types';
import {SlideView,StudioImage} from '../studios/StudioShared';
import {applyProjectStyle,motionReviewItems,resizeProject} from './project-appearance-domain';
import './project-appearance.css';

type Props={work:Work;onChange:(work:Work)=>void;disabled?:boolean};
const sizes=[[1920,1080,'横屏'],[1080,1920,'竖屏'],[3840,1080,'超宽屏'],[3840,2160,'4K 横屏'],[1080,1080,'方屏']] as const;
export function ProjectAppearance({work,onChange,disabled}:Props){
 const systems=useStudio(s=>s.systems),[dialog,setDialog]=useState<'size'|'style'|null>(null);
 const [size,setSize]=useState([work.width,work.height]),[choice,setChoice]=useState(work.styleId),[reset,setReset]=useState(false),[index,setIndex]=useState(0);
 const prior=systems.find(s=>s.id===work.styleId),style=systems.find(s=>s.id===choice);
 const valid=size.every(v=>Number.isInteger(v)&&v>=320&&v<=16384);
 const preview=dialog==='size'&&valid?resizeProject(work,size[0],size[1]):dialog==='style'&&style?applyProjectStyle(work,style,prior,reset):work;
 const motionChecks=dialog==='size'&&valid?motionReviewItems(work,size[0],size[1]):[];
 const attention=dialog==='size'&&valid?preview.pages.flatMap(p=>p.nodes.filter(n=>!n.hidden&&(n.type==='html'||(n.type==='text'&&n.fontSize<14))).map(n=>p.name+' · '+n.name)):[];
 const open=(mode:'size'|'style')=>{setChoice(work.styleId);setReset(false);setSize([work.width,work.height]);setIndex(0);setDialog(mode)};
 const page=preview.pages[index],scene=preview.storyNodes?.[index],isStory=work.kind==='story';
 const pages=isStory?(work.storyNodes||[]).map(n=>n.title):work.pages.map(p=>p.name);
 const save=()=>{if(!valid||disabled)return;onChange(dialog==='style'&&!style?{...work,styleId:''}:preview);setDialog(null)};
 return <><Button size="sm" title="画面尺寸" aria-label="画面尺寸" disabled={disabled} onClick={()=>open('size')}><Monitor size={15}/><span className="editor-control-caption">{work.width} × {work.height}</span></Button>
 <Button size="sm" title="设计风格" aria-label="设计风格" className="editor-system-trigger" disabled={disabled} onClick={()=>open('style')}><Palette size={15}/><span className="editor-control-caption">{prior?.name||'设计风格'}</span></Button>
 <Modal wide open={!!dialog} title={dialog==='style'?'项目设计风格':'画面尺寸与适配预览'} onClose={()=>setDialog(null)} footer={<><Button onClick={()=>setDialog(null)}>取消</Button><Button variant="primary" disabled={!valid||disabled} onClick={save}>{dialog==='style'?'应用项目风格':'应用画面尺寸'}</Button></>}>
 <div className="project-appearance">
 {dialog==='style'?<><div className="project-style-list">{[{id:'',name:'自由风格',background:'#aaa',text:'#222'},...systems.filter(s=>s.id!=='none')].map(s=><button key={s.id} aria-pressed={choice===s.id} onClick={()=>setChoice(s.id)}><i style={{background:s.background,color:s.text}}>Aa</i>{s.name}</button>)}</div>{style&&<><p>{style.font} · {style.motion}</p><label><input type="checkbox" checked={reset} onChange={e=>setReset(e.target.checked)}/> 让局部自定义样式重新跟随项目风格</label></>}</>:<><div className="project-size-presets">{sizes.map(([w,h,label])=><Button key={label} size="sm" aria-pressed={size[0]===w&&size[1]===h} onClick={()=>setSize([w,h])}>{label}</Button>)}</div><div className="project-size-fields">{['宽度','高度'].map((label,i)=><label key={label}>{label} px<input type="number" min="320" max="16384" value={size[i]||''} onChange={e=>setSize(size.map((value,j)=>i===j?Number(e.target.value):value))}/></label>)}</div>{!valid&&<p role="alert">请输入 320 到 16384 之间的整数。</p>}</>}
 {pages.length>0&&<label>预览{isStory?'节点':'页面'} <select aria-label="选择适配预览页" value={index} onChange={e=>setIndex(Number(e.target.value))}>{pages.map((label,i)=><option key={i} value={i}>{i+1} · {label}</option>)}</select></label>}
 <div className="project-sizing-preview"><div style={{width:`min(100%, ${Math.round(300*preview.width/preview.height)}px)`,aspectRatio:preview.width/preview.height,background:style?.background,color:style?.text}}>{isStory&&scene?<div className="project-story-thumb">{scene.media&&<StudioImage src={scene.media} alt=""/>}<strong>{scene.title}</strong></div>:page?<SlideView work={preview} page={page}/>:null}</div></div>
 {motionChecks.length>0&&<details open><summary>横竖屏重排后需复查的动效（{motionChecks.length}）</summary><p>移动和尺寸关键帧已按新画幅换算。请在应用后回放以下动效，核对移动方向及镜头落点。</p><ul>{motionChecks.map((label,i)=><li key={i}>{label}</li>)}</ul></details>}
 {attention.length>0&&<details><summary>建议检查 {attention.length} 个对象</summary><p>预览以下文字的可读性和互动程序的画面比例。</p><ul>{attention.map((label,i)=><li key={i}>{label}</li>)}</ul></details>}
 <small>应用到整个项目 · {pages.length} {isStory?'个节点':'页'}</small>
 </div></Modal></>;
}
export function DeliveryReview({work,onChange,disabled}:Props){
 const [open,setOpen]=useState(false),[checks,setChecks]=useState<string[]>([]);
 return <><Button size="sm" title="交付检查" disabled={disabled} onClick={()=>{setChecks(reviewedDeliveryChecks(work));setOpen(true)}}><ClipboardCheck size={15}/>交付检查</Button>
 <Modal open={open} title="交付检查" onClose={()=>setOpen(false)} footer={<><Button onClick={()=>setOpen(false)}>取消</Button><Button variant="primary" onClick={()=>{onChange({...work,deliveryReview:{revision:work.revision+1,checks}});setOpen(false)}}>保存检查记录</Button></>}>
 <div className="delivery-checklist">{deliveryChecks(work).map(item=><label key={item.id}><input type="checkbox" checked={checks.includes(item.id)} onChange={e=>setChecks(e.target.checked?[...checks,item.id]:checks.filter(id=>id!==item.id))}/>{item.label}</label>)}</div></Modal></>;
}
