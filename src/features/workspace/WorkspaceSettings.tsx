import {SpacePluginSettings} from '../resources/CreationPluginSettings';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowLeft} from 'lucide-react';
import {Badge,Button,Tabs,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {workspaceCanManage,workspaceRole,workspaceRoleLabels} from '../../domain/workspace-management';
import type {Workspace} from '../../domain/workspaces';
import {WorkspaceMembersPanel} from './WorkspaceMembers';
import {WorkspaceKnowledgePanel} from './WorkspaceKnowledge';

export type WorkspaceSettingsTab='basic'|'members'|'knowledge'|'plugins';
export function WorkspaceSettings({space,initialTab='basic',onBack,lifecycle}:{space:Workspace;initialTab?:WorkspaceSettingsTab;onBack:()=>void;lifecycle:ReactNode}){
 const [tab,setTab]=useState<WorkspaceSettingsTab>(space.id==='personal'&&initialTab==='members'?'basic':initialTab);
 const state=useStudio(),role=workspaceRole(state,space.id);
 return <div className="workspace-settings">
  <Button variant="ghost" onClick={onBack}><ArrowLeft size={14}/>返回空间列表</Button>
  <div className="workspace-settings-heading"><h3>{space.name}</h3><Badge>{space.archivedAt?'已归档':'使用中'}</Badge><span>{space.id==='personal'?'个人':role?workspaceRoleLabels[role]:'无权限'}</span></div>
  {space.archivedAt&&<p className="workspace-management-hint">此空间已归档，设置与成员仅供查看。恢复使用后可继续修改。</p>}
  <Tabs value={tab} onChange={setTab} items={space.id==='personal'?[{value:'basic',label:'基本信息'},{value:'knowledge',label:'知识本地场'},{value:'plugins',label:'创作工具'}]:[{value:'basic',label:'基本信息'},{value:'members',label:'成员与权限'},{value:'knowledge',label:'知识本地场'},{value:'plugins',label:'创作工具'}]}/>
  <div role="tabpanel" aria-label={tab==='basic'?'基本信息':tab==='members'?'成员与权限':tab==='plugins'?'创作工具':'知识本地场'}>
   {tab==='basic'?<WorkspaceBasicSettings space={space}>{lifecycle}</WorkspaceBasicSettings>:tab==='members'?<WorkspaceMembersPanel workspaceId={space.id} workspaceName={space.name}/>:tab==='plugins'?<SpacePluginSettings workspaceId={space.id}/>:<WorkspaceKnowledgePanel workspaceId={space.id}/>}
  </div>
 </div>;
}
function WorkspaceBasicSettings({space,children}:{space:Workspace;children:ReactNode}){
 const state=useStudio(),canManage=workspaceCanManage(state,space.id);
 const [name,setName]=useState(space.name),[description,setDescription]=useState(space.description),[error,setError]=useState('');
 useEffect(()=>{setName(space.name);setDescription(space.description);setError('');},[space.id,space.name,space.description]);
 const save=()=>{try{state.updateWorkspaceDetails(space.id,{name,description});setError('');toast('空间信息已保存');}catch(cause){setError(cause instanceof Error?cause.message:'空间信息未保存，请重试。');}};
 return <div className="workspace-basic-settings">
  <form onSubmit={event=>{event.preventDefault();save();}}>
   <label>空间名称<input aria-label="空间名称" value={name} maxLength={40} disabled={!canManage} onChange={event=>setName(event.target.value)}/></label>
   <label>空间说明<textarea aria-label="空间说明" value={description} maxLength={200} rows={3} disabled={!canManage} onChange={event=>setDescription(event.target.value)}/></label>
   {error&&<p className="workspace-management-error" role="alert">{error}</p>}
   {canManage?<Button type="submit" variant="primary">保存基本信息</Button>:<p className="workspace-management-hint">{space.id==='personal'?'个人空间仅供自己使用，可独立绑定知识本地场，不开放成员邀请、归档或删除。':space.archivedAt?'归档期间不可修改空间信息。':'仅空间负责人可以修改基本信息。'}</p>}
  </form>
  {children&&<div className="workspace-settings-lifecycle"><h4>空间状态管理</h4><p>归档保留全部内容并转为只读，移入回收站后可恢复。</p><div>{children}</div></div>}
 </div>;
}
