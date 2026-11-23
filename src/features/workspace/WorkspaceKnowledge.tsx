import {useEffect,useState} from 'react';
import {Database,Unplug} from 'lucide-react';
import {Badge,Button,Modal,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {DEMO_KNOWLEDGE_CATALOG_ID,isDemoKnowledgeBinding,canManageKnowledgeBinding} from '../../domain/workspace-knowledge';
import '../../styles/workspace-knowledge.css';

type KnowledgeFieldsProps={fieldName:string;fieldId:string;onName:(value:string)=>void;onId:(value:string)=>void;readOnly?:boolean};
export function KnowledgeBindingFields({fieldName,fieldId,onName,onId,readOnly=false}:KnowledgeFieldsProps){
 return <div className="workspace-knowledge-fields">
  <label>知识本地场名称<input aria-label="知识本地场名称" value={fieldName} readOnly={readOnly} maxLength={80} placeholder="例如：中铁知识本地场" onChange={event=>onName(event.target.value)}/></label>
  <label>知识本地场id<input aria-label="知识本地场id" value={fieldId} readOnly={readOnly} maxLength={200} placeholder="从 ACP 复制已有知识本地场的id" onChange={event=>onId(event.target.value)}/><small>按唯一id确定归属，名称用于显示。</small></label>
 </div>;
}

export function DemoKnowledgeChoice({demo,onDemo,onManual}:{demo:boolean;onDemo:()=>void;onManual:()=>void}){
 return <div className="workspace-knowledge-demo-choice">
  <div><strong>无需上传的案例演示</strong><p>模拟知识本地场包含企业大事件、智能演示大纲、泰山互动故事及成果卡片资料。绑定后，Agent 按任务引用资料，仍需确认内容后生成作品。</p></div>
  {demo?<><Badge>模拟资料 · 已选择</Badge><Button size="sm" onClick={onManual}>改用 ACP 配置</Button></>:<Button size="sm" onClick={onDemo}>使用演示知识本地场</Button>}
  <small>仅模拟知识检索，不代表真实 ACP 已连接；不会预置成品或把资料一次性导入素材库。</small>
 </div>;
}

export function WorkspaceKnowledge({workspaceId,open,onClose}:{workspaceId:string;open:boolean;onClose:()=>void}){
 const space=useStudio(state=>state.workspaces.find(item=>item.id===workspaceId));
 return <Modal open={open} onClose={onClose} title="ACP知识本地场" description={`为${space?.name||'当前项目空间'}设置资料归属。`} footer={<Button onClick={onClose}>完成</Button>}>
  {open&&<WorkspaceKnowledgePanel key={workspaceId} workspaceId={workspaceId}/>}
 </Modal>;
}

export function WorkspaceKnowledgePanel({workspaceId}:{workspaceId:string}){
 const state=useStudio(),space=state.workspaces.find(item=>item.id===workspaceId),binding=state.workspaceKnowledge[workspaceId];
 const canManage=canManageKnowledgeBinding(state,workspaceId);
 const [fieldName,setFieldName]=useState(''),[fieldId,setFieldId]=useState(''),[error,setError]=useState(''),[removing,setRemoving]=useState(false),[demo,setDemo]=useState(false);
 useEffect(()=>{setFieldName(binding?.fieldName||'');setFieldId(binding?.fieldId||'');setDemo(isDemoKnowledgeBinding(binding));setError('');setRemoving(false);},[workspaceId,binding?.revision,binding?.fieldId,binding?.fieldName,binding?.demoCatalogId]);
 const save=()=>{
  try{state.bindWorkspaceKnowledge(workspaceId,{fieldName,fieldId,...(demo?{demoCatalogId:DEMO_KNOWLEDGE_CATALOG_ID}:{})});setError('');toast(demo?'已绑定模拟知识本地场，可直接选择案例开始创作':'已保存绑定配置；ACP 尚未连接');}
  catch(cause){setError(cause instanceof Error?cause.message:'绑定配置未保存，请重试。');}
 };
 const remove=()=>{
  try{state.unbindWorkspaceKnowledge(workspaceId);setRemoving(false);setError('');toast('已解除本地绑定配置');}
  catch(cause){setError(cause instanceof Error?cause.message:'解除绑定失败，请重试。');}
 };
 return <div className="workspace-knowledge">
   <div className="workspace-knowledge-current"><Database size={21}/><div><span>{space?.name||'当前项目空间'}</span><strong>{binding?.fieldName||'尚未绑定知识本地场'}</strong><small>{binding?'已保存绑定配置':'由空间负责人设置对应知识本地场'}</small></div><Badge>{isDemoKnowledgeBinding(binding)?'模拟知识本地场':'ACP未连接'}</Badge></div>
   <p className="workspace-knowledge-connection"><Unplug size={16}/><span>{isDemoKnowledgeBinding(binding)?'已绑定预置模拟案例资料。发送创作需求时按案例引用资料，无需手动上传；未连接真实 ACP 服务。':'当前仅保存本地绑定配置。文件仍保存在智创，尚未提交到 ACP；暂不能从 ACP 检索或引用知识。'}</span></p>
   {isDemoKnowledgeBinding(binding)&&<p className="workspace-knowledge-note">资料来源 · <span>智创真实演示资料_20261116</span></p>}
   {canManage?<form onSubmit={event=>{event.preventDefault();save();}}><DemoKnowledgeChoice demo={demo} onDemo={()=>{setDemo(true);setFieldName('智创案例演示知识本地场');setFieldId(`demo-${workspaceId}`);setError('');}} onManual={()=>{setDemo(false);setFieldName('');setFieldId('');setError('');}}/><KnowledgeBindingFields readOnly={demo} fieldName={fieldName} fieldId={fieldId} onName={value=>{setFieldName(value);setError('');}} onId={value=>{setFieldId(value);setError('');}}/><div className="workspace-knowledge-save"><Button type="submit" variant="primary">保存绑定配置</Button></div></form>:<div className="workspace-knowledge-readonly"><p>{space?.archivedAt?'空间已归档，绑定仅供查看；恢复使用后可修改。':'只有空间负责人可以设置或解除绑定。'}</p>{binding&&<dl><dt>知识本地场id</dt><dd>{binding.fieldId}</dd></dl>}</div>}
   <p className="workspace-knowledge-note">一个空间对应一个知识本地场，同一空间内的作品共用此配置。更换或解除绑定只影响后续资料的目标记录，不会迁移或删除已有文件，也不会改变已记录的归属。</p>
   {canManage&&binding&&(removing?<div className="workspace-knowledge-remove" role="alert"><p>解除与「{binding.fieldName}」的绑定？已有文件及其归属记录会保留。</p><div><Button size="sm" onClick={()=>setRemoving(false)}>取消</Button><Button size="sm" variant="danger" onClick={remove}>确认解除</Button></div></div>:<Button className="workspace-knowledge-unbind" variant="ghost" onClick={()=>setRemoving(true)}>解除绑定</Button>)}
   {error&&<p className="workspace-knowledge-error" role="alert">{error}</p>}
  </div>;
}
