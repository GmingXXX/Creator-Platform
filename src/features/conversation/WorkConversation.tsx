import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Check, File, LoaderCircle, Paperclip, RotateCcw, Sparkles, Target, X, Square } from 'lucide-react';
import type { Asset, EditTarget, Work } from '../../domain/types';
import { useStudio } from '../../domain/store';
import { useMedia } from '../../domain/upload';
import { importWorkspaceFile } from '../../domain/workspace-upload';
import { captureKnowledgeTarget } from '../../domain/workspace-knowledge';
import { toast } from '../../components/ui';
import { DEFAULT_EDIT_MODEL, reviseWorkWithAI } from '../../domain/ai-revision';
import { useAIModels } from '../../domain/ai-client';
import '../../styles/conversation-ai.css';
import {ExperiencePanel,type ExperiencePanelHandle} from './ExperiencePanel';
import {ReferenceManager,ReferenceSummary,type ReferenceManagerHandle} from './ReferenceManager';
import {validateReferences,type ExhibitReference} from '../../domain/exhibit-references';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {isExperienceRequest} from '../../domain/creation-experience';

interface WorkConversationProps {
  work: Work;
  target?: EditTarget;
  onTargetChange?: (target: EditTarget) => void;
  onBeforeApply?: () => void;
  onApplied?: (work: Work) => void;
  compact?: boolean;
  children?: ReactNode;
}

const targetValue = (target: EditTarget) => target.scope === 'work' ? 'work' : target.scope === 'page' ? `page:${target.pageId}` : `node:${target.pageId}:${target.nodeId}`;
const parseTarget = (value: string): EditTarget => {
  const [scope, pageId, nodeId] = value.split(':');
  return scope === 'node' ? { scope, pageId, nodeId } : scope === 'page' ? { scope, pageId } : { scope: 'work' };
};

function targetLabel(work: Work, target: EditTarget) {
  if (target.scope === 'work') return '整个作品';
  if(target.pageId==='@story')return work.storyNodes?.find(n=>n.id===target.nodeId)?.title||'故事节点已移除';
  if(target.pageId==='@shots')return work.shots?.find(n=>n.id===target.nodeId)?.title||'分镜已移除';
  const page = work.pages.find(item => item.id === target.pageId);
  if (target.scope === 'page') return page?.name || '页面已移除';
  return page?.nodes.find(node => node.id === target.nodeId)?.name || '组件已移除';
}

function initialDraft(workId: string) {
  try { return sessionStorage.getItem(`zc-followup-${workId}`) || ''; } catch { return ''; }
}

function ReferenceAttachment({ asset, remove, disabled }: { asset: Asset; remove: () => void; disabled?: boolean }) {
  const src = useMedia(asset.src);
  return <div className="attachment-chip">
    {asset.kind === 'image' ? <img src={src} alt="" /> : <File size={14} />}
    <span>{asset.name}</span>
    <button disabled={disabled} aria-label={`移除修改参考 ${asset.name}`} onClick={remove}><X size={12} /></button>
  </div>;
}

export function WorkConversation({ work, target, onTargetChange, onBeforeApply, onApplied, compact = false, children }: WorkConversationProps) {
  const state = useStudio();
  const { models } = useAIModels();
  const [model, setModel] = useState(work.aiModel || DEFAULT_EDIT_MODEL);
  const [error, setError] = useState('');
  const [localTarget, setLocalTarget] = useState<EditTarget>({ scope: 'work' });
  const activeTarget = target || localTarget;
  const [text, setText] = useState(() => initialDraft(work.id));
  const [textWorkId, setTextWorkId] = useState(work.id);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const experiencePanel = useRef<ExperiencePanelHandle>(null);
  const referenceManager = useRef<ReferenceManagerHandle>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const contextScroll = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestController = useRef<AbortController | null>(null);
  const latestBeforeApply = useRef(onBeforeApply); latestBeforeApply.current = onBeforeApply;
  const uploadLock = useRef(false), sendLock = useRef(false), currentWork = useRef(work.id);
  currentWork.current = work.id;
  const turns = (state.conversationTurns || []).filter(turn => turn.workId === work.id);

  useEffect(() => () => { requestController.current?.abort(); }, [work.id]);
  useEffect(() => {
    setText(initialDraft(work.id)); setTextWorkId(work.id); setAttachments([]); setModel(work.aiModel || DEFAULT_EDIT_MODEL); setError(''); setLocalTarget({ scope: 'work' });
    setBusy(false); sendLock.current = false;
  }, [work.id]);
  useEffect(() => {
    if (textWorkId !== work.id) return;
    try { sessionStorage.setItem(`zc-followup-${work.id}`, text); } catch { /* Current input still works without session storage. */ }
  }, [text, textWorkId, work.id]);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = '0';
    textarea.current.style.height = `${Math.max(76, Math.min(180, textarea.current.scrollHeight))}px`;
  }, [text]);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
    const container=contextScroll.current,latestTurn=history.current?.lastElementChild;
    if(container&&latestTurn){
      const viewport=container.getBoundingClientRect(),turn=latestTurn.getBoundingClientRect();
      if(turn.top<viewport.top||turn.bottom>viewport.bottom)container.scrollTop+=turn.top-viewport.top;
    }
  }, [turns.length]);

  const changeTarget = (next: EditTarget) => { setLocalTarget(next); onTargetChange?.(next); };
  const send = async () => {
    if (!text.trim() || sendLock.current || uploading) return;
    if (isExperienceRequest(text)) { experiencePanel.current?.organize(/当前|选中|只整理/.test(text) ? activeTarget : {scope:'work'}); setText(''); return; }
    const workId = work.id, prompt = text.trim(), scope = { ...activeTarget }, attached = [...attachments];
    sendLock.current = true; setBusy(true); setError('');
    try {
      onBeforeApply?.();
      requestController.current?.abort();
      const controller = new AbortController(); requestController.current = controller;
      const result = model !== 'demo'
        ? await reviseWorkWithAI(workId, prompt, scope, attached, controller.signal, () => latestBeforeApply.current?.(), model)
        : state.reviseWork(workId, prompt, scope, attached);
      if (currentWork.current !== workId) return;
      if (result.ok) {
        setText(''); setAttachments([]);
        const updated = useStudio.getState().works.find(item => item.id === workId);
        if (updated) onApplied?.(updated);
      }
      if (!result.ok) setError(result.summary);
      textarea.current?.focus();
    } catch (error) {
      if (currentWork.current === workId) setError(error instanceof Error ? error.message : '修改未完成，内容已保留，请重试');
    } finally {
      if (currentWork.current === workId) { sendLock.current = false; setBusy(false); }
    }
  };

  const undo = (turnId: string) => {
    try {
      onBeforeApply?.();
      const result = state.undoRevision(turnId);
      if (!result.ok) { toast(result.summary, true); return; }
      const updated = useStudio.getState().works.find(item => item.id === work.id);
      if (updated) onApplied?.(updated);
    } catch (error) { toast(error instanceof Error ? error.message : '无法撤销这次修改', true); }
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length || uploadLock.current) return;
    const workId = work.id, workspaceId = work.workspaceId || 'personal';
    uploadLock.current = true; setUploading(true);
    try {
      const knowledgeTarget=captureKnowledgeTarget(useStudio.getState(),workspaceId);
      for (const file of Array.from(files)) {
        try {
          const asset = await importWorkspaceFile(file, workspaceId, knowledgeTarget);
          useStudio.getState().addAsset(asset);
          if (currentWork.current === workId) setAttachments(current => [...current, asset.id]);
        } catch (error) { toast(error instanceof Error ? error.message : '参考文件读取失败', true); }
      }
    } finally {
      uploadLock.current = false; setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const changeReferences = (references:ExhibitReference[]) => {
    onBeforeApply?.();
    const current=useStudio.getState(),latest=current.works.find(item=>item.id===work.id&&!item.deletedAt);
    if(!latest||!workspaceCanEdit(current,latest.workspaceId||'personal'))throw new Error('当前作品不可编辑。');
    const checked=validateReferences(references,current,latest.workspaceId||'personal');
    const removed=(latest.references||[]).filter(item=>item.status==='adopted'&&!checked.some(next=>JSON.stringify(next)===JSON.stringify(item)));
    const referenceHistory=[...(latest.referenceHistory||[]),...removed].filter((item,index,list)=>list.findIndex(other=>JSON.stringify(other)===JSON.stringify(item))===index);
    const next={...latest,references:checked,referenceHistory,...(latest.creationPackage?{creationPackage:{...latest.creationPackage,references:checked,referenceHistory}}:{})};
    useStudio.setState(data=>({works:data.works.map(item=>item.id===work.id?next:item)}));onApplied?.(next);
  };

  return <div className={`work-conversation ${compact ? 'work-conversation-compact' : ''}`}>
    <div ref={contextScroll} className="conversation-context-scroll">
    {!!turns.length && <div ref={history} className="conversation-history" aria-label="作品修改记录" aria-live="polite">
      {turns.map(turn => <article className={`conversation-turn ${turn.status}`} key={turn.id}>
        <div className="turn-request"><p>{turn.prompt}</p><span>{targetLabel(work, turn.target)}</span></div>
        <div className="turn-response">
          <span className="turn-response-icon">{turn.status === 'applied' ? <Check size={13} /> : turn.status === 'reverted' ? <RotateCcw size={13} /> : <Sparkles size={13} />}</span>
          <div><p>{turn.summary}</p><div className="turn-actions">
            {turn.status === 'applied' ? <><span>已应用</span>{turn.afterRevision === work.revision && <button onClick={() => undo(turn.id)}><RotateCcw size={12} />撤销本次修改</button>}</> : <span>{turn.status === 'reverted' ? '已撤销' : '未修改'}</span>}
          </div></div>
        </div>
      </article>)}
    </div>}
    <ExperiencePanel ref={experiencePanel} work={work} target={activeTarget} model={model} disabled={busy} onBeforeApply={onBeforeApply} onApplied={onApplied}/>
    <ReferenceSummary references={work.references||[]} onClick={()=>referenceManager.current?.manage()} onRemove={ids=>changeReferences((work.references||[]).filter(item=>!ids.includes(item.id)))} disabled={busy||!workspaceCanEdit(state,work.workspaceId||'personal')}/>
    {children}
    </div>
    <div className="work-followup-composer">
      <div className="followup-context">
        <Target size={14} />
        <select aria-label="修改范围" value={targetValue(activeTarget)} onChange={event => changeTarget(parseTarget(event.target.value))} disabled={busy}>
          <option value="work">整个作品 · {work.title}</option>
          {work.kind==='story'&&work.storyNodes?.map(node=><option key={node.id} value={`node:@story:${node.id}`}>故事节点 · {node.title}</option>)}
          {work.kind==='video'&&work.shots?.map(shot=><option key={shot.id} value={`node:@shots:${shot.id}`}>分镜 · {shot.title}</option>)}
          {work.kind!=='story'&&work.kind!=='video'&&work.pages.map(page => <optgroup key={page.id} label={page.name}>
            <option value={`page:${page.id}`}>页面 · {page.name}</option>
            {page.nodes.map(node => <option key={node.id} value={`node:${page.id}:${node.id}`} disabled={node.locked}>组件 · {node.name}{node.locked ? '（已锁定）' : ''}</option>)}
          </optgroup>)}
        </select>
        {activeTarget.scope !== 'work' && <button disabled={busy} title="改为整个作品" aria-label="清除修改范围" onClick={() => changeTarget({ scope: 'work' })}><X size={13} /></button>}
      </div>
      {!!attachments.length && <div className="composer-context followup-attachments">{attachments.map(id => {
        const asset = state.assets.find(item => item.id === id);
        return asset ? <ReferenceAttachment key={id} asset={asset} disabled={busy} remove={() => setAttachments(ids => ids.filter(item => item !== id))} /> : null;
      })}</div>}
      <textarea ref={textarea} disabled={busy} aria-label="修改当前作品" value={text} onChange={event => setText(event.target.value)} placeholder={work.kind==='story' ? activeTarget.scope==='node'?'描述对这个故事节点的修改…':'继续修改剧情或分支选项…' : activeTarget.scope === 'node' ? '描述对这个组件的修改…' : '继续修改，例如：把背景改成暖色…'} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void send(); }
      }} />
      <div className="followup-toolbar">
        <ReferenceManager ref={referenceManager} key={work.id} workspaceId={work.workspaceId||'personal'} references={work.references||[]} onChange={changeReferences} disabled={busy}/>
        <button className="composer-tool upload-control" title="上传修改参考" aria-label="上传修改参考" disabled={uploading || busy} onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle className="spinner" size={16} /> : <Paperclip size={17} />}</button>
        <input ref={fileInput} type="file" multiple hidden accept="image/*,video/*,audio/*,.txt,.md,.pdf" onChange={event => void attach(event.target.files)} />
        <select className="followup-model" aria-label="修改模型" value={model} disabled={busy} onChange={event => { setModel(event.target.value); setError(''); }}>
          {models.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {busy ? <button className="composer-send" aria-label="停止修改" title="停止修改" onClick={() => requestController.current?.abort()}><Square size={13} fill="currentColor" /></button> : <button className="composer-send" aria-label="发送修改" disabled={!text.trim() || uploading} onClick={() => void send()}><ArrowUp size={18} /></button>}
      </div>
    </div>
    <p className="followup-status" aria-live="polite">{busy ? '正在修改，原作品已保留…' : model === 'demo' ? '演示模式 · 仅执行预设修改规则' : '修改当前范围内的内容，可撤销'}</p>
    {error && <p className="followup-error" role="alert">{error}</p>}
    {!turns.length && <div className="followup-suggestions">{(work.kind==='story'?['精简当前节点的剧情文案','让这个选项更有吸引力']:work.kind==='presentation'?['把本页讲稿缩短到 20 秒','优化这一页的标题']:work.kind==='video'?['精简这一段的讲述','将分镜时长调整为 10 秒']:['把背景改成暖色', '增加一个 2025 年节点：全球布局']).map(prompt => <button key={prompt} disabled={busy} onClick={() => { setText(prompt); textarea.current?.focus(); }}>{prompt}</button>)}</div>}
  </div>;
}
