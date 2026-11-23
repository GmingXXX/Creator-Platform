import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Upload } from 'lucide-react';
import type { Asset, AssetKind } from '../../domain/types';
import { resourceInView } from '../../domain/resource-sharing';
import { assetAvailableForInsertion,assetAvailableForPersonalImport } from '../../domain/asset-access';
import { assetSearchText, getAssetMetadata } from '../../domain/asset-metadata';
import { importWorkspaceFile } from '../../domain/workspace-upload';
import { inspectComponentFile, type ComponentInspection } from '../../domain/component-import';
import { ComponentImportDialog, type ComponentImportResult } from './ComponentImportDialog';
import { useStudio } from '../../domain/store';
import { Button, EmptyState, Modal, SearchInput, Tabs, toast } from '../../components/ui';
import { AssetPreview } from './Shared';
import { typeLabels } from './helpers';
import '../../styles/material-picker.css';

export interface MaterialPickerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  kinds?: AssetKind[];
  title?: string;
  onSelect: (asset: Asset) => void;
}

const insertableKinds: AssetKind[] = ['image', 'video', 'audio', 'component', 'html'];
const accepted: Record<string, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*', html: '.html,.htm,.zip' };

export function MaterialPicker({ open, onClose, workspaceId, kinds = insertableKinds, title = '选择素材', onSelect }: MaterialPickerProps) {
  const assets = useStudio(state => state.assets);
  const [scope, setScope] = useState('mine');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [component, setComponent] = useState<{ inspection: ComponentInspection; file: File; version: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const kindsKey = kinds.join(',');
  useEffect(() => {
    if (open) { setScope(workspaceId==='personal'?'mine':'shared'); setQuery(''); setKind('all'); setSelectedId(''); setError(''); setComponent(null); }
  }, [open, workspaceId, kindsKey]);
  const eligible = assets.filter(asset => kinds.includes(asset.kind) && (assetAvailableForInsertion(asset, workspaceId)||(scope==='mine'&&assetAvailableForPersonalImport(asset,workspaceId))));
  const scoped = eligible.filter(asset => scope === 'community' ? asset.public : scope==='shared' ? resourceInView(asset,'shared',workspaceId)||(asset.source==='builtin'&&!asset.workspaceId) : resourceInView(asset,'mine',workspaceId)&&(workspaceId==='personal'||assetAvailableForPersonalImport(asset,workspaceId))); 
  const filtered = scoped.filter(asset => (kind === 'all' || asset.kind === kind) && assetSearchText(asset).toLowerCase().includes(query.trim().toLowerCase()));
  const selected = eligible.find(asset => asset.id === selectedId);
  const metadata = selected ? getAssetMetadata(selected) : undefined;
  const changeScope = (value: string) => { setScope(value); setSelectedId(''); setError(''); };
  const confirm = () => {
    if (!selected) return;
    const current = useStudio.getState().assets.find(asset => asset.id === selected.id);
    if (!current || !(assetAvailableForInsertion(current, workspaceId)||(scope==='mine'&&assetAvailableForPersonalImport(current,workspaceId)))) { setError('这份素材已不可用，请重新选择。'); return; }
    const adopted = useStudio.getState().adoptAsset(current.id, workspaceId);
    if (!adopted) { setError(useStudio.getState().creationError||'暂时无法使用这份素材，请确认来源与使用范围。'); return; }
    try { onSelect(adopted); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '添加失败，请重试。'); }
  };
  const uploadFile = async (file?: File) => {
    if (!file || busy) return;
    const targetWorkspace = workspaceId;
    setBusy(true); setError('');
    try {
      const inspection = await inspectComponentFile(file);
      if (inspection) {
        if (!kinds.includes('html')) throw new Error('当前操作不支持 HTML 组件，请选择符合要求的素材。');
        setComponent({ inspection, file, version: 0 });
        return;
      }
      const imported = await importWorkspaceFile(file, targetWorkspace);
      if (!kinds.includes(imported.kind)) throw new Error(`请选择${kinds.map(value => typeLabels[value]).join('、')}素材。`);
      const asset = { ...imported, workspaceId: targetWorkspace };
      useStudio.getState().addAsset(asset);
      setScope(workspaceId==='personal'?'mine':'shared'); setKind('all'); setQuery(''); setSelectedId(asset.id);
      toast(workspaceId==='personal'?'已上传到我的素材，确认后用于画布':'已上传到当前空间，确认后用于画布');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '素材上传失败，请重试。'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const saveComponent = async (result: ComponentImportResult) => {
    const state = useStudio.getState();
    if (state.assets.some(asset => asset.name === result.name && (asset.workspaceId || 'personal') === workspaceId && !asset.deletedAt)) throw new Error('已有同名素材，请调整组件名称后保存。');
    const imported = await importWorkspaceFile(new File([result.html], `${result.name.replace(/\.html?$/i, '')}.html`, { type: 'text/html;charset=utf-8' }), workspaceId);
    const asset: Asset = { ...imported, name: result.name, description: result.description || 'HTML 嵌入组件', workspaceId, componentImport: result.componentImport };
    state.addAsset(asset);
    setScope(workspaceId==='personal'?'mine':'shared'); setKind('all'); setQuery(''); setSelectedId(asset.id); setComponent(null);
    toast('组件已保存，确认后用于画布');
  };
  const replaceComponent = async (file: File) => {
    const inspection = await inspectComponentFile(file);
    if (!inspection) throw new Error('请选择包含 HTML 和相关资源的组件 ZIP。');
    setComponent(previous => previous ? { inspection, file, version: previous.version + 1 } : null);
  };
  const selectComponentEntry = async (entry: string) => {
    if (!component) return;
    const inspection = await inspectComponentFile(component.file, entry);
    if (inspection) setComponent(previous => previous ? { ...previous, inspection, version: previous.version + 1 } : null);
  };
  const accept = kinds.map(value => accepted[value]).filter(Boolean).join(',');
  return <><Modal open={open && !component} onClose={() => !busy && onClose()} title={title} wide footer={<>
    <span className="material-picker-footer-note">{selected?.source==='builtin'?'使用平台预置素材':selected && workspaceId!=='personal'&&(selected.workspaceId||'personal')!==workspaceId?'加入后，空间成员可使用此素材的固定副本':selected?.public?'采用社区的当前版本，保留来源':selected?selected.name:'先选择一份素材查看预览'}</span>
    <Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
    <Button variant="primary" disabled={!selected || busy} onClick={confirm}>{selected&&assetAvailableForPersonalImport(selected,workspaceId)?'带入空间并使用':'使用此素材'}</Button>
  </>}>
    <div className="material-picker" data-testid="material-picker">
      <div className="material-picker-top"><Tabs value={scope} onChange={changeScope} items={[...(workspaceId!=='personal'?[{value:'shared',label:'空间素材'},{value:'mine',label:'从个人空间带入'}]:[{value:'mine',label:'我的素材'}]),{value:'community',label:'共创社区'}]} />{accept && <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={14} />{busy ? '正在读取…' : '上传素材'}</Button>}</div>
      {scope==='mine'&&workspaceId!=='personal'&&<p className="material-picker-help">个人素材不会自动用于空间。确认后将保存空间可使用的固定副本，个人原件保留。</p>}<div className="material-picker-filter"><SearchInput value={query} onChange={value => { setQuery(value); setSelectedId(''); }} placeholder="搜索素材名称、说明或标签" />{kinds.length > 1 && <select aria-label="选择素材类型" value={kind} onChange={event => { setKind(event.target.value); setSelectedId(''); }}><option value="all">全部类型</option>{kinds.map(value => <option value={value} key={value}>{typeLabels[value]}</option>)}</select>}</div>
      {error && <p className="res-error" role="alert">{error}</p>}
      <div className="material-picker-content">
        <div className="material-picker-results">{filtered.length ? <div className="material-picker-grid">{filtered.map(asset => <button type="button" className={`material-picker-card ${selectedId === asset.id ? 'is-selected' : ''}`} aria-label={`选择${asset.name}`} aria-pressed={selectedId === asset.id} key={asset.id} onClick={() => { setSelectedId(asset.id); setError(''); }}><div className="material-picker-thumb"><AssetPreview asset={asset} />{selectedId === asset.id && <span className="material-picker-check"><Check size={13} /></span>}</div><strong>{asset.name}</strong><small>{typeLabels[asset.kind]} · {asset.public ? '共创社区' : asset.source === 'builtin' ? '平台内置' : (asset.workspaceId||'personal')==='personal'?'我的素材':'空间共享'}</small></button>)}</div> : <EmptyState title="没有匹配的素材" description={scope === 'mine' ? '试试其他关键词、上传文件，或从共创社区选择。' : '试试其他类型或关键词。'} />}</div>
        <aside className="material-picker-preview">{selected ? <>
          <AssetPreview asset={selected} large />
          <h3>{selected.name}</h3><p>{selected.description}</p>
          {metadata && <div className="material-picker-details">{metadata.facts.width && metadata.facts.height && <span>{metadata.facts.width} × {metadata.facts.height}</span>}{metadata.facts.duration !== undefined && <span>{metadata.facts.duration.toFixed(1)} 秒</span>}<span>{selected.public ? '共创社区' : selected.source === 'builtin' ? '平台内置' : (selected.workspaceId||'personal')==='personal'?'我的素材':'空间共享'}</span></div>}
          {metadata?.business.note && <p>{metadata.business.note}</p>}
          {selected.kind === 'component' && <p className="material-picker-help">已适配组件，可编辑已开放的内容、外观与交互属性。</p>}
          {selected.kind === 'html' && <p className="material-picker-help">{selected.componentImport?.runtime === 'parameters-connected' ? '已保留导入时试编辑的参数配置。' : ''}作为交互程序嵌入，可调整位置与尺寸；内部元素不自动拆成画布组件。</p>}
          {selected.public && <p className="material-picker-help">确认后保存当前版本的引用与来源。社区后续更新不会自动替换当前作品。</p>}
        </> : <div className="material-picker-preview-empty"><ImagePlus size={28} /><p>选择素材后预览</p><span>确认后才会应用到画布</span></div>}</aside>
      </div>
      <input ref={fileInput} className="res-sr-only" aria-label="上传可用素材" type="file" accept={accept} onChange={event => void uploadFile(event.target.files?.[0])} />
    </div>
  </Modal>{open && component && <ComponentImportDialog key={component.version} inspection={component.inspection} workspaceLabel={workspaceId==='personal'?'我的素材库':'当前空间素材'} onCancel={() => setComponent(null)} onReplace={replaceComponent} onEntryChange={selectComponentEntry} onSave={saveComponent} saveLabel="保存并选择"/>}</>;
}
