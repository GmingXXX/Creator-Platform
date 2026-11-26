import {StoryPhotoSettings} from './StoryPhoto';
import {StoryInspectorResize} from './StoryInspectorResize';
import {StorySceneSettings} from './StorySceneSettings';
import {TrackField} from './StorySound';
import {cloneStoryScene,eventCaption} from '../../domain/story-events';
import {StoryRoutes} from './StoryRoutes';
import {storyKind,storyKinds,type StoryTrigger} from '../../domain/story-canvas';
import '../../styles/story-authoring.css';
import {StudioSubmissionAction} from './StudioSubmissionAction';
import {ProjectAppearance,DeliveryReview} from '../editor/ProjectAppearance';
import {EditorHistoryButtons} from '../editor/EditorHistoryButtons';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {FloatingWorkAgent} from '../editor/FloatingWorkAgent';
import {StoryNodeDetails} from './StoryNodeDetails';
import {storyMediaKind} from './creationLogic';
import '../../styles/studio-creation.css';
import { assetAvailableForInsertion } from '../../domain/asset-access';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, addEdge, useEdgesState, useNodesState } from '@xyflow/react';
import type { Connection, Node, NodeProps, Edge, NodeChange, EdgeChange, ReactFlowInstance } from '@xyflow/react';
import { AlertCircle, ArrowRight, Code2, Film, CheckCircle2, Flag, Camera, GitBranch, Image, Layers3, Play, Plus, ScanLine, Trash2 } from 'lucide-react';
import { Button, Badge, EmptyState, Modal, toast } from '../../components/ui';
import { useStudio } from '../../domain/store';
import type { StoryNode, StoryEdge, Work } from '../../domain/types';
import { downloadJSON, Field, StudioImage, StudioTopbar, useUnsavedWarning } from './StudioShared';
import { formatBranch, parseBranch, validateStory } from './studioLogic';
import { StoryPreview } from './StoryPreview';
import '@xyflow/react/dist/style.css';
import '../../styles/studios.css';
import { navigateInWorkspace } from '../workspace/output-navigation';
import { MaterialPicker } from '../resources/MaterialPicker';

type StoryFlowData=Omit<StoryNode,'id'|'type'|'x'|'y'>&{kind:string};
type StoryFlowNode=Node<StoryFlowData,'story'>;
const kindLabels:Record<string,string>=storyKinds;
const nodeIcons:Record<string,typeof Play>={start:Play,scene:Image,photo:Camera,end:Flag};
function StoryFlowCard({data,selected}:NodeProps<StoryFlowNode>){
 const assets=useStudio(s=>s.assets),mediaKind=storyMediaKind(data,assets),Icon=nodeIcons[data.kind]||Image;
 const asset=assets.find(a=>a.id===data.mediaAssetId||a.src===data.media);
 const poster=mediaKind==='image'?data.media:asset?.preview&&asset.preview!==data.media&&asset.preview!=='/media/technology.svg'?asset.preview:undefined;
 const MediaIcon=mediaKind==='video'?Film:Code2;
 return <div className={`story-node story-node-${data.kind} ${selected?'selected':''}`}>
  {data.kind!=='start'&&<Handle type="target" position={Position.Left}/>}
  <div className="story-node-kind"><span><Icon size={14}/></span>{kindLabels[data.kind]||data.kind}<i/></div>
  {data.media&&(poster?<StudioImage src={poster} alt=""/>:<div className="story-media-placeholder"><MediaIcon size={16}/>{mediaKind==='video'?'视频':'HTML 互动'}{asset?.name&&<span>{asset.name}</span>}</div>)}
  <div className="story-node-copy"><b>{data.title}</b>{data.text&&<p>{data.text}</p>}</div>
  {data.kind!=='end'&&<Handle type="source" position={Position.Right}/>}
 </div>;
}
const nodeTypes={story:StoryFlowCard};
const toNodes=(work?:Work):StoryFlowNode[]=>(work?.storyNodes||[]).map(({id,type,x,y,...content})=>({
 id,type:'story',position:{x,y},data:{...content,kind:storyKind(type)}
}));
const toEdges=(work?:Work):Edge[]=>(work?.storyEdges||[]).map(edge=>{
 const {label,condition}=parseBranch(edge.label);
 return {...edge,type:'smoothstep',className:'story-map-edge',label:edge.trigger&&edge.trigger!=='click'?eventCaption(edge,work?.storyNodes?.find(n=>n.id===edge.source)):label,
 data:{condition,branchLabel:label,trigger:edge.trigger,delaySeconds:edge.delaySeconds,layerId:edge.layerId,stay:edge.stay,effects:edge.effects},
 style:{stroke:'var(--zc-muted)',strokeWidth:1.6},labelStyle:{fill:'var(--zc-text)',fontSize:11},labelBgStyle:{fill:'var(--zc-surface)'},labelBgPadding:[7,5] as [number,number]};
});
export function StoryEditorPage(){
 const {id}=useParams();const navigate=useNavigate();const source=useStudio(s=>s.works.find(w=>w.id===id&&!w.deletedAt));const saveWork=useStudio(s=>s.saveWork);const allAssets=useStudio(s=>s.assets);const assets=allAssets.filter(a=>assetAvailableForInsertion(a,source?.workspaceId));
 const [inspectorWidth,setInspectorWidth]=useState<number>();
 const [inspector,setInspector]=useState(true),[mapOpen,setMapOpen]=useState(false),[palette,setPalette]=useState(true);
 const [reconnecting,setReconnecting]=useState(false);
 const reconnect=useRef({accepted:false,cancelled:false}),[undoEdge,setUndoEdge]=useState<Edge>();
 const [exportPanel,setExportPanel]=useState(false);
 const [detailNode,setDetailNode]=useState<string|null>(null);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')reconnect.current.cancelled=true;};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 const [flow,setFlow]=useState<ReactFlowInstance<StoryFlowNode,Edge>|null>(null);const [work,setWork]=useState(source);const [nodes,setNodes,onNodesChange]=useNodesState<StoryFlowNode>(toNodes(source));const [edges,setEdges,onEdgesChange]=useEdgesState<Edge>(toEdges(source));const [selected,setSelected]=useState<string|undefined>();const [edgeId,setEdgeId]=useState<string|undefined>();const [dirty,setDirty]=useState(false);const [validate,setValidate]=useState(false);const [preview,setPreview]=useState(false);const [picker,setPicker]=useState(false);const [coverPicker,setCoverPicker]=useState(false);
 useEffect(()=>{setWork(source);setNodes(toNodes(source));setEdges(toEdges(source));setDirty(false);setSelected(undefined);setEdgeId(undefined)},[id]);useUnsavedWarning(dirty);
 useEffect(()=>{if(!flow)return;let timer:ReturnType<typeof setTimeout>;const resize=()=>{clearTimeout(timer);timer=setTimeout(()=>{void flow.fitView({padding:.16})},80)};window.addEventListener('resize',resize);return()=>{clearTimeout(timer);window.removeEventListener('resize',resize)}},[flow]);
 useEffect(()=>{
  if(!undoEdge)return;
  const restore=(event:KeyboardEvent)=>{const target=event.target;if(!(event.ctrlKey||event.metaKey)||event.shiftKey||event.key.toLowerCase()!=='z'||(target instanceof Element&&target.closest('input,textarea,select,[contenteditable=true]')))return;
   if(!nodes.some(n=>n.id===undoEdge.target)||!edges.some(e=>e.id===undoEdge.id&&!e.target))return;
   event.preventDefault();setEdges(items=>items.map(e=>e.id===undoEdge.id?{...e,target:undoEdge.target}:e));setDirty(true);setUndoEdge(undefined);
  };
  window.addEventListener('keydown',restore);return()=>window.removeEventListener('keydown',restore);
 },[undoEdge,nodes,edges,setEdges]);
 const domainNodes:StoryNode[]=useMemo(()=>nodes.map(({id,position,data:{kind,...content}})=>({id,type:kind,...position,...content})),[nodes]);
 const domainEdges=useMemo(()=>edges.map(e=>({id:e.id,source:e.source,target:e.target,stay:e.data?.stay as boolean|undefined,effects:e.data?.effects as StoryEdge["effects"],trigger:e.data?.trigger as StoryTrigger|undefined,layerId:e.data?.layerId as string|undefined,delaySeconds:e.data?.delaySeconds as number|undefined,label:formatBranch(String(e.data?.branchLabel??e.label??''),String(e.data?.condition||'any'))})),[edges]);
 const editable=useStudio(state=>workspaceCanEdit(state,work?.workspaceId||'personal'));
 const problems=useMemo(()=>validateStory(domainNodes,domainEdges,allAssets),[domainNodes,domainEdges,allAssets]);
 const selectedNode=nodes.find(n=>n.id===selected);const selectedEdge=edges.find(e=>e.id===edgeId);
 const connect=useCallback((connection:Connection)=>{if(!editable)return;if(connection.source===connection.target)return toast('请选择不同的目标节点');if(edges.some(e=>e.source===connection.source&&e.target===connection.target))return toast('这两个节点已经连接');setEdges(es=>addEdge({...connection,id:crypto.randomUUID(),type:'smoothstep',label:'继续',data:{condition:'any'},style:{stroke:'#a7b1c0',strokeWidth:1.6},labelBgStyle:{fill:'#f6f8fb'}},es));setDirty(true)},[editable,edges,setEdges]);
 if(!work)return <EmptyState title="没有找到这个互动影片" action={<Button onClick={()=>navigate('/projects?category=interactive-film')}>返回作品</Button>}/>;
 const flush=()=>{if(dirty){saveWork({...work,storyNodes:domainNodes,storyEdges:domainEdges});setDirty(false)}};
 const applyAgent=(next:Work)=>{setWork(next);setNodes(toNodes(next));setEdges(toEdges(next));setDirty(false)};
 const save=()=>{try{saveWork({...work,storyNodes:domainNodes,storyEdges:domainEdges});setWork(useStudio.getState().works.find(item=>item.id===work.id));setDirty(false);toast('互动影片已保存到作品库');return true}catch(e){toast(e instanceof Error?e.message:'保存失败');return false}};
 const add=(kind:string,point?:{x:number;y:number})=>{if(!editable||!Object.hasOwn(kindLabels,kind))return;if(kind==='start'&&nodes.some(n=>n.data.kind==='start'))return toast('一个故事只需要一个开始节点');const nid=crypto.randomUUID();const last=nodes[nodes.length-1];setNodes(ns=>[...ns,{id:nid,type:'story',position:point||{x:(last?.position.x||0)+120,y:(last?.position.y||0)+160},data:{showCaption:false,title:`新的${kindLabels[kind]}`,text:kind==='photo'?'拍摄一张纪念照片。':'在这里写下故事内容。',kind,media:kind==='scene'?'/media/technology.svg':undefined}}]);setSelected(nid);setEdgeId(undefined);setDirty(true)};
 const changeData=(patch:Partial<StoryFlowData>)=>{setNodes(ns=>ns.map(n=>n.id===selected?{...n,data:{...n.data,...patch}}:n));setDirty(true)};
 const sourceNode=domainNodes.find(n=>n.id===(selected||selectedEdge?.source));
 const saveRoutes=(source:string,outgoing:StoryEdge[])=>{
  if(!editable)return;
  setEdges(es=>[...es.filter(e=>e.source!==source),...toEdges({...work,storyNodes:domainNodes,storyEdges:outgoing})]);setDirty(true);
 };
 const copyNode=()=>{
  if(!editable||!sourceNode)return;
  const copy=cloneStoryScene(sourceNode,domainEdges);
  const next={...work,storyNodes:[...domainNodes,copy.node],storyEdges:[...domainEdges,...copy.edges]};
  setNodes(toNodes(next));setEdges(toEdges(next));setSelected(copy.node.id);setDirty(true);
 };
 const focusNode=(nodeId:string)=>{setSelected(nodeId);setEdgeId(undefined);void flow?.fitView({nodes:[{id:nodeId}],maxZoom:1,duration:220});};
 const upstream=domainNodes.filter(n=>domainEdges.some(e=>e.source===n.id&&e.target===selected));
 const deleteSelected=()=>{if(selected){setNodes(ns=>ns.filter(n=>n.id!==selected));setEdges(es=>es.filter(e=>e.source!==selected&&e.target!==selected));setSelected(undefined)}else if(edgeId){setEdges(es=>es.filter(e=>e.id!==edgeId));setEdgeId(undefined)}setDirty(true)};
 return <div className="studio-editor story-editor"><StudioTopbar workspaceId={work.workspaceId} title={work.title} back="/projects?category=interactive-film" saved={!dirty} onSave={save}><EditorHistoryButtons work={{...work,storyNodes:domainNodes,storyEdges:domainEdges}} onRestore={next=>{applyAgent(next);setDirty(true)}}/><ProjectAppearance work={{...work,storyNodes:domainNodes,storyEdges:domainEdges}} onChange={next=>{applyAgent(next);setDirty(true)}} disabled={!editable}/><FloatingWorkAgent work={{...work,storyNodes:domainNodes,storyEdges:domainEdges}} nodeId={selected} onBeforeApply={flush} onApplied={applyAgent}/><StudioSubmissionAction work={work} onSave={save}/><Button onClick={()=>setExportPanel(true)}>导出</Button><Button onClick={()=>setValidate(v=>!v)}>{problems.length?<AlertCircle size={14}/>:<CheckCircle2 size={14}/>}检查流程</Button><Button variant="primary" onClick={()=>{if(problems.some(issue=>!issue.includes('失效连线'))){setValidate(true);toast('请先完善可体验的故事路径');return}if(!editable||save())setPreview(true)}}><Play size={15}/>预览</Button></StudioTopbar><Modal open={exportPanel} onClose={()=>setExportPanel(false)} title="导出互动影片" footer={<Button onClick={()=>{downloadJSON({...work,storyNodes:domainNodes,storyEdges:domainEdges},work.title+'.json');setExportPanel(false)}}>导出影片工程（JSON）</Button>}><DeliveryReview work={{...work,storyNodes:domainNodes,storyEdges:domainEdges}} disabled={!editable} onChange={next=>{setWork(next);setDirty(true)}}/></Modal><div className="story-workspace"><main className="story-flow-wrap" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const kind=e.dataTransfer.getData('application/story-node');if(kind&&flow)add(kind,flow.screenToFlowPosition({x:e.clientX,y:e.clientY}));}}>
 <div className="story-floating-tools"><button aria-label={palette?'收起节点工具':'展开节点工具'} onClick={()=>setPalette(v=>!v)}><Plus size={15}/></button>{palette&&Object.entries(kindLabels).map(([kind,label])=>{const Icon=nodeIcons[kind];return <button key={kind} draggable={editable} onDragStart={e=>e.dataTransfer.setData('application/story-node',kind)} onClick={e=>{if(kind==='start'&&nodes.some(n=>n.data.kind==='start')){const n=nodes.find(n=>n.data.kind==='start')!;setSelected(n.id);void flow?.fitView({nodes:[n],maxZoom:1});return;}const r=e.currentTarget.closest('main')?.getBoundingClientRect();add(kind,r&&flow?flow.screenToFlowPosition({x:r.left+r.width/2,y:r.top+r.height/2}):undefined);}}><Icon size={15}/>{label}</button>;})}</div>
 {reconnecting&&<div className="story-drop-hint">拖到入口改接 · 在空白处松开以断开 · Esc 取消</div>}<div className="story-flow-actions"><button aria-pressed={mapOpen} onClick={()=>setMapOpen(v=>!v)}>导航图</button><button onClick={()=>setInspector(v=>!v)}>{inspector?'收起属性':'展开属性'}</button>{undoEdge&&<button onClick={()=>{if(nodes.some(n=>n.id===undoEdge.target)){setEdges(es=>es.map(e=>e.id===undoEdge.id?{...e,target:undoEdge.target}:e));setDirty(true);}setUndoEdge(undefined);}}>撤销断开</button>}</div><div className="story-canvas-caption"><Badge>节点工作流</Badge><span>{nodes.length} 个节点 · {edges.filter(e=>e.target).length} 条连接</span></div><ReactFlow onInit={setFlow} nodesDraggable={editable} nodesConnectable={editable} nodes={nodes} edges={edges.filter(e=>e.target)} nodeTypes={nodeTypes} onNodesChange={(changes:NodeChange<StoryFlowNode>[])=>{const removed=changes.filter(c=>c.type==='remove');if(removed.length)setEdges(es=>es.filter(e=>!removed.some(c=>c.id===e.source||c.id===e.target)));onNodesChange(changes);if(changes.some(c=>c.type==='position'||c.type==='remove'||c.type==='add'))setDirty(true)}} onEdgesChange={(changes:EdgeChange[])=>{const dropped=changes.filter(c=>c.type==='remove');if(dropped.length){setUndoEdge(edges.find(e=>e.id===dropped[0].id));setEdges(es=>es.map(e=>dropped.some(c=>c.id===e.id)?{...e,target:''}:e));}onEdgesChange(changes.filter(c=>c.type!=='remove'));if(changes.some(c=>c.type==='remove'||c.type==='add'))setDirty(true)}} onConnect={connect} edgesReconnectable={editable} defaultMarkerColor="#96a4b7" onReconnectStart={()=>{setReconnecting(true);reconnect.current={accepted:false,cancelled:false};}} onReconnect={(_,connection)=>{const old=_;if(connection.source===connection.target||nodes.find(n=>n.id===connection.target)?.data.kind==='start')return;reconnect.current.accepted=true;setEdges(es=>es.map(e=>e.id===old.id?{...e,source:connection.source,target:connection.target}:e));setDirty(true);}} onReconnectEnd={(event,edge,_handle,connection)=>{setReconnecting(false);if(reconnect.current.accepted||reconnect.current.cancelled||connection.toNode||!(event.target instanceof Element)||!event.target.classList.contains('react-flow__pane'))return;setUndoEdge(edge);setEdges(es=>es.map(e=>e.id===edge.id?{...e,target:''}:e));setDirty(true);}} onNodeDoubleClick={(_,node)=>{setSelected(node.id);setEdgeId(undefined);if(editable)setDetailNode(node.id)}} onNodeClick={(_,node)=>{setSelected(node.id);setInspector(true);setEdgeId(undefined)}} onEdgeClick={(_,edge)=>{setEdgeId(edge.id);setSelected(undefined)}} onPaneClick={()=>{setSelected(undefined);setEdgeId(undefined)}} fitView fitViewOptions={{padding:.22}} minZoom={.3} maxZoom={1.7} deleteKeyCode={editable?['Backspace','Delete']:null} defaultEdgeOptions={{type:'smoothstep',reconnectable:'target'}}><Background variant={BackgroundVariant.Dots} color="#d9dfe8" gap={20} size={1}/><Controls showInteractive={false}/>{mapOpen&&<MiniMap nodeColor={n=>n.data.kind==='choice'?'#e7c285':n.data.kind==='end'?'#9ac7b6':'#a9bbd5'} maskColor="rgba(246,248,251,.8)" zoomable pannable/>}</ReactFlow>{nodes.length===0&&<div className="story-empty-canvas"><GitBranch size={28}/><h3>从第一个节点开始</h3><p>手动添加场景、选择与结局，连接成你的体验流程。</p><Button variant="primary" onClick={()=>add('start')}><Plus size={15}/>添加开始节点</Button></div>}{validate&&<div className="story-validation-panel"><header>{problems.length?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>}<b>{problems.length?`${problems.length} 项需要调整`:'流程检查通过'}</b><button onClick={()=>setValidate(false)}>收起</button></header>{problems.length?<ul>{problems.map(p=><li key={p}>{p}</li>)}</ul>:<p>起点、连接与结局均已就绪，可以开始试运行。</p>}</div>}</main>{inspector&&<><StoryInspectorResize value={inspectorWidth} onResize={setInspectorWidth}/><aside className="studio-inspector" style={inspectorWidth?{width:inspectorWidth,minWidth:0}:undefined}><div className="studio-panel-heading"><b>{selectedNode?'节点属性':selectedEdge?'连线属性':'故事设置'}</b></div><fieldset disabled={!editable} className="studio-inspector-body story-inspector-fields">{selectedNode?<><Field label="节点类型"><select value={selectedNode.data.kind} onChange={e=>{const kind=e.target.value;if(kind==='start'&&nodes.some(n=>n.id!==selectedNode.id&&n.data.kind==='start'))return toast('已有开始节点');const incompatible=edges.filter(edge=>(edge.source===selectedNode.id&&(kind==='end'||kind!=='photo'&&['photoConfirm','photoSkip'].includes(String(edge.data?.trigger))))||(kind==='start'&&edge.target===selectedNode.id));if(incompatible.length&&!window.confirm('切换类型将移除 '+incompatible.length+' 条不兼容的连线，继续吗？'))return;setEdges(es=>es.filter(edge=>!incompatible.some(x=>x.id===edge.id)));changeData({kind});}}>{Object.entries(kindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="节点名称"><input value={selectedNode.data.title} onChange={e=>changeData({title:e.target.value})}/></Field><Field label="节点简介"><textarea rows={6} value={selectedNode.data.text} onChange={e=>changeData({text:e.target.value})}/></Field>{sourceNode&&<StorySceneSettings node={sourceNode} work={work} disabled={!editable} onChange={changeData}/>}{sourceNode?.type==='photo'&&<StoryPhotoSettings workspaceId={work.workspaceId||'personal'} value={sourceNode.photo} onChange={photo=>changeData({photo})}/>}<div className="studio-property-divider"/>{sourceNode&&<StoryRoutes key={sourceNode.id} node={sourceNode} nodes={domainNodes} edges={domainEdges.filter(e=>e.source===sourceNode.id)} assets={assets} onChange={outgoing=>saveRoutes(sourceNode.id,outgoing)}/>}
 {upstream.length>0&&<details className="story-flow-section"><summary>上游节点 <small>{upstream.length}</small></summary><div className="story-upstream-list">{upstream.map(n=><Button key={n.id} size="sm" onClick={()=>focusNode(n.id)}>{n.title}</Button>)}</div></details>}
 <div className="story-node-operations"><Button onClick={()=>setDetailNode(selectedNode.id)}>编辑节点画面</Button><Button onClick={copyNode}>复制节点</Button><Button variant="danger" onClick={deleteSelected}><Trash2 size={14}/>删除节点</Button></div></>:selectedEdge&&sourceNode?<><div className="story-edge-route"><b>{sourceNode.title}</b><ArrowRight size={16}/><b>{nodes.find(n=>n.id===selectedEdge.target)?.data.title||'待连接'}</b></div>
 <StoryRoutes key={selectedEdge.id} activeEdgeId={selectedEdge.id} node={sourceNode} nodes={domainNodes} edges={domainEdges.filter(e=>e.source===sourceNode.id)} assets={assets} onChange={outgoing=>saveRoutes(sourceNode.id,outgoing)}/>
 <Button onClick={()=>{setUndoEdge(selectedEdge);setEdges(items=>items.map(e=>e.id===selectedEdge.id?{...e,target:''}:e));setDirty(true);setSelected(sourceNode.id);setEdgeId(undefined);}}>断开去向</Button></>:<><Field label="作品名称"><input maxLength={80} value={work.title} onChange={e=>{setWork({...work,title:e.target.value});setDirty(true)}}/></Field><Field label="画面分辨率"><span>{work.width} × {work.height}</span></Field><TrackField label="项目配乐" track={work.storyMusic} workspaceId={work.workspaceId||'personal'} disabled={!editable} onChange={storyMusic=>{setWork({...work,storyMusic});setDirty(true);}}/><Field label="作品封面">{work.cover&&<StudioImage src={work.cover} alt="作品封面" style={{width:'100%',borderRadius:8}}/>}<Button onClick={()=>setCoverPicker(true)}>选择封面素材</Button></Field>{work.creationPackage?.params.experience&&<Field label="体验流程"><p className="studio-muted">{work.creationPackage.params.experience}</p></Field>}<div className="story-summary"><span>故事节点<b>{nodes.length}</b></span><span>分支选择<b>{nodes.filter(n=>edges.filter(e=>e.source===n.id).length>1).length}</b></span><span>故事结局<b>{nodes.filter(n=>n.data.kind==='end').length}</b></span></div><Button onClick={()=>setValidate(true)}><ScanLine size={14}/>检查完整性</Button></>}</fieldset></aside></>}</div>{detailNode&&domainNodes.find(n=>n.id===detailNode)&&<StoryNodeDetails styleId={work.styleId} projectMusic={work.storyMusic} renderSceneSettings={(node,onChange)=><StorySceneSettings node={node} onChange={onChange} work={work} disabled={!editable}/>} key={detailNode} width={work.width} height={work.height} workTitle={work.title} node={domainNodes.find(n=>n.id===detailNode)!} nodes={domainNodes} edges={domainEdges} workspaceId={work.workspaceId||'personal'} onClose={()=>setDetailNode(null)} onApply={(next,outgoing)=>{const nextWork={...work,storyNodes:domainNodes.map(n=>n.id===next.id?next:n),storyEdges:[...domainEdges.filter(e=>e.source!==next.id),...outgoing]};setNodes(toNodes(nextWork));setEdges(toEdges(nextWork));setDirty(true)}}/>}<MaterialPicker open={coverPicker} onClose={()=>setCoverPicker(false)} workspaceId={work.workspaceId||'personal'} kinds={['image','video']} title="选择作品封面" onSelect={asset=>{setWork({...work,cover:asset.preview,coverAssetId:asset.id});setDirty(true)}}/>{preview&&<StoryPreview projectMusic={work.storyMusic} styleId={work.styleId} nodes={domainNodes} edges={domainEdges} title={work.title} width={work.width} height={work.height} onClose={()=>setPreview(false)}/>}</div>;
}
