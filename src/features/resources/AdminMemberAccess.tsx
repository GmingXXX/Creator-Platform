import {useState} from 'react';
import {Check,ChevronRight,FolderClosed,LockKeyhole,ShieldCheck,UsersRound} from 'lucide-react';
import {Badge,Button,EmptyState,SearchInput,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {adminPermissionLabels,canAdmin,setAdminPermission,useAdminManagement,type AdminAccount,type AdminPermission} from '../../domain/admin-management';
import {accountMembership,managedMemberSpaces,memberAccessNames,saveMemberAccess,type MemberAccessChange,type EditableAccess} from '../../domain/admin-member-access';

export function AdminMemberAccess({accountId,onSelect}:{accountId:string;onSelect:(id:string)=>void}){
 const {accounts}=useAdminManagement();
 const [area,setArea]=useState<'members'|'staff'>('members'),[search,setSearch]=useState('');
 const [drafts,setDrafts]=useState<Record<string,MemberAccessChange[]>>({});
 const account=accounts.find(a=>a.id===accountId)||accounts.find(a=>a.role==='creator')||accounts[0];
 const matches=accounts.filter(a=>(a.name+' '+a.email).toLowerCase().includes(search.trim().toLowerCase()));
 return <section className="admin-access">
  <nav aria-label="权限类型" className="admin-access-nav">
   <button aria-pressed={area==='members'} onClick={()=>setArea('members')}><UsersRound size={15}/>成员空间权限</button>
   <button aria-pressed={area==='staff'} onClick={()=>setArea('staff')}><ShieldCheck size={15}/>后台职责</button>
  </nav>
  {area==='staff'?<AdminDelegation/>:<div className="admin-access-layout">
   <aside className="admin-member-nav"><h2>平台成员 <small>{accounts.length}</small></h2>
    <SearchInput value={search} onChange={setSearch} placeholder="搜索成员"/>
    <div className="admin-member-options">{matches.map(member=><button key={member.id} aria-pressed={account?.id===member.id} onClick={()=>onSelect(member.id)}>
     <span className="admin-member-initial" aria-hidden="true">{member.name.slice(-1)}</span>
     <span><strong>{member.name}</strong><small>{drafts[member.id]?.length?'待保存 · ':''}{member.role==='admin'?'管理员':'创作者'} · {member.status==='active'?'已启用':member.status==='invited'?'待接受':'已停用'}</small></span><ChevronRight size={14}/>
    </button>)}{!matches.length&&<p className="admin-muted">没有匹配的成员</p>}</div>
   </aside>
   {account&&<MemberPolicy key={account.id} account={account} changes={drafts[account.id]||[]} onChange={changes=>setDrafts(previous=>({...previous,[account.id]:changes}))}/>}
  </div>}
 </section>;
}

function MemberPolicy({account,changes,onChange}:{account:AdminAccount;changes:MemberAccessChange[];onChange:(changes:MemberAccessChange[])=>void}){
 const studio=useStudio(),spaces=managedMemberSpaces(studio);
 const [error,setError]=useState('');
 const save=()=>{try{saveMemberAccess(account.id,changes);onChange([]);setError('');toast('已保存'+account.name+'的空间权限');}catch(e){setError(e instanceof Error?e.message:'保存失败');}};
 return <section className="admin-member-policy" aria-label={account.name+'的项目空间权限'}>
  <header><div><h2>{account.name}<span>项目空间权限</span></h2><p>{account.email}</p></div><Badge>{account.role==='creator'?'创作者':'管理员'}</Badge></header>
  <div className="admin-access-help"><span><strong>查看者</strong>可浏览和预览</span><span><strong>编辑者</strong>可创作和修改</span></div>
  {spaces.map(space=>{
   const member=accountMembership(studio.workspaceMembers[space.id],account),current=member?.role||'none';
   const change=changes.find(c=>c.spaceId===space.id);
   return <div className="admin-space-policy" key={space.id}>
    <span className="admin-space-icon" aria-hidden="true"><FolderClosed size={17}/></span>
    <div><strong>{space.name}</strong><small>{member?.status==='invited'?'待加入':current==='none'?'尚未加入':'已加入'}</small></div>
    {current==='owner'?<span className="admin-locked"><LockKeyhole size={12}/>负责人</span>:<select aria-label={space.name+'的成员权限'} disabled={account.status==='disabled'} value={change?.to||current} onChange={event=>{
     const next=event.target.value as EditableAccess;
     onChange([...changes.filter(c=>c.spaceId!==space.id),...(next===current?[]:[{spaceId:space.id,from:change?.from||current,to:next}])]);setError('');
    }}>{(['none','viewer','editor'] as const).map(v=><option key={v} value={v}>{memberAccessNames[v]}</option>)}</select>}
   </div>;
  })}
  {!spaces.length&&<EmptyState title="暂无可配置的空间" description="当前管理员可配置本人负责的项目空间。"/>}
  {!!spaces.length&&<footer><span aria-live="polite">{account.status==='disabled'?'此成员已停用':changes.length?'有 '+changes.length+' 个空间待保存':account.status==='invited'?'成员加入空间后获得所选权限':'权限仅作用于所选项目空间'}</span>
   {changes.length>0&&<Button size="sm" onClick={()=>{onChange([]);setError('');}}>撤销更改</Button>}
   <Button variant="primary" disabled={!changes.length||account.status==='disabled'} onClick={save}><Check size={14}/>保存成员权限</Button>
  </footer>}
  {error&&<p role="alert" className="res-error">{error}</p>}
 </section>;
}

function AdminDelegation(){
 const state=useAdminManagement(),studioRole=useStudio(s=>s.role);
 const admins=state.accounts.filter(a=>a.role==='admin'&&a.id!=='jiming');
 const [id,setId]=useState(''),[error,setError]=useState('');
 const account=admins.find(a=>a.id===id)||admins[0];
 if(!account)return <div className="admin-delegation-empty"><ShieldCheck size={24}/><div><h2>暂无受委派的管理员</h2><p>在「账号管理」中将成员的平台角色改为管理员后，可在此分配审核、资源管理等职责。</p></div></div>;
 return <div className="admin-delegation"><header><div><h2>委派后台职责</h2><p>选择可进入的管理模块。项目空间访问范围单独配置。</p></div>
  <label>管理员<select aria-label="配置权限的管理员" value={account.id} onChange={e=>{setId(e.target.value);setError('');}}>{admins.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label></header>
  <div className="admin-delegated-rights">{(Object.entries(adminPermissionLabels) as [AdminPermission,string][]).map(([permission,label])=><label key={permission}>
   <input type="checkbox" disabled={account.id===state.activeAdminId||!canAdmin(studioRole,permission)} checked={account.permissions.includes(permission)} onChange={e=>{
    try{setAdminPermission(studioRole,account.id,permission,e.target.checked);setError('');toast('后台职责已更新');}catch(cause){setError(cause instanceof Error?cause.message:'未能更新职责');}
   }}/>{label}</label>)}</div>{error&&<p role="alert">{error}</p>}
 </div>;
}
