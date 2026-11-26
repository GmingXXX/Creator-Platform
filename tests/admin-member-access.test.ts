import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {initialAdminData,selectDemoAdministrator,setAdminPermission,updateAdminAccount,useAdminManagement} from '../src/domain/admin-management';
import {managedMemberSpaces,saveMemberAccess} from '../src/domain/admin-member-access';
import {workspaceCanEdit,workspaceRole} from '../src/domain/workspace-management';

beforeEach(()=>{
 useAdminManagement.setState(initialAdminData());
 useStudio.setState({...createInitialData(),role:'reviewer'});
});
describe('成员空间授权',()=>{
 it('保存后空间原有写入边界立即遵循角色，其余成员与其他空间保留',()=>{
  const before=useStudio.getState().workspaceMembers;
  saveMemberAccess('linan',[{spaceId:'xintai',from:'none',to:'editor'}]);
  const updated=useStudio.getState(),member=updated.workspaceMembers.xintai.find(m=>m.account==='linan@demo.local')!;
  expect(member).toMatchObject({name:'林安',role:'editor',status:'member'});
  expect(updated.workspaceMembers.dongguan).toBe(before.dongguan);
  expect(updated.workspaceMembers.xintai[0]).toEqual(before.xintai[0]);
  updated.setWorkspaceActor('xintai',member.id);
  expect(workspaceCanEdit(useStudio.getState(),'xintai')).toBe(true);
  updated.setWorkspaceActor('xintai','self');
  saveMemberAccess('linan',[{spaceId:'xintai',from:'editor',to:'viewer'}]);
  updated.setWorkspaceActor('xintai',member.id);
  expect(workspaceCanEdit(useStudio.getState(),'xintai')).toBe(false);
  expect(workspaceRole(useStudio.getState(),'xintai')).toBe('viewer');
  updated.setWorkspaceActor('xintai','self');
  saveMemberAccess('linan',[{spaceId:'xintai',from:'viewer',to:'none'}]);
  expect(useStudio.getState().workspaceMembers.xintai).toEqual(before.xintai);
  expect(useAdminManagement.getState().audit[0]).toMatchObject({action:'更新成员空间权限',target:'林安'});
 });
 it('阻止越权、对个人空间或负责人的角色修改，整次提交失败时不部分保存',()=>{
  expect(managedMemberSpaces(useStudio.getState()).map(s=>s.id)).not.toContain('personal');
  expect(()=>saveMemberAccess('jiming',[{spaceId:'xintai',from:'owner',to:'viewer'}])).toThrow('负责人');
  const before=useStudio.getState().workspaceMembers;
  expect(()=>saveMemberAccess('linan',[{spaceId:'xintai',from:'none',to:'editor'},{spaceId:'personal',from:'none',to:'viewer'}])).toThrow('空间');
  expect(useStudio.getState().workspaceMembers).toBe(before);
  updateAdminAccount('reviewer','linan',{role:'admin'});selectDemoAdministrator('reviewer','linan');
  expect(()=>saveMemberAccess('sunxiao',[{spaceId:'xintai',from:'none',to:'viewer'}])).toThrow('权限');
  selectDemoAdministrator('reviewer','jiming');setAdminPermission('reviewer','linan','permissions',true);selectDemoAdministrator('reviewer','linan');
  expect(managedMemberSpaces(useStudio.getState())).toHaveLength(0);
  expect(()=>saveMemberAccess('sunxiao',[{spaceId:'xintai',from:'none',to:'viewer'}])).toThrow('空间');
 });
 it('复用已存在的邀请、保护未加入状态、拒绝过期编辑和无效权限',()=>{
  const state=useStudio.getState(),member=state.inviteWorkspaceMember('dongguan','sunxiao@demo.local','viewer');
  saveMemberAccess('sunxiao',[{spaceId:'dongguan',from:'viewer',to:'editor'}]);
  expect(useStudio.getState().workspaceMembers.dongguan.find(m=>m.id===member.id)).toMatchObject({role:'editor',status:'invited'});
  expect(()=>saveMemberAccess('sunxiao',[{spaceId:'dongguan',from:'viewer',to:'none'}])).toThrow('已变化');
  expect(()=>saveMemberAccess('sunxiao',[{spaceId:'dongguan',from:'editor',to:'owner' as never}])).toThrow('无效');
  updateAdminAccount('reviewer','sunxiao',{status:'disabled'});
  expect(()=>saveMemberAccess('sunxiao',[{spaceId:'xintai',from:'none',to:'editor'}])).toThrow('停用');
 });
});
it('委派后台职责时只能授予自己拥有的权限，不能扩大自己的授权',()=>{
 updateAdminAccount('reviewer','linan',{role:'admin'});setAdminPermission('reviewer','linan','permissions',true);
 updateAdminAccount('reviewer','sunxiao',{role:'admin'});selectDemoAdministrator('reviewer','linan');
 expect(()=>setAdminPermission('reviewer','linan','models',true)).toThrow('自己');
 expect(()=>setAdminPermission('reviewer','sunxiao','models',true)).toThrow('持有');
});

it('停用账号后已分配的项目权限暂停，重新启用后恢复原角色',()=>{
 saveMemberAccess('linan',[{spaceId:'xintai',from:'none',to:'editor'}]);
 const state=useStudio.getState(),member=state.workspaceMembers.xintai.find(m=>m.account==='linan@demo.local')!;
 state.setWorkspaceActor('xintai',member.id);
 updateAdminAccount('reviewer','linan',{status:'disabled'});
 expect(workspaceRole(useStudio.getState(),'xintai')).toBeUndefined();
 expect(workspaceCanEdit(useStudio.getState(),'xintai')).toBe(false);
 updateAdminAccount('reviewer','linan',{status:'active'});
 expect(workspaceRole(useStudio.getState(),'xintai')).toBe('editor');
});

describe('平台账号在项目空间中的历史别名',()=>{
 function withDuplicates(ownerAlias=false){
  const state=useStudio.getState(),members=state.workspaceMembers.xintai;
  const alias={id:'legacy-handle',account:ownerAlias?'jiming':'linan',name:'旧账号',status:'member' as const,role:'editor' as const};
  const email={...alias,id:'legacy-email',account:ownerAlias?'jiming@demo.local':'linan@demo.local'};
  useStudio.setState({workspaceMembers:{...state.workspaceMembers,xintai:[alias,...members,email]}});
  return {alias,email};
 }
 it('按账号或邮箱邀请同一平台成员只保留一次邀请',()=>{
  const state=useStudio.getState();
  state.inviteWorkspaceMember('xintai','LINAN','viewer');
  expect(()=>state.inviteWorkspaceMember('xintai','linan@demo.local','editor')).toThrow('已在');
  expect(()=>state.inviteWorkspaceMember('xintai','jiming@demo.local','viewer')).toThrow('已在');
 });
 it('保存降级或撤销清除全部旧身份，并保留无关成员',()=>{
  const {alias,email}=withDuplicates(),state=useStudio.getState();
  saveMemberAccess('linan',[{spaceId:'xintai',from:'editor',to:'viewer'}]);
  const remaining=useStudio.getState().workspaceMembers.xintai;
  expect(remaining).toHaveLength(2);
  expect(remaining.find(m=>m.role!=='owner')).toMatchObject({account:'linan@demo.local',role:'viewer'});
  saveMemberAccess('linan',[{spaceId:'xintai',from:'viewer',to:'none'}]);
  for(const identity of [alias,email])expect(()=>state.setWorkspaceActor('xintai',identity.id)).toThrow('已加入');
 });
 it('空间成员入口操作另一条旧别名同样生效，负责人在任意位置都受保护',()=>{
  const {email}=withDuplicates(),state=useStudio.getState();
  state.removeWorkspaceMember('xintai',email.id);
  expect(useStudio.getState().workspaceMembers.xintai).toHaveLength(1);
  const aliases=withDuplicates(true);
  expect(()=>saveMemberAccess('jiming',[{spaceId:'xintai',from:'editor',to:'none'}])).toThrow('负责人');
  expect(()=>state.removeWorkspaceMember('xintai',aliases.email.id)).toThrow('负责人');
 });
});

import {skillActorAccount,skillAvailableToActor,skillCanManage} from '../src/domain/skill-access';
import {prepareSkillSave} from '../src/domain/skill-store';
import {getSkillMetadata} from '../src/domain/skill-metadata';
it('已停用负责人不能归档、清理回收站或管理其技能，重新启用后可恢复项目',()=>{
 const state=useStudio.getState(),id='xintai';
 saveMemberAccess('linan',[{spaceId:id,from:'none',to:'editor'}]);
 const member=useStudio.getState().workspaceMembers[id].find(m=>m.role==='editor')!;
 state.transferWorkspaceOwnership(id,member.id);state.setWorkspaceActor(id,member.id);state.setWorkspace(id);
 const previous=state.skills[0],skill={...previous,id:'restricted',personal:true,public:false,metadata:{...getSkillMetadata(previous),visibility:'restricted' as const,allowedWorkspaceIds:[id]}};
 useStudio.setState(s=>({skills:[...s.skills,skill]}));
 expect(skillCanManage(skill,useStudio.getState())).toBe(true);
 updateAdminAccount('reviewer','linan',{status:'disabled'});
 expect(()=>state.archiveWorkspace(id)).toThrow('负责人');
 expect(skillActorAccount(useStudio.getState())).toBeUndefined();
 expect(skillAvailableToActor(skill,useStudio.getState())).toBe(false);
 expect(skillCanManage(skill,useStudio.getState())).toBe(false);
 expect(()=>prepareSkillSave(useStudio.getState(),skill)).toThrow('不能修改');
 updateAdminAccount('reviewer','linan',{status:'active'});state.deleteWorkspace(id);
 updateAdminAccount('reviewer','linan',{status:'disabled'});
 expect(()=>state.restoreWorkspace(id)).toThrow('负责人');
 expect(()=>state.permanentlyDeleteWorkspace(id,'信泰企业展厅')).toThrow('负责人');
 updateAdminAccount('reviewer','linan',{status:'active'});state.restoreWorkspace(id);
 expect(workspaceRole(useStudio.getState(),id)).toBe('owner');
});
