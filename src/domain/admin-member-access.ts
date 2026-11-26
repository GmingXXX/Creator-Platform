import {canAdmin,recordMemberAccessAudit,useAdminManagement,type AdminAccount} from './admin-management';
import {useStudio} from './store';
import type {StudioData} from './types';
import {matchingMemberships,primaryMembership,replaceMemberships,workspaceCanManage,normalizeMemberAccount,type WorkspaceMember,type WorkspaceRole} from './workspace-management';

export type MemberAccess=WorkspaceRole|'none';
export type EditableAccess=Exclude<MemberAccess,'owner'>;
export interface MemberAccessChange {spaceId:string;from:MemberAccess;to:EditableAccess}
export const memberAccessNames:Record<MemberAccess,string>={none:'未授权',viewer:'查看者',editor:'编辑者',owner:'负责人'};

export function accountMembership(members:WorkspaceMember[],account:AdminAccount){
 return primaryMembership(matchingMemberships(members,account.email));
}

export function managedMemberSpaces(state:StudioData){
 const management=useAdminManagement.getState();
 const actor=management.accounts.find(account=>account.id===management.activeAdminId);
 if(!actor||!canAdmin(state.role,'permissions'))return [];
 return state.workspaces.filter(space=>workspaceCanManage(state,space.id)
   &&accountMembership(state.workspaceMembers[space.id]||[],actor)?.role==='owner');
}

function updatedMembers(members:WorkspaceMember[],account:AdminAccount,change:MemberAccessChange):WorkspaceMember[]{
 const matches=matchingMemberships(members,account.email),member=primaryMembership(matches);
 if(member?.role==='owner')throw new Error('空间负责人的角色需要通过负责人转让修改。');
 if((member?.role||'none')!==change.from)throw new Error('成员权限已变化，请重新查看当前权限。');
 if(!['editor','viewer','none'].includes(change.to))throw new Error('成员权限无效。');
 if(change.to==='none')return replaceMemberships(members,matches);
 const role=change.to;
 if(member)return replaceMemberships(members,matches,{...member,account:account.email,role});
 return [...members,{id:crypto.randomUUID(),name:account.name,account:normalizeMemberAccount(account.email),role,status:account.status==='active'?'member':'invited'}];
}

export function saveMemberAccess(accountId:string,changes:MemberAccessChange[]){
 const studio=useStudio.getState(),management=useAdminManagement.getState();
 if(!canAdmin(studio.role,'permissions'))throw new Error('当前管理员没有配置成员权限的权限。');
 const account=management.accounts.find(item=>item.id===accountId);
 if(!account||account.status==='disabled')throw new Error('成员已停用或不存在。');
 const spaces=managedMemberSpaces(studio),changed=changes.filter(item=>item.from!==item.to||matchingMemberships(studio.workspaceMembers[item.spaceId]||[],account.email).length>1);
 if(!changed.length)return;
 if(new Set(changed.map(item=>item.spaceId)).size!==changed.length)throw new Error('同一空间只能提交一项权限。');
 const entries=changed.map(change=>{
  const space=spaces.find(item=>item.id===change.spaceId);
  if(!space)throw new Error('仅可配置本人负责的使用中项目空间。');
  return [space.id,updatedMembers(studio.workspaceMembers[space.id],account,change)] as const;
 });
 const summary=changed.map(item=>spaces.find(s=>s.id===item.spaceId)!.name+' · '+memberAccessNames[item.to]).join('，');
 useStudio.setState({workspaceMembers:{...studio.workspaceMembers,...Object.fromEntries(entries)}});
 recordMemberAccessAudit(studio.role,account.name,summary);
}
