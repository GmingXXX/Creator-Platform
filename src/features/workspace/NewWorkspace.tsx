import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, FolderPlus } from 'lucide-react';
import { Button, Modal } from '../../components/ui';
import { useStudio } from '../../domain/store';
import { KnowledgeBindingFields, DemoKnowledgeChoice } from './WorkspaceKnowledge';
import {DEMO_KNOWLEDGE_CATALOG_ID} from '../../domain/workspace-knowledge';
import '../../styles/workspace-members.css';

type Props = { open: boolean; onClose: () => void; onInvite: () => void };

export function NewWorkspace({ open, onClose, onInvite }: Props) {
  const location = useLocation(), navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [demo,setDemo]=useState(false),[demoFieldId]=useState(()=>`demo-${crypto.randomUUID()}`);
  const [fieldName,setFieldName]=useState(''),[fieldId,setFieldId]=useState('');
  const [createdName, setCreatedName] = useState('');
  const [error, setError] = useState('');
  const create = () => {
    try {
      const workspace = useStudio.getState().createWorkspace({ name, description, ...((fieldName.trim()||fieldId.trim())?{knowledgeField:{fieldName,fieldId,...(demo?{demoCatalogId:DEMO_KNOWLEDGE_CATALOG_ID}:{})}}:{}) });
      setCreatedName(workspace.name);
      setError('');
      if (location.pathname.startsWith('/create/')) navigate('/');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '空间创建失败，请重试。'); }
  };
  return <Modal open={open} onClose={onClose} title={createdName ? '空间已创建' : '新建项目空间'}
    description={createdName ? '你是此空间的负责人，可以邀请成员一起创作。' : '为一个客户项目建立共创空间，集中管理作品与共享素材。'}
    footer={createdName ? <><Button onClick={onClose}>先开始创作</Button><Button variant="primary" onClick={onInvite}>邀请成员</Button></> : <><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={create}>创建并进入</Button></>}>
    {createdName ? <div className="workspace-create-success"><CheckCircle2 size={32}/><h3>{createdName}</h3><p>作品与共享素材保存在这个空间中。个人素材与 Skills 仍属于你，可按需用于空间内的作品。</p><small>当前为本地原型，成员邀请与权限体验仅在此浏览器中演示。</small>{fieldName.trim()&&<div className="workspace-create-binding">知识本地场：{fieldName.trim()}<br/>{demo?'模拟知识本地场 · 无需上传案例资料':'已保存绑定配置 · ACP未连接'}</div>}</div> : <form className="workspace-create-form" onSubmit={event => { event.preventDefault(); create(); }}>
      <label>空间名称<input value={name} onChange={event => { setName(event.target.value); setError(''); }} maxLength={40} placeholder="例如：企业展厅共创项目" autoFocus /></label>
      <label>空间说明（可选）<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={200} placeholder="简要说明项目目标或合作内容" rows={3}/></label>
      <details className="workspace-knowledge-optional"><summary>绑定ACP知识本地场（可稍后设置）</summary><p>可选择预置模拟案例，或填写已有知识本地场的名称与id。真实 ACP 尚未连接。</p><DemoKnowledgeChoice demo={demo} onDemo={()=>{setDemo(true);setFieldName('智创案例演示知识本地场');setFieldId(demoFieldId);}} onManual={()=>{setDemo(false);setFieldName('');setFieldId('');}}/><KnowledgeBindingFields readOnly={demo} fieldName={fieldName} fieldId={fieldId} onName={setFieldName} onId={setFieldId}/></details>
      <p className="workspace-create-note"><FolderPlus size={16}/> 创建后可邀请编辑者或查看者，也可以先开始创作。</p>
      {error && <p className="workspace-members-error" role="alert">{error}</p>}
    </form>}
  </Modal>;
}
