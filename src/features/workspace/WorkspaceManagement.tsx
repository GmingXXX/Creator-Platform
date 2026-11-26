import {useState} from 'react';
import {Archive,ArrowUpRight,FolderKanban,MoreHorizontal,RotateCcw,Trash2,UserRound} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {Badge,Button,Menu,Modal,SearchInput,Tabs,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {workspaceRole,workspaceRoleLabels} from '../../domain/workspace-management';
import {workspaceCanManageLifecycle,workspaceLifecycleSummary} from '../../domain/workspace-lifecycle';
import type {Workspace} from '../../domain/workspaces';
import {WorkspaceSettings,type WorkspaceSettingsTab} from './WorkspaceSettings';
import '../../styles/workspace-management.css';

type SpaceTab='active'|'archived'|'deleted';
type Pending={id:string;kind:'delete'|'purge'};
const matchesTab=(space:Workspace,tab:SpaceTab)=>tab==='deleted'?Boolean(space.deletedAt):tab==='archived'?Boolean(space.archivedAt)&&!space.deletedAt:!space.archivedAt&&!space.deletedAt;

export function WorkspaceManagement({open,onClose,initialWorkspaceId,initialTab}:{open:boolean;onClose:()=>void;initialWorkspaceId?:string;initialTab?:WorkspaceSettingsTab}){
 const state=useStudio(),navigate=useNavigate();
 const [tab,setTab]=useState<SpaceTab>('active'),[search,setSearch]=useState(''),[error,setError]=useState('');
 const [detailId,setDetailId]=useState<string|undefined>(initialWorkspaceId),[detailTab,setDetailTab]=useState<WorkspaceSettingsTab>(initialTab||'basic');
 const [pending,setPending]=useState<Pending|null>(null),[confirmation,setConfirmation]=useState('');
 const accessible=state.workspaces.filter(space=>!space.purgedAt&&(workspaceRole(state,space.id)||workspaceCanManageLifecycle(state,space.id)));
 const detail=accessible.find(space=>space.id===detailId&&!space.deletedAt);
 const spaces=accessible.filter(space=>matchesTab(space,tab)&&`${space.name} ${space.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const selected=pending&&state.workspaces.find(space=>space.id===pending.id&&!space.purgedAt);
 const summary=selected?workspaceLifecycleSummary(state,selected.id):null;
 const perform=(id:string,action:()=>void,message:string,leave=false)=>{
  try{const wasCurrent=useStudio.getState().activeWorkspaceId===id;action();setError('');setPending(null);setConfirmation('');toast(message);if(leave&&wasCurrent){onClose();navigate('/');}}
  catch(cause){setError(cause instanceof Error?cause.message:'操作未完成，请重试。');}
 };
 const preview=(space:Workspace)=>perform(space.id,()=>{state.setWorkspace(space.id);onClose();navigate('/projects');},space.archivedAt?'已进入归档空间，只能浏览和预览':'已进入作品列表');
 const requestDelete=(id:string,kind:Pending['kind'])=>{setPending({id,kind});setConfirmation('');setError('');};
 const cancel=()=>{setPending(null);setConfirmation('');setError('');};
 const confirm=()=>{if(!pending||!selected)return;if(pending.kind==='purge')perform(selected.id,()=>state.permanentlyDeleteWorkspace(selected.id,confirmation),'空间已彻底删除',true);else perform(selected.id,()=>state.deleteWorkspace(selected.id),'空间已移入回收站',true);};
 const lifecycle=(space:Workspace)=>workspaceCanManageLifecycle(state,space.id)?<>
  {space.archivedAt?<Button size="sm" onClick={()=>perform(space.id,()=>state.unarchiveWorkspace(space.id),'空间已恢复使用')}><RotateCcw size={13}/>恢复使用</Button>:<Button size="sm" onClick={()=>perform(space.id,()=>state.archiveWorkspace(space.id),'空间已归档',true)}><Archive size={13}/>归档</Button>}
  <Button size="sm" variant="ghost" onClick={()=>requestDelete(space.id,'delete')}><Trash2 size={13}/>移入回收站</Button>
 </>:null;
 return <><Modal open={open} onClose={onClose} title="管理项目空间" description="集中管理空间信息、成员权限、知识本地场与空间状态。" wide footer={<Button onClick={onClose}>完成</Button>}>
  {detail?<WorkspaceSettings key={detail.id} space={detail} initialTab={detailTab} onBack={()=>{setDetailId(undefined);setError('');}} lifecycle={lifecycle(detail)}/>:<div className="workspace-management">
   <Tabs value={tab} onChange={next=>{setTab(next);setError('');}} items={[{value:'active',label:'使用中'},{value:'archived',label:'已归档'},{value:'deleted',label:'回收站'}]}/>
   <SearchInput value={search} onChange={setSearch} placeholder="搜索空间名称或说明"/>
   <p className="workspace-management-hint">{tab==='active'?'个人空间始终保留。项目空间仅负责人可以归档或删除。':tab==='archived'?'已归档空间保留内容与绑定，成员可只读预览；恢复后可继续创作。':'回收站保留空间内容与 ACP 绑定，恢复后继续使用。彻底删除不可恢复。'}</p>
   <div className="workspace-management-list" role="region" aria-label="空间管理列表">
    {spaces.map(space=>{const count=workspaceLifecycleSummary(state,space.id),canManage=workspaceCanManageLifecycle(state,space.id),role=workspaceRole(state,space.id);return <article key={space.id} className="workspace-management-row" data-testid={`workspace-row-${space.id}`} aria-label={`空间 ${space.name}`}>
     <span className="workspace-management-icon">{space.id==='personal'?<UserRound size={18}/>:<FolderKanban size={18}/>}</span>
     <div className="workspace-management-info"><div><h3>{space.name}</h3>{state.activeWorkspaceId===space.id&&<Badge>当前空间</Badge>}<small>{space.id==='personal'?'个人':role?workspaceRoleLabels[role]:canManage?'负责人':'成员'}</small></div>{space.description&&<p>{space.description}</p>}<p>{count.works} 个作品 · {state.workspaceMembers[space.id]?.filter(member=>member.status==='member').length||1} 位成员 · {count.assets} 份素材 · {count.skills} 项 Skills</p></div>
     <div className="workspace-management-actions">
      {!space.deletedAt&&<Button size="sm" onClick={()=>preview(space)}><ArrowUpRight size={13}/>{space.archivedAt?'只读预览':'查看作品'}</Button>}
      {!space.deletedAt&&<Button size="sm" onClick={()=>{setDetailId(space.id);setDetailTab('basic');setError('');}}>管理</Button>}
      {canManage&&(space.deletedAt?<><Button size="sm" onClick={()=>perform(space.id,()=>state.restoreWorkspace(space.id),'空间已恢复')}><RotateCcw size={13}/>恢复空间</Button><Button size="sm" variant="danger" onClick={()=>requestDelete(space.id,'purge')}>彻底删除</Button></>:<Menu trigger={<Button size="icon" variant="ghost" aria-label={`${space.name}的更多操作`}><MoreHorizontal size={16}/></Button>} items={[{label:space.archivedAt?'恢复使用':'归档',onClick:()=>perform(space.id,()=>space.archivedAt?state.unarchiveWorkspace(space.id):state.archiveWorkspace(space.id),space.archivedAt?'空间已恢复使用':'空间已归档',!space.archivedAt)},{label:'移入回收站',danger:true,onClick:()=>requestDelete(space.id,'delete')}]}/>)}
     </div>
    </article>;})}
    {!spaces.length&&<div className="workspace-management-empty">{search?'没有匹配的空间':tab==='archived'?'暂无归档空间':tab==='deleted'?'空间回收站为空':'暂无可用空间'}</div>}
   </div>
   {error&&!pending&&<p className="workspace-management-error" role="alert">{error}</p>}
  </div>}
  {detail&&error&&!pending&&<p className="workspace-management-error" role="alert">{error}</p>}
 </Modal>
 <Modal open={Boolean(selected)} onClose={cancel} title={pending?.kind==='purge'?'彻底删除项目空间？':'将项目空间移入回收站？'} description={pending?.kind==='purge'?'请核对影响范围，此操作不可恢复。':'空间会从日常列表隐藏，可在空间回收站恢复。'} footer={<><Button onClick={cancel}>取消</Button><Button variant="danger" disabled={!selected||!workspaceCanManageLifecycle(state,selected.id)||(pending?.kind==='purge'&&confirmation!==selected.name)} onClick={confirm}>{pending?.kind==='purge'?'确认彻底删除':'移入回收站'}</Button></>}>
  {selected&&summary&&<div className="workspace-delete-confirm"><h3>{selected.name}</h3><p>{summary.works} 个作品、{summary.assets} 份空间素材、{summary.skills} 项空间 Skills、{summary.drafts} 份需求草稿、{summary.sessions} 个创作会话、{summary.runs} 项创作任务。</p><p>{pending?.kind==='purge'?'将删除此空间的本地内容与成员设置，解除智创侧 ACP 绑定。个人资源、其他空间内容及已发布的社区副本保留。':'以上内容和成员设置将保留。恢复空间时，原 ACP 绑定一并恢复。'}</p><p>不会删除 ACP 平台中的知识资料。</p>{pending?.kind==='purge'&&<label>输入空间名称以确认<input aria-label="确认删除的空间名称" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder={selected.name}/></label>}{error&&<p className="workspace-management-error" role="alert">{error}</p>}</div>}
 </Modal></>;
}
