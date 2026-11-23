import {useState} from 'react';
import * as Popover from '@radix-ui/react-popover';
import {Check,ChevronDown,FolderKanban,Plus,Settings2,UserRound} from 'lucide-react';
import {useLocation,useNavigate} from 'react-router-dom';
import {SearchInput,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {workspaceRole} from '../../domain/workspace-management';
import {NewWorkspace} from './NewWorkspace';
import {WorkspaceManagement} from './WorkspaceManagement';
import {demoRoleLabels} from './workspace-members';
import '../../styles/workspace-management.css';

export function WorkspaceSwitch(){
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const [createOpen,setCreateOpen]=useState(false),[manageOpen,setManageOpen]=useState(false),[inviteSpaceId,setInviteSpaceId]=useState<string>();
 const state=useStudio(),currentId=state.activeWorkspaceId||'personal';
 const current=state.workspaces.find(space=>space.id===currentId)||state.workspaces[0];
 const actorId=state.workspaceActors[currentId]||'self',role=workspaceRole(state,currentId);
 const location=useLocation(),navigate=useNavigate();
 const spaces=state.workspaces.filter(space=>!space.archivedAt&&!space.deletedAt&&!space.purgedAt&&workspaceRole(state,space.id)&&space.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const change=(id:string)=>{
  try{state.setWorkspace(id);setOpen(false);if(location.pathname.startsWith('/create/'))navigate('/');}
  catch(cause){toast(cause instanceof Error?cause.message:'无法切换空间',true);}
 };
 const launch=(action:()=>void)=>{setOpen(false);action();};
 const resetActor=()=>{try{state.setWorkspaceActor(currentId,'self');toast('已返回本人身份');}catch(cause){toast(cause instanceof Error?cause.message:'无法切换身份',true);}};
 return <><Popover.Root open={open} onOpenChange={next=>{setOpen(next);if(next)setSearch('');}}>
  <Popover.Trigger asChild><button className="workspace-switch" aria-label="切换创作空间" title={`当前空间：${current.name}${current.archivedAt?'（已归档）':''}`}><span className="workspace-switch-icon">{currentId==='personal'?<UserRound size={15}/>:<FolderKanban size={15}/>}</span><span className="workspace-switch-name">{current.name}{current.archivedAt&&' · 已归档'}</span><ChevronDown size={13}/></button></Popover.Trigger>
  <Popover.Portal><Popover.Content className="workspace-switch-popover" align="start" sideOffset={6} collisionPadding={12} aria-label="切换创作空间">
   <SearchInput value={search} onChange={setSearch} placeholder="搜索项目空间"/>
   <div className="workspace-switch-list" role="menu" aria-label="可用空间" onKeyDown={event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const items=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')],index=items.findIndex(item=>item===document.activeElement);items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}}>
    {spaces.map(space=><button type="button" role="menuitem" key={space.id} className={`workspace-switch-item ${space.id===currentId?'current':''}`} title={space.name} onClick={()=>change(space.id)}>{space.id===currentId?<Check size={14}/>:space.id==='personal'?<UserRound size={14}/>:<FolderKanban size={14}/>}<span>{space.name}</span></button>)}
    {!spaces.length&&<p className="workspace-switch-empty">没有匹配的使用中空间</p>}
   </div>
   <div className="workspace-switch-footer" role="menu" aria-label="空间操作">
    <button type="button" role="menuitem" className="workspace-switch-item" onClick={()=>launch(()=>setCreateOpen(true))}><Plus size={14}/><span>新建项目空间</span></button>
    <button type="button" role="menuitem" className="workspace-switch-item" onClick={()=>launch(()=>{setInviteSpaceId(undefined);setManageOpen(true);} )}><Settings2 size={14}/><span>管理空间</span></button>
   </div>
  </Popover.Content></Popover.Portal>
 </Popover.Root>
 {actorId!=='self'&&<div className="workspace-role-preview"><span>权限体验 · {role?demoRoleLabels[role]:'无权限'}</span><button onClick={resetActor}>退出权限体验</button></div>}
 {createOpen&&<NewWorkspace open onClose={()=>setCreateOpen(false)} onInvite={()=>{setCreateOpen(false);setInviteSpaceId(useStudio.getState().activeWorkspaceId);setManageOpen(true);}}/>}
 {manageOpen&&<WorkspaceManagement open initialWorkspaceId={inviteSpaceId} initialTab={inviteSpaceId?'members':undefined} onClose={()=>setManageOpen(false)}/>}
 </>;
}
