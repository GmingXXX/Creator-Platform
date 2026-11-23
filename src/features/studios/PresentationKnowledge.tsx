import {useState} from 'react';
import {WorkspaceManagement} from '../workspace/WorkspaceManagement';
import {presentationKnowledgeDocuments,type KnowledgeAnswerSource} from '../../domain/presentation-demo-knowledge';
import {Database} from 'lucide-react';
import type {Work} from '../../domain/types';
import {useStudio} from '../../domain/store';
import {presentationKnowledgeStatus,selectPresentationKnowledge,type PresentationKnowledgeReference} from '../../domain/presentation-knowledge';
import './presentation-knowledge.css';
export function PresentationKnowledgeSettings({work,reference,onChange,onError}:{work:Work;reference?:PresentationKnowledgeReference;onChange:(reference?:PresentationKnowledgeReference)=>void;onError:(message:string)=>void}) {
 const state=useStudio(),status=presentationKnowledgeStatus(state,work,reference),[manage,setManage]=useState(false);
 const documents=presentationKnowledgeDocuments(state,work,reference),spaceLabel=(work.workspaceId||'personal')==='personal'?'个人空间':'项目空间';
 const select=()=>{try{onChange(selectPresentationKnowledge(useStudio.getState(),work));onError('');}catch(error){onError(error instanceof Error?error.message:'无法引用知识本地场');}};
 return <section className="presentation-knowledge" aria-label="问答知识本地场">
  <header><strong><Database size={14}/>知识本地场</strong><span>{status.state==='demo-ready'||status.state==='demo-available'?'模拟绑定':'ACP 未连接'}</span></header>
  <p className="presentation-knowledge-name">{status.fieldName||`当前${spaceLabel}未绑定`}</p>
  {'fieldId' in status&&status.fieldId&&<p className="studio-muted">知识本地场id：{status.fieldId}</p>}
  <label className="presentation-checkbox"><input type="checkbox" aria-label={`引用${spaceLabel}知识本地场`} checked={!!reference} disabled={!reference&&!status.canSelect} onChange={event=>event.target.checked?select():onChange(undefined)}/>引用{spaceLabel}知识本地场</label>
  <p className="studio-muted" role="status">{status.notice}</p>
  {status.state==='changed'&&<button type="button" onClick={select}>重新确认当前知识本地场</button>}
  {documents.length>0&&<details><summary>可用资料 · {documents.length} 份</summary><ul>{documents.map(doc=><li key={doc.url}>{doc.name}</li>)}</ul><p className="studio-muted">检索范围为当前模拟知识本地场中的以上资料，不包含其他空间上传的文件。</p></details>}
  <button type="button" onClick={()=>setManage(true)}>前往管理空间{status.state==='unbound'?'绑定':''}</button>
  {manage&&<WorkspaceManagement open initialWorkspaceId={work.workspaceId||'personal'} initialTab="knowledge" onClose={()=>setManage(false)}/>}
 </section>;
}
export function PresentationKnowledgeNotice({work,reference}:{work:Work;reference?:PresentationKnowledgeReference}) {
 const state=useStudio();if(!reference)return null;
 const status=presentationKnowledgeStatus(state,work,reference);
 return <p className="presentation-knowledge-notice" role="status">{status.notice}</p>;
}

export function PresentationKnowledgeSources({sources}:{sources:KnowledgeAnswerSource[]}){
 return sources.length?<ul className="presentation-answer-sources" aria-label="知识资料出处">{sources.map((source,index)=><li key={`${source.url}-${source.location}`}><a href={`${import.meta.env.BASE_URL||'/'}${source.url.replace(/^\//,'')}`} target="_blank" rel="noreferrer">[{index+1}] {source.name} · {source.location}</a></li>)}</ul>:null;
}
