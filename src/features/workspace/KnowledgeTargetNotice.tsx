import {useState} from 'react';
import {Database} from 'lucide-react';
import {useStudio} from '../../domain/store';
import {captureKnowledgeTarget,isDemoKnowledgeBinding,type KnowledgeTarget} from '../../domain/workspace-knowledge';
import {WorkspaceManagement} from './WorkspaceManagement';
import '../../styles/knowledge-target.css';

/** A local routing record, deliberately distinct from an ACP ingestion receipt. */
export function KnowledgeTargetNotice({target,historical=false}:{target:KnowledgeTarget;historical?:boolean}){
 const spaces=useStudio(state=>state.workspaces),space=spaces.find(item=>item.id===target.workspaceId);
 const personal=target.state==='personal',bound=target.state==='not-connected',demo=isDemoKnowledgeBinding(target);
 return <div className="knowledge-target-notice" data-testid="knowledge-target-notice">
  <Database size={15}/><div><strong>{historical?'上传时归属':'本次资料归属'}：{space?.name||(personal?'个人空间':'原项目空间')}</strong>
   <span>{personal?(historical?'上传时未绑定个人知识本地场':'个人空间尚未绑定知识本地场'):bound?`${demo?'模拟知识本地场':'ACP目标'}：${target.fieldName}`:historical?'上传时未绑定ACP知识本地场':'尚未绑定ACP知识本地场'}</span>
   <small>{bound?(demo?'模拟绑定 · 文件仅保存在智创，不会提交真实ACP':'ACP未连接 · 文件仅保存在智创，尚未提交ACP'):personal?'文件保存在智创个人素材库。':'文件仅保存在智创；绑定后不会自动补传历史文件。'}</small>
  </div>
 </div>;
}

export function KnowledgeFieldContext({workspaceId}:{workspaceId:string}){
 const state=useStudio(),[open,setOpen]=useState(false);
 if(!state.workspaces.some(space=>space.id===workspaceId))return null;
 const target=captureKnowledgeTarget(state,workspaceId),demo=isDemoKnowledgeBinding(state.workspaceKnowledge[workspaceId]);
 return <><button type="button" className="composer-tool knowledge-field-context" title={`知识本地场：${target.fieldName||'未绑定'} · ${demo?'模拟资料':'ACP未连接'}`} aria-label="查看知识本地场绑定" onClick={()=>setOpen(true)}>
  <Database size={14}/><span>{target.fieldName||'知识本地场未绑定'}</span><small>{demo?'模拟':'ACP未连接'}</small>
 </button>{open&&<WorkspaceManagement initialWorkspaceId={workspaceId} initialTab="knowledge" open onClose={()=>setOpen(false)}/>}</>;
}
