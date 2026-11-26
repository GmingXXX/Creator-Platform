import {useComposerShortcuts} from './home/useComposerShortcuts';
import {startSession} from '../domain/creation-session';
import {ReferenceManager,ReferenceSummary,type ReferenceManagerHandle} from './conversation/ReferenceManager';
import {captureKnowledgeTarget} from '../domain/workspace-knowledge';
import {importWorkspaceFile} from '../domain/workspace-upload';
import {KnowledgeFieldContext} from './workspace/KnowledgeTargetNotice';
import {workspaceCanEdit} from '../domain/workspace-management';
// Input state, auto-resize and toolbar slots adapted from 21st Input Bar.
// Reference source is retained in output/21st组件参考源码/input-bar.
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Paperclip, ChevronDown, Check, Palette, Zap, X, File, PackageOpen, ArrowUpRight, LoaderCircle, Folder } from 'lucide-react';
import { attachAssetToDraft, useStudio } from '../domain/store';
import {useAIModels} from '../domain/ai-client';
import {VoiceInput} from './home/VoiceInput';
import {joinDictation} from './home/home-logic';
import '../styles/home-v15.css';
import {ComposerAttachments} from './attachments/ComposerAttachments';
import {collectDroppedFiles,filesWithPaths,prepareFolderPackages,describeAttachment,type AttachmentFile} from '../domain/attachment-intake';
import { Artwork } from '../components/Artwork';
import { Popover, Modal, Badge, SearchInput, toast } from '../components/ui';

const rotatingPlaceholders = [
 '描述你想创作的内容主题、形式与目标受众…',
 '例如：为新品发布制作一套 10 页智能演示与讲解稿…',
 '例如：整理核心产品亮点与案例，生成可交互展示页…',
 '例如：用 60 秒图文叙事视频拆解行业趋势与数据…',
];

export function Composer({compact=false}:{compact?:boolean}){
 const modelConfig=useAIModels();
 const sendShortcutId=useId();
 const [voiceActive,setVoiceActive]=useState(false),[sending,setSending]=useState(false),[placeholderIndex,setPlaceholderIndex]=useState(0);
 const sendLock=useRef(false);
 const state=useStudio(),draft=state.drafts.find(d=>d.id===state.activeDraftId)||state.drafts[0],navigate=useNavigate();
 const [uploading,setUploading]=useState(false),[drag,setDrag]=useState(false),[modelSearch,setModelSearch]=useState(''),[referenceOpen,setReferenceOpen]=useState(false),[uploadErrors,setUploadErrors]=useState<string[]>([]);
 const referenceManager=useRef<ReferenceManagerHandle>(null);
 const fileInput=useRef<HTMLInputElement>(null),folderInput=useRef<HTMLInputElement>(null),textarea=useRef<HTMLTextAreaElement>(null),uploadLock=useRef(false);
 const shortcuts=useComposerShortcuts(draft,textarea,uploading||sending||voiceActive||!workspaceCanEdit(state,draft?.workspaceId||'personal'),()=>referenceManager.current?.manage());
 useEffect(()=>{if(!textarea.current)return;textarea.current.style.height='0';textarea.current.style.height=`${Math.max(compact?70:100,Math.min(220,textarea.current.scrollHeight))}px`},[draft?.text,compact]);
 useEffect(()=>{if(compact||voiceActive||draft?.text)return;const id=window.setInterval(()=>setPlaceholderIndex(i=>(i+1)%rotatingPlaceholders.length),4200);return()=>window.clearInterval(id);},[compact,voiceActive,draft?.text]);
 useEffect(()=>{if(draft&&!['deepseek-flash','deepseek-v4-pro','demo'].includes(draft.model))useStudio.getState().updateDraft({model:'deepseek-flash'});},[draft?.id,draft?.model]);
 if(!draft)return null;
 const selectedSystem=state.systems.find(s=>s.id===draft.styleId);
 const uiReference=(draft.references||[]).find(item=>item.dimension==='ui');
 const attach=async(getFiles:()=>Promise<AttachmentFile[]>)=>{
  if(uploadLock.current||sendLock.current)return;
  const targetDraftId=draft.id,targetWorkspaceId=draft.workspaceId||'personal',knowledgeTarget=captureKnowledgeTarget(useStudio.getState(),targetWorkspaceId);uploadLock.current=true;setUploading(true);setUploadErrors([]);
  let count=0;const errors:string[]=[];
  try{const entries=await prepareFolderPackages(await getFiles());
   for(const entry of entries){try{const info=await describeAttachment(entry.file);const asset=await importWorkspaceFile(entry.file,targetWorkspaceId,knowledgeTarget);attachAssetToDraft(targetDraftId,{...asset,workspaceId:targetWorkspaceId,intake:{relativePath:entry.relativePath,folder:entry.relativePath.includes('/')?entry.relativePath.split('/')[0]:undefined,batchId:batchId,...info}});count++;}catch(error){errors.push(`${entry.relativePath}：${error instanceof Error?error.message:'文件添加失败'}`);}}
   if(count)toast(`已为原创作草稿添加 ${count} 个文件`);else if(!errors.length)toast('未发现可添加的文件',true);
  }catch(error){errors.push(error instanceof Error?error.message:'文件夹读取失败，请重新添加');}
  finally{setUploadErrors(errors);uploadLock.current=false;setUploading(false);if(fileInput.current)fileInput.current.value='';if(folderInput.current)folderInput.current.value='';}
 };
 const batchId=`attachments-${draft.id}-${Date.now()}`;
 const removeAttachments=(ids:string[])=>{const targetId=draft.id;useStudio.setState(current=>({drafts:current.drafts.map(item=>item.id===targetId&&workspaceCanEdit(current,item.workspaceId||'personal')?{...item,attachmentIds:item.attachmentIds.filter(id=>!ids.includes(id)),updatedAt:new Date().toISOString()}:item)}));};
 const send=async()=>{
  const current=useStudio.getState(),active=current.drafts.find(d=>d.id===current.activeDraftId);
  if(uploading||sendLock.current||!active?.text.trim()||!workspaceCanEdit(current,active.workspaceId||'personal'))return;
  sendLock.current=true;setSending(true);
  try{
   const session=startSession(active.id);
   navigate(`/create/${session.id}`);
  }catch(cause){toast(cause instanceof Error?cause.message:'知识资料读取失败，请重试',true);}
  finally{sendLock.current=false;setSending(false);}
 };
 const activeSkills=state.skills.filter(s=>draft.skillIds.includes(s.id));

 return <><div className={`composer ${drag?'composer-drag':''} ${compact?'composer-compact':''} ${voiceActive?'composer-voice-active':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDrag(false)}} onDrop={e=>{e.preventDefault();setDrag(false);if(uploadLock.current||sendLock.current)return;const pending=collectDroppedFiles(e.dataTransfer);void attach(()=>pending)}}>
 <ReferenceSummary references={draft.references||[]} onClick={()=>referenceManager.current?.manage()} onRemove={ids=>state.updateDraft({references:(draft.references||[]).filter(item=>!ids.includes(item.id))})} disabled={uploading||voiceActive||!workspaceCanEdit(state,draft.workspaceId||'personal')}/>
 {uiReference&&selectedSystem&&<div className="composer-style-conflict" role="status"><span>已参考「{uiReference.sourceTitle}」的 UI 风格，将优先于当前设计风格「{selectedSystem.name}」（后者仅作兜底）。</span><button type="button" disabled={uploading||sending||voiceActive} onClick={()=>state.updateDraft({styleId:''})}>移除设计风格</button></div>}
 {(draft.reference||draft.attachmentIds.length>0||activeSkills.length>0)&&<div className="composer-context">{draft.reference&&<div className="reference-chip"><PackageOpen size={18}/><button onClick={()=>setReferenceOpen(true)}><strong>同款创作资料包</strong><small>{draft.reference.files.length} 个文件 · {draft.reference.skillIds.length} 项技能 · v{draft.reference.version}</small></button><button aria-label="移除参考资料包" onClick={()=>state.updateDraft({reference:undefined})}><X size={14}/></button></div>}<ComposerAttachments assets={state.assets.filter(asset=>draft.attachmentIds.includes(asset.id))} onRemove={removeAttachments}/>{activeSkills.map(s=><span className="skill-chip" key={s.id} title={`${s.name} · v${s.version}`}><Zap size={12}/>{s.name}<button aria-label={`移除技能 ${s.name}`} onClick={()=>state.updateDraft({skillIds:draft.skillIds.filter(i=>i!==s.id)})}><X size={12}/></button></span>)}</div>}
 {sending&&<div className="attachment-import-status" role="status">正在准备创作资料…</div>}{uploading&&<div className="attachment-import-status" role="status">正在读取资料与目录，请稍候…</div>}{uploadErrors.length>0&&<div className="attachment-import-errors" role="alert">{uploadErrors.map((message,index)=><p key={index}>{message}</p>)}</div>}
 <div className="composer-shortcut-anchor"><textarea ref={textarea} aria-label="创作需求" placeholder={compact?'描述你想创作的内容…':''} disabled={voiceActive||sending||!workspaceCanEdit(state,draft.workspaceId||'personal')} value={draft.text} {...shortcuts.inputProps} onKeyDown={e=>{if(shortcuts.onKeyDown(e))return;if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/>{!compact&&!draft.text&&!voiceActive&&<AnimatePresence mode="wait"><motion.span key={placeholderIndex} className="composer-rotating-placeholder" aria-hidden="true" initial={{opacity:0,y:3}} animate={{opacity:0.72,y:0}} exit={{opacity:0,y:-3}} transition={{duration:0.24}}>{rotatingPlaceholders[placeholderIndex]}</motion.span></AnimatePresence>}{shortcuts.menu}</div>
 <div className="composer-toolbar"><div className="composer-tools"><Popover trigger={<button className="composer-tool upload-control" title="添加文件或文件夹" aria-label="上传文件" disabled={uploading||sending}>{uploading?<LoaderCircle className="spinner" size={17}/>:<Paperclip size={18}/>}</button>}><button className="option-row" data-popover-close onClick={()=>fileInput.current?.click()}><File size={16}/>添加文件</button><button className="option-row" data-popover-close onClick={()=>folderInput.current?.click()}><Folder size={16}/>添加文件夹</button></Popover><input ref={fileInput} aria-label="添加文件" type="file" multiple hidden accept="image/*,video/*,audio/*,.pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.json,.html,.htm,.zip" onChange={e=>{const files=[...(e.target.files||[])];void attach(async()=>filesWithPaths(files))}}/><input ref={folderInput} aria-label="添加文件夹" type="file" multiple hidden {...{webkitdirectory:'',directory:''}} onChange={e=>{const files=[...(e.target.files||[])];void attach(async()=>filesWithPaths(files))}}/>

 <ReferenceManager ref={referenceManager} key={draft.id} workspaceId={draft.workspaceId||'personal'} references={draft.references||[]} onChange={references=>state.updateDraft({references})} disabled={uploading||voiceActive||!workspaceCanEdit(state,draft.workspaceId||'personal')}/>
 <span className="tool-divider"/>
 <Popover trigger={<button className={`composer-tool${selectedSystem?' is-armed':''}`} aria-label="设计风格" title={selectedSystem?.name||'设计风格'}><Palette size={16}/><span>{selectedSystem?.name||'设计风格'}</span><ChevronDown size={13}/></button>}><div className="menu-caption">为本次创作选择风格</div><button className={`design-none-option ${!draft.styleId?'selected':''}`} data-popover-close onClick={()=>state.updateDraft({styleId:''})}>无{!draft.styleId&&<Check size={14}/>}</button><div className="design-picker-grid">{state.systems.map(s=><button key={s.id} data-popover-close className={s.id===draft.styleId?'selected':''} onClick={()=>state.updateDraft({styleId:s.id})}><Artwork type="timeline" styleId={s.id} title={s.name}/><span>{s.name}{s.id===draft.styleId&&<Check size={13}/>}</span></button>)}</div><button className="picker-browse" onClick={()=>navigate('/design-systems')}>浏览完整设计风格<ArrowUpRight size={14}/></button></Popover>
 <KnowledgeFieldContext workspaceId={draft.workspaceId||'personal'}/>

 </div><div className="composer-send-tools"><Popover trigger={<button className="composer-tool model-control" aria-label="选择大模型"><span className="model-icon">D</span><span>{modelConfig.models.find(m=>m.id===draft.model)?.label||draft.model}</span><ChevronDown size={13}/></button>}><div className="menu-caption">选择大模型</div><SearchInput value={modelSearch} onChange={setModelSearch} placeholder="搜索模型"/>{modelConfig.models.filter(m=>`${m.label}${m.id}`.toLowerCase().includes(modelSearch.toLowerCase())).map(m=><button key={m.id} className={`option-row ${draft.model===m.id?'active':''}`} data-popover-close onClick={()=>state.updateDraft({model:m.id})}><span className="model-badge">{m.id==='demo'?'演':'D'}</span><span>{m.label}<small>{m.id==='demo'?'离线示例，不调用真实模型':'用于需求理解与创作编排'}</small></span>{draft.model===m.id&&<Check size={16}/>}</button>)}<p className="picker-footnote">{modelConfig.loading?'正在检查模型服务…':modelConfig.available?'已连接模型服务':modelConfig.error||'模型服务尚未连接，真实调用不会自动切换为演示。'}</p></Popover><VoiceInput key={draft.id} sessionKey={draft.id} disabled={uploading||sending} onActiveChange={setVoiceActive} onResult={(text,submit)=>{const latest=useStudio.getState();if(latest.activeDraftId!==draft.id)return;const current=latest.drafts.find(item=>item.id===draft.id);if(!current)return;latest.updateDraft({text:joinDictation(current.text,text)});if(submit)send();else textarea.current?.focus();}}/><span className="composer-send-shortcut"><button className="composer-send" onClick={send} disabled={!draft.text.trim()||uploading||voiceActive||sending} aria-label="发送创作需求" aria-describedby={sendShortcutId}><ArrowUp size={21}/></button><span id={sendShortcutId} role="tooltip">Enter 发送，Shift + Enter 换行</span></span></div></div>{drag&&<div className="drop-hint"><Paperclip size={26}/><strong>松开以添加创作资料</strong><span>文件或文件夹 · 组件和技能 ZIP 完整保留</span></div>}</div>

 <Modal open={referenceOpen} onClose={()=>setReferenceOpen(false)} title="本次同款创作的参考资料" wide>{draft.reference&&<div className="reference-detail"><div><Badge>版本 {draft.reference.version}</Badge><h3>创作提示词</h3><p>{draft.reference.prompt}</p><h3>生成参数</h3><div className="parameter-list">{Object.entries(draft.reference.params).map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><h3>关联 Skills</h3>{draft.reference.skillIds.map(id=><Badge key={id}>{state.skills.find(s=>s.id===id)?.name||id}</Badge>)}</div><div><h3>资产与源文件 · {draft.reference.files.length}</h3>{draft.reference.files.map((f,i)=><div className="package-file" key={i}><File size={16}/><span>{f.name}<small>{f.type}</small></span><Check size={14}/></div>)}</div></div>}</Modal>
 </>;
}
