import {useState} from 'react';
import {ArrowUpRight, Search} from 'lucide-react';
import type {Asset, Work} from '../../domain/types';
import {useStudio} from '../../domain/store';
import {editorMaterialChoices} from '../conversation/reference-source-choices';
import {AssetPreview} from '../resources/Shared';

export function EditorMaterialsPanel({work,onSelect,onBrowse}:{work:Work;onSelect:(asset:Asset)=>void;onBrowse:()=>void}) {
 const all=useStudio(state=>state.assets);
 const [source,setSource]=useState<'space'|'community'>('space'),[query,setQuery]=useState('');
 const assets=editorMaterialChoices(all,work.workspaceId||'personal',source,query);
 return <div className="editor-materials-panel">
  <div className="component-panel-search"><Search size={15}/><input aria-label="搜索画布素材" placeholder="搜索名称、内容或说明" value={query} onChange={event=>setQuery(event.target.value)}/></div>
  <div className="component-source-tabs editor-material-sources">{[['space','当前空间'],['community','共创社区']].map(([value,label])=><button key={value} className={source===value?'active':''} onClick={()=>setSource(value as 'space'|'community')}>{label}</button>)}</div>
  <div className="editor-material-list">{assets.map(asset=><button key={asset.id} className="editor-material-tile" draggable aria-label={`添加素材 ${asset.name}`} title={`点击添加，或拖入画布：${asset.name}`} onClick={()=>onSelect(asset)} onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/zhichuang-asset',asset.id);event.dataTransfer.setData(`application/zhichuang-asset-${asset.kind}`,asset.id)}}>
   <span className="editor-material-cover"><AssetPreview asset={asset}/></span><strong>{asset.name}</strong><small>{asset.kind==='component'?'可编辑组件':asset.kind==='html'?'交互程序 · 可嵌入':asset.kind==='video'?'视频':asset.kind==='audio'?'音频':'图片'} · {asset.public?'社区':asset.package?.params.knowledgeCatalogId?'知识本地场 · 模拟':asset.source==='builtin'?'预置演示':'当前空间'}</small>
  </button>)}{!assets.length&&<div className="editor-material-empty"><p>没有匹配的可用素材</p><span>可切换来源，或从素材库选择、上传新素材。</span></div>}</div>
  <button className="editor-browse-materials" onClick={onBrowse}>打开素材库 / 上传<ArrowUpRight size={14}/></button>
  <div className="component-panel-tip">拖入空白处新增；拖到同类型组件上替换。</div>
 </div>;
}
