import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, Download, FileCode2, LoaderCircle, Upload } from 'lucide-react';
import { applyComponentValues, createExampleComponentPackage, type ComponentInspection } from '../../domain/component-import';
import type { ComponentImportRecord } from '../../domain/types';
import { Button, Modal, downloadBlob, toast } from '../../components/ui';
import { ComponentTrial, type ComponentValues, type TrialStatus } from './ComponentTrial';
import '../../styles/component-import.css';

export interface ComponentImportResult {
  html: string; name: string; description: string; componentImport: ComponentImportRecord;
}

export function ComponentImportDialog({ inspection, workspaceLabel, onCancel, onReplace, onEntryChange, onSave, saveLabel = '保存到素材库', title = '导入组件', description: dialogDescription = '先检查文件，再预览效果；确认保存前不会加入素材库。', extraAction, allowReplace = true, open = true }: {
  inspection: ComponentInspection; workspaceLabel: string; onCancel: () => void;
  onReplace: (file: File) => Promise<void>;
  onEntryChange: (entry: string) => Promise<void>;
  onSave: (result: ComponentImportResult) => Promise<void>;
  saveLabel?: string; title?: string; description?: string; extraAction?: ReactNode; allowReplace?: boolean; open?: boolean;
}) {
  const [step, setStep] = useState<'check' | 'preview'>('check');
  const [name, setName] = useState(inspection.name);
  const [description, setDescription] = useState(inspection.description);
  const [values, setValues] = useState<ComponentValues>({ ...inspection.defaults });
  const [status, setStatus] = useState<TrialStatus>({ loaded: false, connected: false, applied: false, error: '', timedOut: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const editable = Boolean(inspection.bridge && inspection.fields.length);
  const ready = status.loaded && !status.error && (!editable || status.connected && status.applied);
  const updateValues = useCallback((next: ComponentValues) => { setValues(next); setStatus(previous => ({ ...previous, applied: false })); }, []);
  const replace = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { await onReplace(file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '文件读取失败，请重新选择。'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const save = async () => {
    if (!ready || busy || !name.trim()) return;
    setBusy(true); setError('');
    try {
      const html = editable ? applyComponentValues(inspection.html, inspection.fields, values) : inspection.html;
      await onSave({ html, name: name.trim(), description: description.trim(), componentImport: {
        filename: inspection.filename, source: inspection.source, fields: inspection.fields,
        values: { ...values }, checks: inspection.checks,
        runtime: editable ? 'parameters-connected' : 'preview-loaded', offline: 'unverified', checkedAt: new Date().toISOString(),
      } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  };
  return <Modal open={open} wide title={title} description={dialogDescription} onClose={() => !busy && onCancel()} footer={<>
    <span className="component-footer-note">保存到{workspaceLabel} · 不自动发布</span>
    <Button variant="ghost" disabled={busy} onClick={onCancel}>取消</Button>
    {step === 'preview' && <Button disabled={busy} onClick={() => setStep('check')}>返回检查</Button>}
    {step === 'check' ? <Button variant="primary" disabled={!inspection.canPreview || busy} onClick={() => { setStatus({ loaded: false, connected: false, applied: false, error: '', timedOut: false }); setStep('preview'); }}>预览与试编辑<ArrowRight size={15}/></Button>
      : <Button variant="primary" disabled={!ready || !name.trim() || busy} onClick={() => void save()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>} {busy ? '正在保存…' : saveLabel}</Button>}
  </>}>
    <div className="component-import" data-testid="component-import">
      <ol className="component-import-steps" aria-label="导入步骤"><li className={step === 'check' ? 'active' : 'done'} aria-current={step === 'check' ? 'step' : undefined}><span>{step === 'check' ? '1' : <Check size={12}/>}</span>检查组件</li><li className={step === 'preview' ? 'active' : ''} aria-current={step === 'preview' ? 'step' : undefined}><span>2</span>预览与试编辑</li></ol>
      <div className="component-import-file"><FileCode2 size={22}/><div><strong>{inspection.filename}</strong><span>{inspection.source === 'package' ? inspection.hasManifest ? '含编辑说明的组件 ZIP' : 'HTML 资源 ZIP' : '单文件 HTML'}</span></div>{extraAction}{allowReplace && <Button variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}><Upload size={14}/>重新上传</Button>}</div>
      {error && <p className="component-import-error" role="alert"><AlertCircle size={15}/>{error}</p>}
      {step === 'check' ? <>
        {Boolean(inspection.entryOptions?.length) && <label className="component-field"><span>HTML 入口</span><select aria-label="HTML 入口" disabled={busy} value={inspection.entryPath || ''} onChange={async event => {
          if (!event.target.value) return;
          setBusy(true); setError('');
          try { await onEntryChange(event.target.value); }
          catch (cause) { setError(cause instanceof Error ? cause.message : '入口检查失败，请重试。'); }
          finally { setBusy(false); }
        }}><option value="" disabled>请选择运行入口</option>{inspection.entryOptions!.map(entry => <option key={entry} value={entry}>{entry}</option>)}</select></label>}
        <div className="component-check-summary"><h3>{inspection.canPreview ? '文件检查完成，可以进入预览' : inspection.entryOptions?.length && !inspection.entryPath ? '选择入口后检查关联资源' : '需要补齐文件后再预览'}</h3><p>{inspection.canPreview ? '这里只检查文件与接口声明，实际效果将在下一步验证。' : '当前文件尚未保存。根据提示选择入口或补齐资源，再继续预览。'}</p></div>
        <div className="component-checks">{inspection.checks.map((check, index) => <div className={`component-check ${check.status}`} key={`${check.id}-${index}`}>{check.status === 'pass' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}<div><strong>{check.title}</strong><p>{check.detail}</p></div><span>{check.status === 'pass' ? '已检查' : check.status === 'error' ? '待处理' : '需确认'}</span></div>)}</div>
        <details className="component-technical"><summary>技术详情与组件规范</summary><p>{inspection.bridge ? `编辑协议：${inspection.bridge}` : '未声明编辑协议，按普通 HTML 嵌入。'}</p><p>开放参数：{inspection.fields.map(field => field.label).join('、') || '无'}</p>{inspection.dependencies.length > 0 && <><p>引用的外部依赖与资源：</p><ul>{inspection.dependencies.map((dependency, index) => <li key={index}>{dependency}</li>)}</ul></>}<p>上传包含 HTML、脚本、样式和静态资源的 ZIP 即可，不强制提供 component.json；只有需要参数试编辑时，才需补充编辑说明与接口。需要构建或复杂动态加载的工程，本轮会提示具体限制。</p><p>本轮限制：ZIP 50 MB，解压后 40 MB，单个资源 12 MB，HTML 5 MB，最多 250 个文件或目录。</p><ComponentExampleDownload/></details>
      </> : <>
        <ComponentTrial inspection={inspection} values={values} onChange={updateValues} onStatus={setStatus}/>
        <div className="component-save-fields"><label className="component-field"><span>组件名称</span><input value={name} maxLength={80} onChange={event => setName(event.target.value)}/></label><label className="component-field"><span>用途说明</span><input value={description} maxLength={300} placeholder="例如：展示企业成果，支持修改标题与数据" onChange={event => setDescription(event.target.value)}/></label></div>
        <p className="component-save-note">保存的是当前预览配置，不会自动修改已有作品。预览加载与参数响应不能替代实际效果检查。</p>
      </>}
      <input ref={input} className="res-sr-only" type="file" accept=".html,.htm,.zip" aria-label="重新上传组件文件" onChange={event => void replace(event.target.files?.[0])}/>
    </div>
  </Modal>;
}

export function ComponentExampleDownload() {
  const [busy, setBusy] = useState(false);
  return <Button variant="ghost" size="sm" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      const bytes = await createExampleComponentPackage();
      downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), '智创组件包示例.zip');
    } catch { toast('示例包下载失败，请重试', true); }
    finally { setBusy(false); }
  }}><Download size={14}/>{busy ? '正在准备…' : '下载组件包示例'}</Button>;
}
