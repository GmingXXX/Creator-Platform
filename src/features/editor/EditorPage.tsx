import {WorkStageControl} from '../creation/ProductionStageControl';
import {FullscreenButton,usePreviewFullscreen} from '../../components/PreviewFullscreen';
import {resolveFontFamily} from '../../domain/text-style';
import {editorShortcutBlocked,editorTextInput} from './editor-keyboard';
import {syncCreativeHistory} from '../../domain/work-creative-metadata';
import {FloatingWorkAgent} from './FloatingWorkAgent';
import {EditorAssistant} from './EditorAssistant';
import {currentEditorReturn} from '../workspace/editor-return';
import {navigateInWorkspace} from '../workspace/output-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignStartVertical, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Download, Eye, EyeOff, FileImage, FolderOpen, Grid2X2, Image, Layers, Lock, MoreHorizontal, MousePointer2, Palette, Play, Plus, Redo2, Save, Search, Send, Square, Trash2, Type, Undo2, Unlock, Video, X } from 'lucide-react';
import type { Asset, AssetKind, DesignSystem, NodeKind, SceneNode, Work } from '../../domain/types';
import { useStudio } from '../../domain/store';
import {assetAvailableForInsertion} from '../../domain/asset-access';
import {readEditorView,writeEditorView,sameWorkContent} from './editor-session';
import { exportWork } from '../../domain/export';
import { Badge, Button, downloadBlob, Logo, Menu, Modal, Popover, toast, useDocumentTitle } from '../../components/ui';
import { CanvasStage } from './CanvasStage';
import { Inspector } from './Inspector';
import {SubmissionDialog} from '../resources/Shared';
import {MaterialPicker} from '../resources/MaterialPicker';
import {EditorMaterialsPanel} from './EditorMaterialsPanel';
import {insertMaterial,replaceNodeMaterial,materialNodeKind} from './editor-materials';
import { SceneRenderer } from './SceneRenderer';
import { alignPageSelection, cloneSelectedNodes, createHistory, createNode, isMediaContainer, nodeLabels, pushHistory, redoHistory, uid, undoHistory, updatePageNodes } from './editor-domain';
import '../../styles/editor.css';
import './editor-operations.css';
import {deletePageSelection,reorderPageLayer} from './editor-operations';

export default function EditorPage(){
 const {id}=useParams<{id:string}>();const initial=useStudio(s=>s.works.find(w=>w.id===id&&!w.deletedAt));const navigate=useNavigate();
 if(!initial)return <div className="editor-not-found"><FolderOpen size={40}/><h2>未找到这个展项</h2><p>它可能已被移除，或尚未保存。</p><Button onClick={()=>navigate('/projects')}>返回作品</Button></div>;
 return <WorkEditor key={initial.id} initial={initial}/>;
}

function WorkEditor({initial}:{initial:Work}){
 const navigate=useNavigate();const saveWork=useStudio(s=>s.saveWork);const systems=useStudio(s=>s.systems);
 const [view]=useState(()=>readEditorView(initial));
 const [history,setHistory]=useState(()=>createHistory(initial));const work=history.present;
 const [pageId,setPageId]=useState(view?.pageId||initial.pages[0].id);const [selected,setSelected]=useState<string[]>(view?.selected||[]);const [zoom,setZoom]=useState(view?.zoom||.4);const [pan,setPan]=useState(view?.pan||{x:0,y:0});const [inspectorTab,setInspectorTab]=useState(view?.tab==='AI'?'属性':view?.tab||'属性');const [fitSignal,setFitSignal]=useState(0);
 const [leftWidth,setLeftWidth]=useState(264);const [rightWidth,setRightWidth]=useState(300);const [leftOpen,setLeftOpen]=useState(true);const [rightOpen,setRightOpen]=useState(true);
 const [expandedItems,setExpandedItems]=useState(false);const [saved,setSaved]=useState(true);const [saveError,setSaveError]=useState('');const saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const [preview,setPreview]=useState(false);const [testCommand,setTestCommand]=useState('');const [share,setShare]=useState(false);
 const [exportOpen,setExportOpen]=useState(false);const [exporting,setExporting]=useState(false);const [exportProgress,setExportProgress]=useState({percent:0,label:''});const [exportError,setExportError]=useState('');const abortExport=useRef<AbortController|null>(null);
 const [materialInsert,setMaterialInsert]=useState<{pageId:string;kinds?:AssetKind[];targetId?:string;point?:{x:number;y:number}}|null>(null);
 const [renamePage,setRenamePage]=useState<string|null>(null);const [pageName,setPageName]=useState('');const clipboard=useRef<SceneNode[]>([]);
 const page=work.pages.find(p=>p.id===pageId)||work.pages[0];const node=page.nodes.find(n=>n.id===selected[0]);
 useDocumentTitle(work.title);
 const commit=useCallback((next:Work)=>{setHistory(h=>pushHistory(h,next))},[]);
 const patchNode=useCallback((patch:Partial<SceneNode>)=>commit(updatePageNodes(work,page.id,selected.filter(id=>!page.nodes.find(n=>n.id===id)?.locked),patch)),[work,page.id,selected,commit]);
 useEffect(()=>{if(!work.pages.some(p=>p.id===pageId)){setPageId(work.pages[0].id);setSelected([])}},[work.pages,pageId]);
 useEffect(()=>{setSelected(ids=>ids.filter(id=>page.nodes.some(n=>n.id===id)))},[page.id,page.nodes]);
 useEffect(()=>{writeEditorView(work.id,{pageId,selected,zoom,pan,tab:inspectorTab})},[work.id,pageId,selected,zoom,pan,inspectorTab]);
 const syncSavedMetadata=(snapshot:Work)=>setHistory(h=>sameWorkContent(h.present,snapshot)?{...h,present:{...h.present,revision:snapshot.revision,updatedAt:snapshot.updatedAt}}:h);
 const saveSnapshot=()=>{
  if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
  const stored=useStudio.getState().works.find(w=>w.id===work.id);
  if(!stored||!sameWorkContent(work,stored))saveWork(work);
  const snapshot=structuredClone(useStudio.getState().works.find(w=>w.id===work.id)!);
  if(snapshot.deletedAt)throw new Error('作品已在回收站，请恢复后继续编辑。');
  setSaved(true);setSaveError('');
  if(snapshot.revision!==work.revision)syncSavedMetadata(snapshot);
  return snapshot;
 };
 useEffect(()=>{
  const stored=useStudio.getState().works.find(item=>item.id===work.id);
  if(stored&&sameWorkContent(work,stored)){setSaved(true);return;}
  setSaved(false);saveTimer.current=setTimeout(()=>{try{saveSnapshot()}catch(error){setSaveError(error instanceof Error?error.message:'自动保存失败')}},650);
  return()=>{if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}};
 },[work,saveWork]);
 const applyConversation=(next:Work)=>{
  if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
  setHistory(h=>syncCreativeHistory(h,next));setSaved(true);setSaveError('');
 };
 const goBack=()=>{try{saveSnapshot();navigateInWorkspace(navigate,work.workspaceId,currentEditorReturn(work.id,'/projects?category=interactive'))}catch(error){toast(error instanceof Error?error.message:'保存失败，请重试',true)}};
 const goHome=()=>{try{saveSnapshot();navigate('/')}catch(error){toast(error instanceof Error?error.message:'保存失败，请重试',true)}};
 function useMaterial(asset:Asset,point?:{x:number;y:number},targetId?:string,targetPageId=page.id){
  const currentPage=work.pages.find(item=>item.id===targetPageId);
  const target=currentPage?.nodes.find(item=>item.id===targetId);
  if(targetId&&(!target||target.locked||target.type!==asset.kind)){toast('无法替换此组件，请选择未锁定的同类型组件',true);return;}
  const adopted=useStudio.getState().adoptAsset(asset.id,work.workspaceId||'personal');
  if(!adopted){toast('该素材暂不可用，请重新选择',true);return;}
  const next=targetId?replaceNodeMaterial(work,targetPageId,targetId,adopted):insertMaterial(work,targetPageId,adopted,point);
  if(next===work){toast('此素材不支持插入当前画布',true);return;}
  commit(next);setSelected(targetId?[targetId]:[next.pages.find(item=>item.id===targetPageId)!.nodes.at(-1)!.id]);
  toast(target?.src?'素材已替换，保留原有布局和交互':target?'素材已添加到容器':'素材已添加到画布');
 }
 function addComponent(type:NodeKind,point?:{x:number;y:number}){
  if(!Object.hasOwn(nodeLabels,type))return;
  if(type==='html'){setMaterialInsert({pageId:page.id,kinds:[type],point});return;}
  const created=createNode(type,point?.x??Math.round(work.width*.12),point?.y??Math.round(work.height*.16));
  const width=Math.min(created.w,work.width*.76),height=Math.min(created.h,work.height*.65);
  const node=isMediaContainer(type)
   ?{...created,w:width,h:height,x:Math.min(created.x,work.width-width),y:Math.min(created.y,work.height-height)}
   :{...created,w:width,h:height};
  commit({...work,pages:work.pages.map(item=>item.id===page.id?{...item,nodes:[...item.nodes,node]}:item)});setSelected([node.id]);
 }
 const persist=()=>{try{saveSnapshot();toast('展项已保存')}catch(error){const message=error instanceof Error?error.message:'保存失败';setSaveError(message);toast(message,true)}};
 const removeSelected=()=>{const next=deletePageSelection(work,page.id,selected);if(next!==work)commit(next);setSelected(ids=>ids.filter(id=>next.pages.find(p=>p.id===page.id)?.nodes.some(n=>n.id===id)))};
 const duplicateSelected=()=>{const nodes=cloneSelectedNodes(page.nodes,selected);if(!nodes.length)return;commit({...work,pages:work.pages.map(p=>p.id===page.id?{...p,nodes:[...p.nodes,...nodes]}:p)});setSelected(nodes.map(n=>n.id))};
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.defaultPrevented||editorShortcutBlocked(e.target))return;const input=editorTextInput(e.target);if(e.key==='Escape'){if(document.fullscreenElement)return;setPreview(false);setSelected([]);return}if(input||preview)return;const mod=e.metaKey||e.ctrlKey;
   if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();persist()}
   else if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();setHistory(e.shiftKey?redoHistory:undoHistory)}
   else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();setHistory(redoHistory)}
   else if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();setSelected(page.nodes.filter(n=>!n.locked&&!n.hidden).map(n=>n.id))}
   else if(mod&&e.key.toLowerCase()==='c'){e.preventDefault();clipboard.current=structuredClone(page.nodes.filter(n=>selected.includes(n.id)));toast('已复制组件')}
   else if(mod&&e.key.toLowerCase()==='v'&&clipboard.current.length){e.preventDefault();const nodes=cloneSelectedNodes(clipboard.current,clipboard.current.map(n=>n.id));commit({...work,pages:work.pages.map(p=>p.id===page.id?{...p,nodes:[...p.nodes,...nodes]}:p)});setSelected(nodes.map(n=>n.id))}
   else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected()}
   else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected()}
   else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?10:1;commit(updatePageNodes(work,page.id,selected,n=>n.locked?n:{...n,x:n.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:n.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)}))}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[work,page,selected,preview]);
 function applyStyle(system:DesignSystem){commit({...work,styleId:system.id,pages:work.pages.map(p=>({...p,background:system.background,backgroundImage:`/media/${system.id}.svg`,backgroundAssetId:undefined,nodes:p.nodes.map(n=>({...n,color:system.text,fontFamily:resolveFontFamily(system.font),background:n.type==='text'?'transparent':n.type==='button'?system.accent:n.background}))}))});toast(`已应用「${system.name}」，可撤销恢复`)}
 const alignmentTargets=page.nodes.filter(item=>selected.includes(item.id)&&!item.locked);
 const alignmentBasis=alignmentTargets.length>1?'所选组件':'画布';
 const alignmentHint=(label:string)=>alignmentTargets.length?`${label} · 相对${alignmentBasis}`:selected.length?'所选组件已锁定，请先解锁':'请先选择组件';
 function align(direction:'left'|'center'|'top'){commit(alignPageSelection(work,page.id,selected,direction))}
 function addPage(){const id=uid();commit({...work,pages:[...work.pages,{id,name:`页面 ${work.pages.length+1}`,background:page.background,nodes:[]}]});setPageId(id);setSelected([])}
 function duplicatePage(){const id=uid();const nodes=cloneSelectedNodes(page.nodes,page.nodes.map(n=>n.id),{[page.id]:id}).map(n=>({...n,x:n.x-24,y:n.y-24,name:n.name.replace(/ 副本$/,'')}));commit({...work,pages:[...work.pages,{...structuredClone(page),id,name:page.name+' 副本',nodes}]});setPageId(id);setSelected([])}
 function resizePanel(e:React.PointerEvent,side:'left'|'right'){e.preventDefault();const start=e.clientX;const width=side==='left'?leftWidth:rightWidth;const move=(ev:PointerEvent)=>{const n=Math.max(220,Math.min(420,width+(ev.clientX-start)*(side==='left'?1:-1)));side==='left'?setLeftWidth(n):setRightWidth(n)};const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)}
 function openPreview(command=''){setTestCommand(command);setPreview(true)}
 async function runExport(){
  if(abortExport.current)return;
  setExportOpen(true);setExporting(true);setExportError('');setExportProgress({percent:0,label:'保存当前版本'});
  const controller=new AbortController();abortExport.current=controller;
  try{const snapshot=saveSnapshot();const result=await exportWork(snapshot,'browser',{signal:controller.signal,onProgress:(percent,label)=>setExportProgress({percent,label})});downloadBlob(result.blob,result.filename);setExportOpen(false);toast('管理平台运行包已导出')}
  catch(error){setExportError(controller.signal.aborted?'已取消导出，可重新打包。':error instanceof Error?error.message:'导出失败，请重试')}
  finally{setExporting(false);abortExport.current=null}
 }
 return <div className="editor-app">
  <header className="editor-toolbar"><Button variant="ghost" size="icon" title="返回工作台" onClick={goBack}><ArrowLeft size={18}/></Button><button className="editor-home-logo" aria-label="智创首页" title="返回首页" onClick={goHome}><Logo small/></button><span className="editor-toolbar-divider"/><div className="editor-document"><input aria-label="展项名称" value={work.title} onChange={e=>commit({...work,title:e.target.value})}/><span><i className={saved?'saved':''}/>{saveError?'保存失败 · '+saveError:saved?'所有更改已保存':'正在保存…'}</span></div><div className="editor-toolbar-spacer"/><WorkStageControl work={work} onChange={commit}/><Button variant="ghost" size="icon" title="撤销（⌘Z）" disabled={!history.past.length} onClick={()=>setHistory(undoHistory)}><Undo2 size={17}/></Button><Button variant="ghost" size="icon" title="重做（⌘⇧Z）" disabled={!history.future.length} onClick={()=>setHistory(redoHistory)}><Redo2 size={17}/></Button><span className="editor-toolbar-divider"/><Button variant="secondary" size="sm" onClick={()=>openPreview()}><Play size={14}/>运行预览</Button><Button variant="ghost" size="sm" onClick={persist}><Save size={15}/>保存</Button><Button variant="secondary" size="sm" onClick={()=>{try{saveSnapshot();setShare(true)}catch(error){toast(error instanceof Error?error.message:'保存失败，请重试',true)}}}><Send size={14}/>分享投稿</Button><Button variant="primary" size="sm" disabled={exporting} onClick={runExport}><Download size={14}/>{exporting?'正在打包…':'导出管理平台运行包'}</Button></header>
  <div className="editor-contextbar"><div><span className="editor-context-label">{selected.length?`${selected.length} 个组件已选中`:'画布'}</span><span className="editor-context-resolution">{work.width} × {work.height}</span></div><div className="selection-actions"><button aria-label="左对齐" title={alignmentHint('左对齐')} disabled={!alignmentTargets.length} onClick={()=>align('left')}><AlignLeft size={16}/></button><button aria-label="水平居中" title={alignmentHint('水平居中')} disabled={!alignmentTargets.length} onClick={()=>align('center')}><AlignCenter size={16}/></button><button aria-label="顶对齐" title={alignmentHint('顶对齐')} disabled={!alignmentTargets.length} onClick={()=>align('top')}><AlignStartVertical size={16}/></button><i/><button title="复制组件（⌘D）" disabled={!selected.length} onClick={duplicateSelected}><Copy size={15}/></button><button title="锁定所选组件" disabled={!selected.length} onClick={()=>commit(updatePageNodes(work,page.id,selected,{locked:!node?.locked}))}>{node?.locked?<Unlock size={15}/>:<Lock size={15}/>}</button><button title="删除所选组件" disabled={!selected.length} onClick={removeSelected}><Trash2 size={15}/></button></div><div><FloatingWorkAgent work={work} pageId={page.id} nodeId={selected.length===1?node?.id:undefined}><EditorAssistant work={work} pageId={page.id} node={node} selectedIds={selected} patchNode={patchNode} changeWork={commit} onBeforeApply={saveSnapshot} onApplied={applyConversation}/></FloatingWorkAgent><Popover align="end" trigger={<button className="editor-system-trigger"><Palette size={14}/>{systems.find(s=>s.id===work.styleId)?.name||'设计风格'}<ChevronDown size={12}/></button>}><div className="editor-system-menu"><button data-popover-close onClick={()=>{commit({...work,styleId:''});toast('已解除设计风格约束，保留当前画面')}}><div><b>无</b></div>{!work.styleId&&<Check size={15}/>}</button>{systems.map(s=><button data-popover-close key={s.id} onClick={()=>applyStyle(s)}><span style={{background:s.background}}>{s.colors.slice(0,3).map(c=><i key={c} style={{background:c}}/>)}</span><div><b>{s.name}</b><small>{s.subtitle}</small></div>{s.id===work.styleId&&<Check size={15}/>}</button>)}</div></Popover></div></div>
  <div className="editor-main"><div className="editor-left" style={{width:leftWidth,display:leftOpen?undefined:'none'}}><ComponentPanel work={work} pageId={page.id} selected={selected} select={setSelected} commit={commit} onCollapse={()=>setLeftOpen(false)} onAddComponent={addComponent} onUseMaterial={asset=>useMaterial(asset)} onBrowseMaterials={()=>setMaterialInsert({pageId:page.id})}/></div>{leftOpen&&<div className="panel-resize" onPointerDown={e=>resizePanel(e,'left')}/>}{!leftOpen&&<div className="editor-panel-rail"><button title="展开组件面板" aria-label="展开组件面板" onClick={()=>setLeftOpen(true)}><ChevronsRight size={17}/></button></div>}<main className="editor-canvas-main"><CanvasStage work={work} pageId={page.id} selected={selected} onSelect={setSelected} onCommit={commit} onDoubleClick={node=>{
    if(isMediaContainer(node.type)&&!node.src&&!node.locked){
     setMaterialInsert({pageId:page.id,targetId:node.id,kinds:[node.type]});
     return;
    }
    setExpandedItems(true);setRightOpen(true)
   }} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} restoreView={Boolean(view)} fitSignal={fitSignal} onAddComponent={addComponent} onDropMaterial={(assetId,point,targetId)=>{const asset=useStudio.getState().assets.find(item=>item.id===assetId);if(asset)useMaterial(asset,point,targetId)}}/><footer className="editor-pagebar"><Button variant="ghost" size="icon" title="添加页面" onClick={addPage}><Plus size={17}/></Button><div className="page-tabs">{work.pages.map((p,i)=><button key={p.id} className={p.id===page.id?'active':''} onClick={()=>{setPageId(p.id);setSelected([])}} onDoubleClick={()=>{setRenamePage(p.id);setPageName(p.name)}}><span>{String(i+1).padStart(2,'0')}</span>{p.name}{p.id===page.id&&<i/>}</button>)}</div><Menu trigger={<Button size="icon" variant="ghost" title="页面操作"><MoreHorizontal size={17}/></Button>} items={[{label:'重命名页面',onClick:()=>{setRenamePage(page.id);setPageName(page.name)}},{label:'复制当前页面',icon:<Copy size={14}/>,onClick:duplicatePage},{label:'删除当前页面',icon:<Trash2 size={14}/>,danger:true,disabled:work.pages.length===1,onClick:()=>{commit({...work,pages:work.pages.filter(p=>p.id!==page.id)});setSelected([])}}]}/><button className="page-fit" title="重新适应画布" onClick={()=>setFitSignal(n=>n+1)}><MousePointer2 size={13}/><span>适应画布</span></button></footer></main>{rightOpen&&<><div className="panel-resize" onPointerDown={e=>resizePanel(e,'right')}/><div className="editor-right" style={{width:rightWidth}}><Inspector work={work} pageId={page.id} node={node} selectedIds={selected} patchNode={patchNode} changeWork={commit} onPreview={openPreview} onApplyStyle={applyStyle} expandedItems={expandedItems} setExpandedItems={setExpandedItems} tab={inspectorTab} onTabChange={setInspectorTab} onBeforeApply={saveSnapshot} onApplied={applyConversation} onCollapse={()=>setRightOpen(false)}/></div></>}{!rightOpen&&<div className="editor-panel-rail"><button title="展开属性面板" aria-label="展开属性面板" onClick={()=>setRightOpen(true)}><ChevronsLeft size={17}/></button></div>}</div>
  <MaterialPicker open={Boolean(materialInsert)} onClose={()=>setMaterialInsert(null)} workspaceId={work.workspaceId||'personal'} kinds={materialInsert?.kinds} title={materialInsert?.targetId?`添加${node?.type?nodeLabels[node.type]:'素材'}`:"选择画布素材"} onSelect={asset=>{if(materialInsert)useMaterial(asset,materialInsert.point,materialInsert.targetId,materialInsert.pageId);setMaterialInsert(null)}}/>
  {preview&&<RuntimePreview work={work} pageId={page.id} command={testCommand} onClose={()=>setPreview(false)}/>}
  <Modal open={!!renamePage} onClose={()=>setRenamePage(null)} title="重命名页面" footer={<><Button onClick={()=>setRenamePage(null)}>取消</Button><Button variant="primary" disabled={!pageName.trim()} onClick={()=>{commit({...work,pages:work.pages.map(p=>p.id===renamePage?{...p,name:pageName.trim()}:p)});setRenamePage(null)}}>保存名称</Button></>}><label className="field"><span>页面名称</span><input autoFocus value={pageName} onChange={e=>setPageName(e.target.value)} maxLength={40}/></label></Modal>
  {share&&<SubmissionDialog work={work} onClose={()=>{
   const latest=useStudio.getState().works.find(item=>item.id===work.id);
   if(latest){
    const classify=(snapshot:Work):Work=>({...snapshot,type:latest.type,displayForm:latest.displayForm,contentPurposes:latest.contentPurposes});
    setHistory(h=>({past:h.past.map(classify),present:{...classify(h.present),revision:latest.revision,updatedAt:latest.updatedAt},future:h.future.map(classify)}));
   }
   setShare(false);
  }}/>}
  <Modal open={exportOpen} onClose={()=>{if(exporting)abortExport.current?.abort();else setExportOpen(false)}} title="导出管理平台运行包" footer={<><Button onClick={()=>{if(exporting)abortExport.current?.abort();else setExportOpen(false)}}>{exporting?'取消导出':'关闭'}</Button>{!exporting&&exportError&&<Button variant="primary" onClick={runExport}><Download size={15}/>重新导出</Button>}</>}><div className="export-format-card"><span><Download size={23}/></span><div><h3>完整离线资产包 · ZIP</h3><p>{work.title} · {work.pages.length} 个页面 · {work.width} × {work.height}</p></div></div><p className="editor-modal-copy">正在收集页面、交互与引用素材。打包完成后自动下载，解压后可打开 index.html 运行；在线问答等服务仍需联网。</p>{exporting&&<div className="export-progress" role="status"><span>{exportProgress.label}<b>{Math.round(exportProgress.percent)}%</b></span><div><i style={{width:`${exportProgress.percent}%`}}/></div></div>}{exportError&&<p className="editor-error" role="alert">{exportError}</p>}</Modal>
 </div>;
}

const groups:{title:string;description:string;types:NodeKind[]}[]=[{title:'基础组件',description:'构建内容的基本元素',types:['text','image','video','audio','button']},{title:'复合组件',description:'组织信息与交互叙事',types:['card','timeline','graph','gallery','map','flow','chart','bubble','html']},{title:'装饰组件',description:'完善画面与视觉层次',types:['shape']}];
function ComponentGlyph({type}:{type:NodeKind}){return <div className={'component-glyph glyph-'+type}>{type==='text'?<><b>T</b><i/><i/></>:type==='image'?<Image size={27}/>:type==='video'?<Play size={25}/>:type==='audio'?<div className="glyph-audio-bars">{[12,22,32,18,28,14].map((h,i)=><i key={i} style={{height:h}}/>)}</div>:type==='timeline'?<><span className="glyph-line"/>{[0,1,2].map(i=><i className="glyph-dot" key={i} style={{left:`${20+i*30}%`}}/>)}</>:type==='graph'?<><i className="glyph-root"/><span className="glyph-branch"/><span className="glyph-leaves"><i/><i/><i/></span></>:type==='gallery'||type==='card'?<div className="glyph-cards">{Array.from({length:type==='card'?1:4},(_,i)=><i key={i}/>)}</div>:type==='chart'?<div className="glyph-chart-bars">{[15,27,22,38].map((h,i)=><i key={i} style={{height:h}}/>)}</div>:type==='flow'?<div className="glyph-flow-steps"><i/><span>→</span><i/><span>→</span><i/></div>:type==='bubble'?<span className="glyph-bubble">•••</span>:type==='button'?<span className="glyph-button-label">探索 <ChevronRight size={12}/></span>:type==='html'?<b className="glyph-code">&lt;/&gt;</b>:type==='map'?<span className="glyph-map">⌖</span>:<Square size={31}/>}</div>}
function ComponentPanel({work,pageId,selected,select,commit,onCollapse,onAddComponent,onUseMaterial,onBrowseMaterials}:{work:Work;pageId:string;selected:string[];select:(ids:string[])=>void;commit:(w:Work)=>void;onCollapse:()=>void;onAddComponent:(type:NodeKind)=>void;onUseMaterial:(asset:Asset)=>void;onBrowseMaterials:()=>void}){
 const [draggedLayer,setDraggedLayer]=useState<string|null>(null);const [layerDrop,setLayerDrop]=useState<{id:string;position:'above'|'below'}|null>(null);
 const [tab,setTab]=useState('组件');const [query,setQuery]=useState('');const [collapsed,setCollapsed]=useState<string[]>([]);const [source,setSource]=useState('全部');const allAssets=useStudio(s=>s.assets);const assets=allAssets.filter(asset=>assetAvailableForInsertion(asset,work.workspaceId||'personal'));const page=work.pages.find(p=>p.id===pageId)!;
 function reorder(id:string,delta:number){const index=page.nodes.findIndex(n=>n.id===id);const target=index+delta;if(target<0||target>=page.nodes.length)return;const nodes=[...page.nodes];[nodes[index],nodes[target]]=[nodes[target],nodes[index]];commit({...work,pages:work.pages.map(p=>p.id===pageId?{...p,nodes}:p)})}
 return <><div className="component-panel-tabs">{[['组件',Grid2X2],['素材',Image],['图层',Layers]].map(([label,Icon])=>{const I=Icon as typeof Layers;return <button key={label as string} className={tab===label?'active':''} onClick={()=>setTab(label as string)}><I size={15}/>{label as string}{label==='图层'&&<span>{page.nodes.length}</span>}</button>})}<button className="panel-collapse-control" title="收起组件面板" aria-label="收起组件面板" onClick={onCollapse}><ChevronsLeft size={16}/></button></div>{tab==='素材'?<EditorMaterialsPanel work={work} onSelect={onUseMaterial} onBrowse={onBrowseMaterials}/>:<><div className="component-panel-search"><Search size={15}/><input aria-label={tab==='组件'?'搜索组件':'搜索图层'} placeholder={tab==='组件'?'搜索组件名称或分类':'搜索图层名称'} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} aria-label="清除搜索"><X size={13}/></button>}</div>{tab==='组件'?<><div className="component-source-tabs">{['全部','我的组件'].map(t=><button className={source===t?'active':''} key={t} onClick={()=>setSource(t)}>{t}</button>)}</div><div className="component-library-scroll">{source==='全部'?groups.map(group=><section className="component-group" key={group.title}><button className="component-group-title" onClick={()=>setCollapsed(c=>c.includes(group.title)?c.filter(x=>x!==group.title):[...c,group.title])}><span>{group.title}<small>{group.types.length}</small></span><ChevronDown size={13} style={{transform:collapsed.includes(group.title)?'rotate(-90deg)':undefined}}/></button>{!collapsed.includes(group.title)&&<div className="component-grid">{group.types.filter(t=>nodeLabels[t].includes(query)||group.title.includes(query)).map(type=><button className="component-tile" key={type} draggable onDragStart={e=>e.dataTransfer.setData('application/zhichuang-component',type)} onClick={()=>onAddComponent(type)} title={`点击或拖入画布添加${nodeLabels[type]}`}><ComponentGlyph type={type}/><span>{nodeLabels[type]}</span></button>)}</div>}</section>):<div className="my-components">{assets.filter(a=>a.kind==='component'&&!a.public&&a.source!=='builtin'&&Boolean(materialNodeKind(a))&&a.name.includes(query)).map(a=><button className="component-tile" key={a.id} onClick={()=>onUseMaterial(a)}><ComponentGlyph type={a.componentType!}/><span>{a.name}</span></button>)}{!assets.some(a=>a.kind==='component'&&!a.public&&a.source!=='builtin')&&<p>生成的组件会沉淀在这里</p>}</div>}</div><div className="component-panel-tip"><MousePointer2 size={14}/><span>点击添加，或拖拽到画布</span></div></>:<><div className="layer-list">{[...page.nodes].reverse().filter(n=>n.name.includes(query)).map(n=><div className={'layer-row '+(selected.includes(n.id)?'selected ':'')+(n.hidden?'is-hidden ':'')+(layerDrop?.id===n.id?'drop-'+layerDrop.position:'')} key={n.id} data-layer-id={n.id} draggable={!n.locked} onDragStart={event=>{if(n.locked){event.preventDefault();return}event.dataTransfer.setData('application/zhichuang-layer',n.id);event.dataTransfer.effectAllowed='move';setDraggedLayer(n.id)}} onDragOver={event=>{if(!draggedLayer||draggedLayer===n.id)return;event.preventDefault();event.dataTransfer.dropEffect='move';const rect=event.currentTarget.getBoundingClientRect();setLayerDrop({id:n.id,position:event.clientY<rect.top+rect.height/2?'above':'below'})}} onDrop={event=>{event.preventDefault();const source=event.dataTransfer.getData('application/zhichuang-layer');if(source===draggedLayer&&layerDrop?.id===n.id){commit(reorderPageLayer(work,pageId,source,n.id,layerDrop.position));select([source])}setDraggedLayer(null);setLayerDrop(null)}} onDragEnd={()=>{setDraggedLayer(null);setLayerDrop(null)}}><button className="layer-select" onClick={e=>select(e.shiftKey?selected.includes(n.id)?selected.filter(id=>id!==n.id):[...selected,n.id]:[n.id])}>{n.type==='text'?<Type size={15}/>:n.type==='image'?<Image size={15}/>:n.type==='video'?<Video size={15}/>:<Grid2X2 size={15}/>}<span>{n.name}</span></button><button title={n.hidden?'显示图层':'隐藏图层'} onClick={()=>commit(updatePageNodes(work,pageId,[n.id],{hidden:!n.hidden}))}>{n.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button><button title={n.locked?'解锁图层':'锁定图层'} onClick={()=>commit(updatePageNodes(work,pageId,[n.id],{locked:!n.locked}))}>{n.locked?<Lock size={13}/>:<Unlock size={13}/>}</button><Menu trigger={<button title="图层更多操作"><MoreHorizontal size={13}/></button>} items={[{label:'上移一层',icon:<ArrowUp size={14}/>,onClick:()=>reorder(n.id,1)},{label:'下移一层',icon:<ArrowDown size={14}/>,onClick:()=>reorder(n.id,-1)},{label:'删除图层',danger:true,disabled:n.locked,onClick:()=>commit({...work,pages:work.pages.map(p=>p.id===pageId?{...p,nodes:p.nodes.filter(x=>x.id!==n.id)}:p)})}]}/></div>)}{!page.nodes.length&&<div className="layer-empty"><Layers size={28}/><p>从组件库添加第一个组件</p></div>}</div><div className="component-panel-tip">拖动排序 · 从上到下对应前景到背景</div></>}</>}</>;
}
function MiniScene({work}:{work:Work}){const ref=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(.2);useEffect(()=>{const o=new ResizeObserver(()=>{if(ref.current)setScale(ref.current.clientWidth/work.width)});if(ref.current)o.observe(ref.current);return()=>o.disconnect()},[work.width]);return <div ref={ref} style={{height:work.height*scale,overflow:'hidden'}}><div style={{transform:`scale(${scale})`,transformOrigin:'top left'}}><SceneRenderer work={work}/></div></div>}
function RuntimePreview({work,pageId,command,onClose}:{work:Work;pageId:string;command:string;onClose:()=>void}){const surface=useRef<HTMLDivElement>(null),fullscreen=usePreviewFullscreen(surface);const viewport=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(.6);const [text,setText]=useState(command);const [run,setRun]=useState(command);const [runKey,setRunKey]=useState(0);useEffect(()=>{const fit=()=>{if(viewport.current)setScale(Math.min(viewport.current.clientWidth/work.width,viewport.current.clientHeight/work.height))};fit();const o=new ResizeObserver(fit);if(viewport.current)o.observe(viewport.current);return()=>o.disconnect()},[work.width,work.height]);return <div ref={surface} className="runtime-overlay preview-fullscreen-surface"><header><div><Badge tone="blue">运行预览</Badge><b>{work.title}</b><span>{work.width} × {work.height}</span></div><form onSubmit={e=>{e.preventDefault();setRun(text);setRunKey(n=>n+1)}}><input aria-label="模拟语音口令" value={text} onChange={e=>setText(e.target.value)} placeholder="输入语音口令进行测试"/><button type="submit">测试</button></form><FullscreenButton fullscreen={fullscreen}/><Button variant="secondary" size="sm" onClick={onClose}><X size={15}/>返回编辑 <kbd>Esc</kbd></Button></header><div className="runtime-viewport" ref={viewport}><div style={{width:work.width*scale,height:work.height*scale}}><div style={{transform:`scale(${scale})`,transformOrigin:'top left'}}><SceneRenderer work={work} pageId={pageId} interactive commandText={run} commandNonce={runKey}/></div></div></div><footer><span><i/>交互与动效已启用</span><span>退出预览后恢复编辑状态</span></footer></div>}
