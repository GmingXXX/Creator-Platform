import {useState} from 'react';
import {ArrowUpRight, Search} from 'lucide-react';
import type {Asset, AssetKind, Work} from '../../domain/types';
import {useStudio} from '../../domain/store';
import {editorMaterialChoices} from '../conversation/reference-source-choices';
import {AssetPreview} from '../resources/Shared';

export function EditorMaterialsPanel({work,onSelect,onBrowse}:{work:Work;onSelect:(asset:Asset)=>void;onBrowse:(kind?:AssetKind)=>void}) {
 const all=useStudio(state=>state.assets);
 const [source,setSource]=useState<'space'|'community'>('space'),[query,setQuery]=useState('');
 const [kind,setKind]=useState('全部');
 const assets=editorMaterialChoices(all,work.workspaceId||'personal',source,query).filter(a=>kind==='全部'||a.kind===kind);
 return <div className="editor-materials-panel">
  <div className="component-panel-search"><Search size={15}/><input aria-label="搜索画布素材" placeholder="搜索名称、内容或说明" value={query} onChange={event=>setQuery(event.target.value)}/></div>
  <div className="component-source-tabs editor-material-sources">{[['space','当前空间'],['community','共创社区']].map(([value,label])=><button key={value} className={source===value?'active':''} onClick={()=>setSource(value as 'space'|'community')}>{label}</button>)}</div>
  <label className="editor-filter">素材类型<select aria-label="素材类型" value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries({'全部':'全部',image:'图片',video:'视频',audio:'音频',component:'可编辑组件',html:'交互程序'}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><div className="editor-material-list">{assets.map(asset=><button key={asset.id} className="editor-material-tile" draggable aria-label={`添加素材 ${asset.name}`} title={`点击添加，或拖入画布：${asset.name}`} onClick={()=>onSelect(asset)} onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/zhichuang-asset',asset.id);event.dataTransfer.setData(`application/zhichuang-asset-${asset.kind}`,asset.id)}}>
   <span className="editor-material-cover"><AssetPreview asset={asset}/></span><strong>{asset.name}</strong><small>{asset.kind==='component'?'可编辑组件':asset.kind==='html'?'交互程序 · 可嵌入':asset.kind==='video'?'视频':asset.kind==='audio'?'音频':'图片'} · {asset.public?'社区':asset.package?.params.knowledgeCatalogId?'知识本地场 · 模拟':asset.source==='builtin'?'预置演示':'当前空间'}</small>
  </button>)}{!assets.length&&<div className="editor-material-empty"><p>没有匹配的可用素材</p><span>可切换来源，或从素材库选择、上传新素材。</span></div>}</div>
  <button className="editor-browse-materials" onClick={()=>onBrowse(kind==='全部'?undefined:kind as AssetKind)}>打开素材库 / 上传<ArrowUpRight size={14}/></button>
  <div className="component-panel-tip">拖入空白处新增；拖到同类型组件上替换。</div>
 </div>;
}
