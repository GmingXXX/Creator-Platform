import {KnowledgeTargetNotice} from '../workspace/KnowledgeTargetNotice';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { CheckCircle2, Info, PencilLine } from 'lucide-react';
import type { Asset } from '../../domain/types';
import { getAssetMetadata } from '../../domain/asset-metadata';
import { useStudio } from '../../domain/store';
import { Badge, Button, toast } from '../../components/ui';
import '../../styles/asset-metadata.css';

export interface AssetMetadataPanelHandle {
  isDirty: () => boolean;
  save: () => boolean;
  discard: () => void;
}

export const AssetMetadataPanel = forwardRef<AssetMetadataPanelHandle, { asset: Asset; readOnly?: boolean }>(function AssetMetadataPanel({ asset, readOnly = false }, ref) {
  const metadata = getAssetMetadata(asset);
  const [business, setBusiness] = useState(metadata.business);
  const [error, setError] = useState('');
  useEffect(() => { setBusiness(getAssetMetadata(asset).business); setError(''); }, [asset.id, asset.metadata]);
  const dirty = JSON.stringify(business) !== JSON.stringify(metadata.business);
  const facts = metadata.facts;
  const factItems = [
    { label: '文件格式', value: facts.mime || '未记录' },
    ...(facts.width && facts.height ? [{ label: '画面尺寸', value: `${facts.width} × ${facts.height}` }] : []),
    ...(facts.bytes !== undefined ? [{ label: '文件大小', value: facts.bytes < 1024 ? `${facts.bytes} B` : facts.bytes < 1024 * 1024 ? `${(facts.bytes / 1024).toFixed(1)} KB` : `${(facts.bytes / 1024 / 1024).toFixed(2)} MB` }] : []),
    ...(facts.duration !== undefined ? [{ label: '媒体时长', value: `${facts.duration.toFixed(1)} 秒` }] : []),
  ];
  const usageLabels = { project: '仅当前空间使用', reusable: '可跨空间复用', reference: '仅作参考，不自动采用' };
  const save = (): boolean => {
    if (readOnly) return false;
    if (business.confirmed && !business.subject.trim()) { setError('请填写适用对象后再确认其身份。'); return false; }
    const ok = useStudio.getState().updateAssetMetadata(asset.id, { business });
    if (!ok) { setError('无法保存素材信息，请确认素材仍在当前空间且未被删除。'); return false; }
    setError(''); toast('素材信息已保存，可用于后续检索');
    return true;
  };
  useImperativeHandle(ref, () => ({ isDirty: () => !readOnly && dirty, save, discard: () => { setBusiness(getAssetMetadata(asset).business); setError(''); } }));
  return <div className="asset-metadata" data-testid="asset-metadata">
    {asset.knowledgeTarget&&!asset.public&&<KnowledgeTargetNotice target={asset.knowledgeTarget} historical/>}
    <section className="asset-metadata-system">
      <div className="asset-metadata-heading"><h3>素材信息</h3><Badge>{metadata.business.note.trim() ? '业务说明已补充' : metadata.analysis.status === 'ready' ? '信息已整理' : metadata.analysis.status === 'failed' ? '信息读取未完成' : '待补充内容说明'}</Badge></div>
      <dl className="asset-metadata-facts">{factItems.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
      <p className="asset-metadata-caption"><Info size={14} />{metadata.analysis.basis === 'demo' ? '样例内容说明，用于演示素材检索。' : metadata.analysis.basis === 'inherited' ? '内容说明沿用原素材或创作任务，业务身份以人工确认为准。' : '文件属性由系统读取；画面内容和业务身份需要补充说明。'}</p>
      {metadata.analysis.summary && <p className="asset-metadata-summary">{metadata.analysis.summary}</p>}
      {metadata.analysis.tags.length > 0 && <div className="res-inline-tags">{metadata.analysis.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}</div>}
    </section>
    <section className="asset-metadata-business">
      <div className="asset-metadata-heading"><h3>{readOnly && asset.public ? '社区发布信息' : '业务说明'}</h3>{readOnly ? <Badge>只读</Badge> : <span><PencilLine size={13} />由你确认</span>}</div>
      {readOnly ? <>
        <p>{business.note || '暂未补充业务说明。'}</p>
        <dl className="asset-metadata-facts"><div><dt>适用对象</dt><dd>{business.subject || '未指定'}{business.confirmed && <span className="asset-confirmed"><CheckCircle2 size={12} />已确认</span>}</dd></div><div><dt>用途</dt><dd>{usageLabels[business.usage]}</dd></div></dl>
        <p className="asset-metadata-caption">{asset.public ? '采用后可为当前空间的副本补充说明，原社区内容不受影响。' : asset.deletedAt ? '恢复素材后可以继续补充说明。' : '此处展示素材来源提供的信息。'}</p>
      </> : <div className="asset-metadata-form">
        <label>业务说明<textarea aria-label="业务说明" rows={3} maxLength={1000} placeholder="例如：客户提供的工厂实拍，可用于企业介绍页面" value={business.note} onChange={event => setBusiness(previous => ({ ...previous, note: event.target.value }))} /></label>
        <label>适用对象<input aria-label="适用对象" maxLength={120} placeholder="客户、产品或人物名称；不确定时可留空" value={business.subject} onChange={event => setBusiness(previous => ({ ...previous, subject: event.target.value, confirmed: false }))} /></label>
        <label className="asset-metadata-check"><input type="checkbox" checked={business.confirmed} disabled={!business.subject.trim()} onChange={event => setBusiness(previous => ({ ...previous, confirmed: event.target.checked }))} />已确认该素材属于上述对象</label>
        <label>用途<select aria-label="素材用途" value={business.usage} onChange={event => setBusiness(previous => ({ ...previous, usage: event.target.value as typeof business.usage }))}>{Object.entries(usageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="asset-metadata-check"><input type="checkbox" checked={business.allowAi} onChange={event => setBusiness(previous => ({ ...previous, allowAi: event.target.checked }))} />允许智能体检索与推荐</label>
        <p className="asset-metadata-caption">空间归属不等于画面中的客户身份。信息不明确时，智能体会请你确认；允许检索不会公开素材。</p>
        {error && <p className="res-error" role="alert">{error}</p>}
        <div className="asset-metadata-actions"><Button size="sm" variant="primary" disabled={!dirty} onClick={save}>保存素材信息</Button>{dirty && <span>有尚未保存的修改</span>}</div>
      </div>}
    </section>
  </div>;
});

export function AssetInformationStatus({ asset }: { asset: Asset }) {
  const metadata = getAssetMetadata(asset);
  if (!metadata.business.allowAi) return <span className="asset-information-status">仅手动使用</span>;
  if (metadata.business.confirmed) return <span className="asset-information-status confirmed"><CheckCircle2 size={11} />对象已确认</span>;
  if (metadata.analysis.status !== 'ready' && !metadata.business.note.trim()) return <span className="asset-information-status">待补充说明</span>;
  return null;
}
