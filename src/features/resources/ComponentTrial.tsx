import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Monitor, Smartphone } from 'lucide-react';
import { applyComponentValues, type ComponentField, type ComponentInspection } from '../../domain/component-import';
import { Button } from '../../components/ui';
import { instrumentComponentPreview, isComponentReply } from './component-preview';

export type ComponentValues = Record<string, string | number | boolean>;
export interface TrialStatus { loaded: boolean; connected: boolean; applied: boolean; error: string; timedOut: boolean }
const initialStatus: TrialStatus = { loaded: false, connected: false, applied: false, error: '', timedOut: false };

export function ComponentTrial({ inspection, values, onChange, onStatus }: {
  inspection: ComponentInspection; values: ComponentValues;
  onChange: (values: ComponentValues) => void; onStatus: (status: TrialStatus) => void;
}) {
  const [reload, setReload] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const editable = inspection.bridge !== null && inspection.fields.length > 0;
  useEffect(() => { onStatus(status); }, [status, onStatus]);
  return <div className="component-trial-grid">
    <section className="component-trial-stage" aria-label="运行预览">
      <div className="component-trial-toolbar"><strong>运行预览</strong><div>
        <Button size="icon" variant="ghost" aria-label="横屏预览" aria-pressed={!narrow} onClick={() => setNarrow(false)}><Monitor size={16}/></Button>
        <Button size="icon" variant="ghost" aria-label="窄屏预览" aria-pressed={narrow} onClick={() => setNarrow(true)}><Smartphone size={16}/></Button>
        <Button size="sm" variant="ghost" onClick={() => { setStatus(initialStatus); setReload(v => v + 1); }}><RotateCcw size={14}/>重新加载</Button>
      </div></div>
      <div className={`component-trial-screen ${narrow ? 'is-narrow' : ''}`}>
        <TrialFrame key={reload} inspection={inspection} values={values} onStatus={setStatus}/>
      </div>
      <p className={`component-trial-status ${status.error ? 'has-error' : ''}`} role="status">
        {status.error || (status.connected ? status.applied ? '组件已接收当前参数，请确认实际显示效果。' : '正在应用修改…' : status.timedOut ? editable ? '未连接到编辑接口，请检查组件包中的订阅代码后重试。' : '预览未能完成加载，请检查资源后重试。' : status.loaded ? editable ? '预览已加载，正在连接编辑接口…' : '预览文档已加载，请检查画面与交互效果。' : '正在加载预览…')}
      </p>
    </section>
    <aside className="component-trial-controls">
      <h3>{editable ? '试编辑' : '编辑范围'}</h3>
      {editable ? <>
        <p>修改组件开放的参数，左侧实时预览。</p>
        <fieldset disabled={!status.connected || Boolean(status.error)}>
          {inspection.fields.map(field => <ComponentControl key={field.key} field={field} value={values[field.key]} onChange={value => onChange({ ...values, [field.key]: value })}/>)}
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...inspection.defaults })}><RotateCcw size={13}/>恢复默认参数</Button>
        </fieldset>
        <p className="component-trial-note">试编辑结果会作为默认配置保存。进入画布后仍以嵌入组件运行，可调整位置和尺寸，内部元素不会拆分。</p>
      </> : <div className="component-outer-note"><strong>仅支持外层编辑</strong><p>可在画布调整位置、尺寸与层级。这个文件没有提供可编辑参数，内部内容需在原程序中修改。</p></div>}
    </aside>
  </div>;
}

function ComponentControl({ field, value, onChange }: { field: ComponentField; value: string | number | boolean; onChange: (value: string | number | boolean) => void }) {
  if (field.type === 'boolean') return <label className="component-boolean"><input aria-label={field.label} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)}/><span>{field.label}</span></label>;
  return <label className="component-field"><span>{field.label}</span>{field.type === 'textarea'
    ? <textarea aria-label={field.label} rows={3} maxLength={4000} value={String(value ?? '')} onChange={e => onChange(e.target.value)}/>
    : <input aria-label={field.label} type={field.type === 'number' ? 'number' : field.type === 'color' ? 'color' : 'text'} min={field.min} max={field.max} maxLength={500} value={String(value ?? '')} onChange={e => {
      if (field.type !== 'number') { onChange(e.target.value); return; }
      const next = e.target.valueAsNumber;
      if (Number.isFinite(next)) onChange(Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, next)));
    }}/>}</label>;
}

function TrialFrame({ inspection, values, onStatus }: { inspection: ComponentInspection; values: ComponentValues; onStatus: (status: TrialStatus) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => crypto.randomUUID());
  const [initialValues] = useState(values);
  const state = useRef({ ...initialStatus });
  const latest = useRef(values);
  latest.current = values;
  const requestId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editable = inspection.bridge !== null && inspection.fields.length > 0;
  const document = useMemo(() => instrumentComponentPreview(
    editable ? applyComponentValues(inspection.html, inspection.fields, initialValues) : inspection.html, channel
  ), [inspection, initialValues, channel, editable]);
  const publish = (patch: Partial<TrialStatus>) => { state.current = { ...state.current, ...patch }; onStatus(state.current); };
  const send = (type: 'init' | 'props') => {
    if (!editable || !frame.current?.contentWindow || state.current.error) return;
    const id = ++requestId.current;
    publish({ applied: false });
    frame.current.contentWindow.postMessage({ type: `zhichuang:component:${type}`, channel, props: latest.current, requestId: id }, '*');
    clearTimeout(requestTimer.current);
    requestTimer.current = setTimeout(() => {
      if (requestId.current === id && !state.current.applied) publish({ timedOut: true, error: type === 'props' ? '组件未确认这次修改，请重新加载后再试。' : '' });
    }, 8000);
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!isComponentReply(event, frame.current?.contentWindow, channel)) return;
      const data = event.data;
      if (data.type === 'zhichuang:preview:error') { publish({ error: String(data.message || '组件运行出错，请检查文件后重试。').slice(0,240) }); return; }
      if (data.type === 'zhichuang:preview:loaded') { publish({ loaded: true }); return; }
      if (data.requestId !== requestId.current || !editable || state.current.error) return;
      clearTimeout(requestTimer.current);
      if (data.type === 'zhichuang:component:error') publish({ error: String(data.message || '组件无法应用参数').slice(0,240), applied: false });
      else publish({ connected: true, applied: true, loaded: true, timedOut: false });
    };
    window.addEventListener('message', receive);
    const loadTimer = setTimeout(() => { if (!state.current.loaded) publish({ timedOut: true }); }, 10000);
    return () => { window.removeEventListener('message', receive); clearTimeout(loadTimer); clearTimeout(requestTimer.current); };
  // This component is remounted for each new preview session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, editable]);
  useEffect(() => { if (state.current.connected) send('props'); }, [values]);
  return <iframe ref={frame} title="组件运行预览" srcDoc={document} sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={() => send('init')}/>;
}
