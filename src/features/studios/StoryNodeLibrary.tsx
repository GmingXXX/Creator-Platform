import {useState} from 'react';
import {Type,MousePointer2,Image,Film,Code2,QrCode,Square,Camera,ScanFace,Video,Layers,Eye,EyeOff,LockKeyhole,LockKeyholeOpen,ChevronUp,ChevronDown,PanelTop,Upload,LayoutTemplate} from 'lucide-react';
import type {StoryLayer} from '../../domain/story-canvas';
import {storyTools,type StoryTool} from '../../domain/story-layer-editing';
import {Button} from '../../components/ui';

const icons={text:Type,button:MousePointer2,mask:Square,qr:QrCode,image:Image,video:Film,html:Code2,photo:Camera,faceImage:ScanFace,faceVideo:Video};
const groups:{name:string;list:StoryTool[]}[]=[{name:'画面控件',list:['text','button','qr','mask']},{name:'媒体',list:['image','video','html']},{name:'体验结果',list:['photo','faceImage','faceVideo']}];
interface Props{
 layers:StoryLayer[];selected:string;onSelect:(id:string)=>void;onAdd:(tool:StoryTool)=>void;onTemplate:()=>void;
 onPatch:(id:string,patch:Partial<StoryLayer>)=>void;onOrder:(id:string,step:number)=>void;onBackground:()=>void;
}
export function StoryNodeLibrary({layers,selected,onSelect,onAdd,onPatch,onOrder,onBackground,onTemplate}:Props){
 const [tab,setTab]=useState('组件');
 return <aside className="story-node-library-pane" aria-label="节点创作资源">
  <nav className="story-node-tabs">{['组件','素材','图层'].map(t=><button type="button" key={t} aria-pressed={t===tab} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  {tab==='组件'?<div className="story-node-library-groups">{groups.map(({name,list})=><section key={name}><h3>{name}</h3><div className="story-node-palette">{list.map(tool=>{const Icon=icons[tool];return <button key={tool} aria-label={'添加'+storyTools[tool]} draggable onDragStart={e=>{e.dataTransfer.setData('application/x-story-tool',tool);e.dataTransfer.effectAllowed='copy';}} onClick={()=>onAdd(tool)}><Icon size={18}/><span>{storyTools[tool]}</span></button>})}</div></section>)}
   <section><h3>组件模板</h3><Button onClick={onTemplate}><LayoutTemplate size={16}/>字幕条</Button></section></div>:
   tab==='素材'?<div className="story-node-library-groups"><section><h3>场景主画面</h3><Button onClick={onBackground}><PanelTop size={15}/>选择或上传背景</Button></section><section><h3>叠加素材</h3>{(['image','video','html'] as const).map(kind=><Button key={kind} onClick={()=>onAdd(kind)}><Upload size={14}/>{storyTools[kind]}</Button>)}</section></div>:
   <div className="story-node-library-groups"><section><h3>图层顺序</h3><div className="story-node-layer-list">
    {[...layers].reverse().map((l,i)=><div key={l.id} className={'story-layer-row '+(selected===l.id?'active':'')}>
     <button className="story-layer-name" title={l.name} onClick={()=>onSelect(l.id)}><Layers size={13}/><span>{l.name}</span></button>
     <button aria-label={(l.hidden?'显示':'隐藏')+l.name} title={l.hidden?'显示':'隐藏'} onClick={()=>onPatch(l.id,{hidden:!l.hidden})}>{l.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button>
     <button aria-label={(l.locked?'解锁':'锁定')+l.name} title={l.locked?'解锁':'锁定'} onClick={()=>onPatch(l.id,{locked:!l.locked})}>{l.locked?<LockKeyhole size={13}/>:<LockKeyholeOpen size={13}/>}</button>
     {selected===l.id&&<div className="story-layer-order"><button disabled={l.locked||i===0} onClick={()=>onOrder(l.id,1)}><ChevronUp size={12}/>上移</button><button disabled={l.locked||i===layers.length-1} onClick={()=>onOrder(l.id,-1)}><ChevronDown size={12}/>下移</button></div>}
    </div>)}
    <button className="story-background-row" aria-pressed={!selected} onClick={()=>onSelect('')}><PanelTop size={14}/>场景主画面</button>
   </div></section></div>}
 </aside>;
}
