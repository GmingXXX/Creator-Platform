import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {isWorkspace} from '../src/domain/workspaces';
import {normalizeMemberAccount,normalizeWorkspaceState,workspaceCanEdit,workspaceCanManage,workspaceRole} from '../src/domain/workspace-management';

beforeEach(()=>useStudio.setState(createInitialData()));
describe('dynamic project spaces',()=>{
 it('creates a persistent custom space with self as owner and an independent draft',()=>{
  const before=useStudio.getState();const space=before.createWorkspace({name:' 新项目空间 ',description:'项目说明'});const state=useStudio.getState();
  expect(space.name).toBe('新项目空间');expect(before.workspaces).toHaveLength(4);expect(state.workspaces).toHaveLength(5);expect(state.activeWorkspaceId).toBe(space.id);
  expect(isWorkspace(space.id,state.workspaces)).toBe(true);expect(isWorkspace(space.id)).toBe(false);expect(workspaceRole(state,space.id)).toBe('owner');
  expect(state.drafts.find(d=>d.id===state.activeDraftId)?.workspaceId).toBe(space.id);
  const merged=useStudio.persist.getOptions().merge!(JSON.parse(JSON.stringify(state)),before);expect(merged.workspaces).toContainEqual(space);expect(merged.activeWorkspaceId).toBe(space.id);
 });
 it('validates workspace metadata without mutation',()=>{
  const s=useStudio.getState();for(const name of ['',' ','x'.repeat(41),'个人空间','信泰企业展厅'])expect(()=>s.createWorkspace({name})).toThrow();
  expect(()=>s.createWorkspace({name:'有效名字',description:'x'.repeat(201)})).toThrow();expect(useStudio.getState().workspaces).toHaveLength(4);
 });
 it('invites account or email once and accepts only through the explicit demo action',()=>{
  const s=useStudio.getState();const m=s.inviteWorkspaceMember('xintai',' Editor@Example.com ','editor');expect(m.account).toBe('editor@example.com');expect(m.status).toBe('invited');
  expect(()=>s.setWorkspaceActor('xintai',m.id)).toThrow();expect(()=>s.inviteWorkspaceMember('xintai','editor@example.com','viewer')).toThrow();
  s.acceptWorkspaceInvitation('xintai',m.id);expect(useStudio.getState().workspaceMembers.xintai.find(x=>x.id===m.id)?.status).toBe('member');
  s.setWorkspaceActor('xintai',m.id);expect(workspaceCanEdit(useStudio.getState(),'xintai')).toBe(true);expect(workspaceCanManage(useStudio.getState(),'xintai')).toBe(false);
 });
 it('validates accounts and invitation roles',()=>{
  const s=useStudio.getState();for(const account of ['',' ','a@','a@@b.com','bad account','x'.repeat(101),'jiming'])expect(()=>s.inviteWorkspaceMember('xintai',account,'viewer')).toThrow();
  expect(()=>s.inviteWorkspaceMember('xintai','test','owner' as 'viewer')).toThrow();expect(()=>s.inviteWorkspaceMember('personal','test','viewer')).toThrow();
  expect(()=>s.inviteWorkspaceMember('missing','test','viewer')).toThrow();
 });
 it('enforces owner-only membership management and viewer read-only roles',()=>{
  const s=useStudio.getState();const m=s.inviteWorkspaceMember('dongguan','小王','viewer');s.acceptWorkspaceInvitation('dongguan',m.id);s.setWorkspaceActor('dongguan',m.id);
  expect(workspaceCanEdit(useStudio.getState(),'dongguan')).toBe(false);expect(workspaceCanEdit(useStudio.getState(),'personal')).toBe(true);
  for(const action of [()=>s.inviteWorkspaceMember('dongguan','小李','editor'),()=>s.changeWorkspaceMemberRole('dongguan',m.id,'editor'),()=>s.removeWorkspaceMember('dongguan',m.id),()=>s.acceptWorkspaceInvitation('dongguan',m.id)])expect(action).toThrow();
  s.setWorkspaceActor('dongguan','self');s.changeWorkspaceMemberRole('dongguan',m.id,'editor');expect(useStudio.getState().workspaceMembers.dongguan.find(x=>x.id===m.id)?.role).toBe('editor');
  expect(()=>s.changeWorkspaceMemberRole('dongguan','self','viewer')).toThrow();expect(()=>s.removeWorkspaceMember('dongguan','self')).toThrow();
  s.removeWorkspaceMember('dongguan',m.id);expect(()=>s.setWorkspaceActor('dongguan',m.id)).toThrow();
 });
 it('revokes pending invitations and preserves the owner',()=>{
  const s=useStudio.getState();const m=s.inviteWorkspaceMember('xintai','test','viewer');s.removeWorkspaceMember('xintai',m.id);expect(useStudio.getState().workspaceMembers.xintai).toHaveLength(1);
  expect(()=>s.acceptWorkspaceInvitation('xintai',m.id)).toThrow();expect(()=>s.changeWorkspaceMemberRole('xintai',m.id,'viewer')).toThrow();
 });
 it('migrates preset members and preserves valid dynamic membership',()=>{
  const old=normalizeWorkspaceState({},id=>id==='xintai'?JSON.stringify([{id:'self',name:'伪负责人',role:'viewer',status:'member'},{id:'legacy',name:'小李',role:'editor',status:'invited'}]):null);
  expect(old.workspaces).toHaveLength(4);expect(old.workspaceMembers.xintai[0].role).toBe('owner');expect(old.workspaceMembers.xintai[1].account).toMatch(/^legacy-/);
  const s=useStudio.getState();const custom=s.createWorkspace({name:'保留空间'});const m=s.inviteWorkspaceMember(custom.id,'person','viewer');s.acceptWorkspaceInvitation(custom.id,m.id);s.setWorkspaceActor(custom.id,m.id);
  const normalized=normalizeWorkspaceState(useStudio.getState());expect(normalized.workspaceActors[custom.id]).toBe(m.id);expect(workspaceCanEdit(normalized,custom.id)).toBe(false);
 });
 it('preserves legacy display names and derives stable valid demo accounts from ids',()=>{
  const legacy=[{id:'legacy-space',name:'张三 设计',role:'editor',status:'invited'},{id:'legacy-punctuation',name:'张三（客户）',role:'viewer',status:'invited'},{id:'x'.repeat(100),name:'旧联系人',role:'editor',status:'invited'}];
  const read=(id:string)=>id==='xintai'?JSON.stringify(legacy):null;
  const first=normalizeWorkspaceState({},read),second=normalizeWorkspaceState({},read);
  expect(first.workspaceMembers.xintai.slice(1).map(m=>m.name)).toEqual(legacy.map(m=>m.name));
  const accounts=first.workspaceMembers.xintai.slice(1).map(m=>m.account);
  expect(new Set(accounts).size).toBe(3);for(const account of accounts)expect(normalizeMemberAccount(account)).toBe(account);
  expect(second.workspaceMembers.xintai).toEqual(first.workspaceMembers.xintai);
  expect(normalizeWorkspaceState(first).workspaceMembers.xintai).toEqual(first.workspaceMembers.xintai);
  const renamed=normalizeWorkspaceState({},id=>id==='xintai'?JSON.stringify([{...legacy[0],name:'新显示名'}]):null);
  expect(renamed.workspaceMembers.xintai[1].account).toBe(accounts[0]);
  expect(()=>useStudio.getState().inviteWorkspaceMember('xintai','张三 设计','editor')).toThrow();
  expect(()=>useStudio.getState().inviteWorkspaceMember('xintai','张三（客户）','viewer')).toThrow();
 });
 it('rejects malformed persisted spaces, memberships and identities safely',()=>{
  const normalized=normalizeWorkspaceState({workspaces:[{id:'bad/id',name:'坏空间'},{id:'custom-1',name:'好空间',description:'',color:'red'},{id:'custom-1',name:'重复'}],workspaceMembers:{'custom-1':[{id:'intruder',name:'入侵',account:'intruder',role:'owner',status:'member'},{id:'pending',name:'未加入',account:'pending',role:'viewer',status:'invited'}]},workspaceActors:{'custom-1':'pending'}});
  expect(normalized.workspaces).toHaveLength(5);expect(normalized.workspaceMembers['custom-1']).toHaveLength(2);expect(normalized.workspaceActors['custom-1']).toBe('self');
  expect(workspaceCanEdit(normalized,'missing')).toBe(false);expect(normalizeWorkspaceState({workspaces:'oops',workspaceMembers:null})).toEqual(normalizeWorkspaceState({}));
 });
});
