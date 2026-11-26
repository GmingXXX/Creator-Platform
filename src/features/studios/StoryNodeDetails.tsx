import {useState,type ReactNode,type DragEvent,type KeyboardEvent} from 'react';
import {Grid2X2,Layers,Maximize2,Minimize2,PanelLeftClose,PanelRightClose,Play,Volume2,VolumeX,PanelTop} from 'lucide-react';
import type {StoryEdge,StoryNode,Asset,Work} from '../../domain/types';
import type {StoryLayer} from '../../domain/story-canvas';
import {storyKind,storyKinds} from '../../domain/story-canvas';
import {copyStoryLayer,createStoryLayer,fitStoryLayer,reorderStoryLayer,storyLayerTitle,storyShowsCaption,storyTools,type StoryTool} from '../../domain/story-layer-editing';
import {Button,Modal,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {Field,StudioImage,StudioVideo} from './StudioShared';
import {storyMediaKind} from './creationLogic';
import {StoryHtml} from './StoryHtml';
import {MaterialPicker} from '../resources/MaterialPicker';
import {storyScenePaint} from './story-scene-paint';
import {StoryLayers} from './StoryLayers';
import {StoryRoutes} from './StoryRoutes';
import {StoryPreview} from './StoryPreview';
import {StoryNodeLibrary} from './StoryNodeLibrary';
import {StoryFieldGroup,StoryLayerInspector} from './StoryLayerInspector';
import {StoryPhotoFrame,StoryPhotoSettings} from './StoryPhoto';
import '../../styles/story-node-detail.css';

type Props={node:StoryNode;nodes:StoryNode[];edges:StoryEdge[];workspaceId:string;workTitle:string;width:number;height:number;styleId?:string;projectMusic?:Work['storyMusic'];renderSceneSettings?:(draft:StoryNode,onChange:(patch:Partial<StoryNode>)=>void)=>ReactNode;onClose:()=>void;onApply:(n:StoryNode,e:StoryEdge[])=>void};
type Point={x:number;y:number};
type Picker={target:'background'|'new'|'replace';kinds:('image'|'video'|'html')[];point?:Point;layerId?:string};
let clipboard:{workspaceId:string;data:StoryLayer}|undefined;

export function StoryNodeDetails({node,nodes,edges,workspaceId,workTitle,width,height,styleId,projectMusic,renderSceneSettings,onClose,onApply}:Props){
 const [draft,setDraft]=useState(node),[choices,setChoices]=useState(edges.filter(e=>e.source===node.id));
 const [maximized,setMaximized]=useState(false),[snap,setSnap]=useState(false),[audition,setAudition]=useState(false);
 const [hasClipboard,setHasClipboard]=useState(clipboard?.workspaceId===workspaceId);
 const [left,setLeft]=useState(()=>window.innerWidth>760),[right,setRight]=useState(true),[selected,setSelected]=useState(''),[inline,setInline]=useState(''),[picker,setPicker]=useState<Picker>(),[preview,setPreview]=useState(false);
 const [inspector,setInspector]=useState<'属性'|'事件'>('属性');
 const style=useStudio(s=>s.systems.find(system=>system.id===styleId));
 const assets=useStudio(s=>s.assets),layers=draft.layers||[],layer=layers.find(l=>l.id===selected);
 const update=(patch:Partial<StoryNode>)=>setDraft(d=>({...d,...patch}));
 const patch=(id:string,v:Partial<StoryLayer>)=>setDraft(d=>({...d,layers:d.layers?.map(l=>l.id===id?{...l,...v}:l)}));
 const select=(id:string)=>{setSelected(id);setRight(true);setInline('');setInspector('属性');};
 const append=(items:StoryLayer[],point?:Point)=>{
  const list=items.map(l=>point?{...l,...fitStoryLayer({...l,...point},snap)}:l);
  setDraft(d=>({...d,layers:[...d.layers||[],...list]}));select(list[list.length-1].id);
 };
 const add=(kind:StoryTool,point?:Point)=>{
  if(kind==='image'||kind==='video'||kind==='html'){setPicker({target:'new',kinds:[kind],point});return;}
  append([createStoryLayer(kind)],point);
 };
 const template=()=>append([{...createStoryLayer('mask'),name:'字幕底色',y:74,height:20},{...createStoryLayer('text'),name:'字幕',x:8,y:78,width:84,height:12,text:'输入字幕内容'}]);
 const replace=(l:StoryLayer)=>setPicker({target:'replace',layerId:l.id,kinds:[l.kind as 'image'|'video'|'html']});
 const background=()=>setPicker({target:'background',kinds:['image','video','html']});
 const selectAsset=(a:Asset)=>{
  if(!picker)return;
  if(picker.target==='background')update({media:a.src,mediaAssetId:a.id});
  else if(picker.target==='new')append([createStoryLayer(a.kind as StoryTool,a)],picker.point);
  else if(picker.layerId)patch(picker.layerId,{src:a.src,assetId:a.id});
 };
 const edit=(id:string)=>{const l=layers.find(item=>item.id===id);if(!l||l.locked)return;select(id);if(l.variant)return;if(l.kind==='text'||l.kind==='button')setInline(id);else replace(l);};
 const remove=()=>{if(!layer||layer.locked)return;setChoices(es=>es.filter(e=>e.layerId!==layer.id).map(e=>({...e,effects:e.effects?.filter(f=>f.layerId!==layer.id)})));update({layers:layers.filter(l=>l.id!==layer.id)});select('');};
 const copy=()=>{if(!layer)return;clipboard={workspaceId,data:{...layer}};setHasClipboard(true);toast('已复制控件，可在本节点或其他节点粘贴');};
 const paste=()=>{if(clipboard?.workspaceId===workspaceId)append([copyStoryLayer(clipboard.data)]);};
 const keys=(e:KeyboardEvent<HTMLDivElement>)=>{
  if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='c'&&layer){e.preventDefault();copy();}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='v'&&clipboard?.workspaceId===workspaceId){e.preventDefault();paste();}
  if((e.key==='Delete'||e.key==='Backspace')&&layer){e.preventDefault();remove();}
 };
 const close=()=>{const changed=JSON.stringify(draft)!==JSON.stringify(node)||JSON.stringify(choices)!==JSON.stringify(edges.filter(e=>e.source===node.id));if(!changed||window.confirm('放弃本次节点编辑并返回流程？'))onClose();};
 const drop=(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();const tool=e.dataTransfer.getData('application/x-story-tool');if(!Object.hasOwn(storyTools,tool))return;const r=e.currentTarget.getBoundingClientRect();add(tool as StoryTool,{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100});};
 const media=storyMediaKind(draft,assets),focused=choices.filter(e=>e.layerId===layer?.id||e.effects?.some(f=>f.layerId===layer?.id));
 const previewNodes=[draft,...nodes.filter(n=>n.id!==draft.id&&n.type!=='start')];
 return <><Modal open={!picker&&!preview} onClose={close} title={workTitle+' / '+draft.title} wide footer={<><Button onClick={close}>取消</Button><Button disabled={!draft.title.trim()} variant="primary" onClick={()=>{onApply({...draft,title:draft.title.trim()},choices);onClose();}}>完成并返回流程</Button></>}>
  <div className="story-node-editor story-detail" data-maximized={maximized} onKeyDown={keys} tabIndex={-1}>
   <div className="story-detail-toolbar"><button title={left?'收起组件栏':'展开组件栏'} aria-label={left?'收起组件栏':'展开组件栏'} aria-pressed={left} onClick={()=>setLeft(!left)}><PanelLeftClose size={16}/></button><span>{storyKinds[storyKind(draft.type)]}</span><i/>
    <button aria-pressed={snap} onClick={()=>setSnap(!snap)}><Grid2X2 size={15}/>网格吸附</button><button aria-pressed={audition} onClick={()=>setAudition(!audition)}>{audition?<Volume2 size={15}/>:<VolumeX size={15}/>}编辑时试听</button>
    <div className="story-detail-toolbar-end"><button onClick={()=>setPreview(true)}><Play size={14}/>预览本节点</button><button title={maximized?'还原窗口':'最大化'} aria-label={maximized?'还原窗口':'最大化'} onClick={()=>setMaximized(!maximized)}>{maximized?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button title={right?'收起属性':'展开属性'} aria-label={right?'收起属性':'展开属性'} aria-pressed={right} onClick={()=>setRight(!right)}><PanelRightClose size={16}/></button></div>
   </div>
   <div className="story-detail-workspace">
    {left&&<StoryNodeLibrary layers={layers} selected={selected} onSelect={select} onAdd={add} onTemplate={template} onPatch={patch} onOrder={(id,step)=>update({layers:reorderStoryLayer(layers,id,step)})} onBackground={background}/>}
    <main className="story-detail-canvas" onPointerDown={e=>{if(e.target===e.currentTarget)select('');}}><div className="story-stage-label"><PanelTop size={13}/>{draft.title}<span>{width} × {height}</span></div>
     <div className={'story-node-stage'+(snap?' has-grid':'')} aria-label="节点画布" style={{...storyScenePaint(style,!!draft.media,storyShowsCaption(draft)),aspectRatio:width+'/'+height,width:'min(100cqw, calc(100cqh * '+(width/height)+'))'}} onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-story-tool'))e.preventDefault();}} onDrop={drop}
     onPointerDown={e=>{if(e.target===e.currentTarget)select('');}} onDoubleClick={e=>{if(e.target===e.currentTarget)background();}}>
      {draft.media&&<div className="story-stage-back" onClick={()=>select('')} onDoubleClick={background}>{media==='html'?<StoryHtml src={draft.media} title={draft.title}/>:media==='video'?<StudioVideo src={draft.media} playing={audition} muted={!audition} volume={draft.sound?.videoVolume??.5}/>:<StudioImage src={draft.media} alt="场景主画面"/>}</div>}
      {storyShowsCaption(draft)&&<div className="story-stage-caption">{(['title','text'] as const).map(key=>inline===key?<textarea autoFocus aria-label="编辑画面文案" key={key} value={draft[key]} onChange={e=>update({[key]:e.target.value})} onBlur={()=>setInline('')}/>:<div className={key} key={key} onDoubleClick={()=>{select('');setInline(key);}}>{draft[key]}</div>)}</div>}
      {draft.type==='photo'&&<StoryPhotoFrame value={draft.photo}/>}
      <StoryLayers layers={layers} selected={selected} editing snap={snap} audition={audition} onSelect={select} onBounds={patch} onEdit={edit}/>
      {inline&&layer&&inline===layer.id&&<textarea autoFocus aria-label="画布文字内容" className="story-inline-input" style={{left:layer.x+'%',top:layer.y+'%',width:layer.width+'%',height:layer.height+'%',fontSize:(layer.size||3)+'cqw'}} value={layer.text} onChange={e=>patch(layer.id,{text:e.target.value})} onBlur={()=>setInline('')}/>}
     </div>
    </main>
    {right&&<aside className="story-detail-inspector">
     <div className="story-inspector-heading">{layer?<Layers size={16}/>:<PanelTop size={16}/>}<div><small>{layer?storyLayerTitle(layer):'节点'}</small><h3>{layer?.name||draft.title}</h3></div></div>
     <nav className="story-node-tabs">{(['属性','事件'] as const).map(t=><button key={t} aria-pressed={inspector===t} onClick={()=>setInspector(t)}>{t}{t==='事件'&&<small>{layer?focused.length:choices.length}</small>}</button>)}</nav>
     {inspector==='事件'?<StoryRoutes node={draft} nodes={nodes} focusedLayerId={layer?.id} edges={layer?focused:choices} assets={assets} onChange={updated=>setChoices(items=>layer?[...items.filter(e=>!focused.some(f=>f.id===e.id)),...updated]:updated)}/>:
      layer?<StoryLayerInspector canvasWidth={width} key={layer.id} layer={layer} onPatch={v=>patch(layer.id,v)} onReplace={()=>replace(layer)} onCopy={copy} onDelete={remove}/>:
      <><StoryFieldGroup title="节点信息"><Field label="节点名称"><input maxLength={80} value={draft.title} onChange={e=>update({title:e.target.value})}/></Field><Field label="节点简介"><textarea value={draft.text} onChange={e=>update({text:e.target.value})}/></Field>
       <label><input type="checkbox" checked={storyShowsCaption(draft)} onChange={e=>update({showCaption:e.target.checked})}/> 在画面显示标题与简介</label></StoryFieldGroup>
       {draft.type==='photo'&&<StoryPhotoSettings workspaceId={workspaceId} value={draft.photo} onChange={photo=>update({photo})}/>}
       {renderSceneSettings?.(draft,update)}</>}
     {hasClipboard&&inspector==='属性'&&<Button size="sm" onClick={paste}>粘贴控件</Button>}
    </aside>}
   </div>
  </div></Modal>
  <MaterialPicker open={!!picker} onClose={()=>setPicker(undefined)} workspaceId={workspaceId} kinds={picker?.kinds||['image','video','html']} title="选择节点素材" onSelect={selectAsset}/>
  {preview&&<StoryPreview styleId={styleId} projectMusic={projectMusic} nodes={previewNodes} edges={[...edges.filter(e=>e.source!==draft.id),...choices]} title={draft.title} width={width} height={height} onClose={()=>setPreview(false)}/>}
 </>;
}
