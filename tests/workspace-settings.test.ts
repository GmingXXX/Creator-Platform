import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {normalizeWorkspaceState,workspaceCanManage,workspaceRole} from '../src/domain/workspace-management';

beforeEach(()=>useStudio.setState(createInitialData()));
const joined=()=>{const s=useStudio.getState(),member=s.inviteWorkspaceMember('xintai','next-owner','editor');s.acceptWorkspaceInvitation('xintai',member.id);return member;};
describe('unified workspace settings',()=>{
 it('renames only the chosen workspace immutably and preserves binding and content IDs',()=>{
  const before=useStudio.getState();before.bindWorkspaceKnowledge('xintai',{fieldName:'信泰资料',fieldId:'xintai-knowledge'});
  const binding=useStudio.getState().workspaceKnowledge.xintai;
  before.updateWorkspaceDetails('xintai',{name:' 新信泰展厅 ',description:' 新说明 '});const after=useStudio.getState();
  expect(after.workspaces.find(s=>s.id==='xintai')).toMatchObject({name:'新信泰展厅',description:'新说明'});
  expect(before.workspaces.find(s=>s.id==='xintai')?.name).toBe('信泰企业展厅');
  expect(after.workspaceKnowledge.xintai).toBe(binding);expect(after.works).toBe(before.works);
  expect(normalizeWorkspaceState(after).workspaces.find(s=>s.id==='xintai')?.name).toBe('新信泰展厅');
 });
 it('rejects invalid, duplicate and unauthorized details edits',()=>{
  const s=useStudio.getState();for(const input of [{name:''},{name:'个人空间'},{name:'东莞博物馆'},{name:'x'.repeat(41)},{name:'合法',description:'x'.repeat(201)}])expect(()=>s.updateWorkspaceDetails('xintai',input)).toThrow();
  for(const id of ['personal','missing'])expect(()=>s.updateWorkspaceDetails(id,{name:'改名'})).toThrow();
  const m=joined();s.setWorkspaceActor('xintai',m.id);expect(()=>s.updateWorkspaceDetails('xintai',{name:'改名'})).toThrow();
  s.setWorkspaceActor('xintai','self');s.archiveWorkspace('xintai');expect(()=>s.updateWorkspaceDetails('xintai',{name:'改名'})).toThrow();
  s.deleteWorkspace('xintai');expect(()=>s.updateWorkspaceDetails('xintai',{name:'改名'})).toThrow();
 });
 it('transfers sole ownership to a joined member and persists roles across hydration',()=>{
  const member=joined(),before=useStudio.getState();before.transferWorkspaceOwnership('xintai',member.id);const after=useStudio.getState();
  expect(before.workspaceMembers.xintai.find(m=>m.id==='self')?.role).toBe('owner');
  expect(after.workspaceMembers.xintai.filter(m=>m.role==='owner').map(m=>m.id)).toEqual([member.id]);
  expect(workspaceRole(after,'xintai')).toBe('editor');expect(workspaceCanManage(after,'xintai')).toBe(false);
  const restored=normalizeWorkspaceState(JSON.parse(JSON.stringify(after)));
  expect(restored.workspaceMembers.xintai).toEqual(after.workspaceMembers.xintai);
  expect(workspaceRole(restored,'xintai')).toBe('editor');
  after.setWorkspaceActor('xintai',member.id);after.transferWorkspaceOwnership('xintai','self');
  expect(workspaceRole(useStudio.getState(),'xintai')).toBe('editor');
  expect(normalizeWorkspaceState(useStudio.getState()).workspaceMembers.xintai.find(m=>m.id==='self')?.role).toBe('owner');
 });
 it('rejects pending, nonexistent, existing-owner, personal, archived or unauthorized transfers',()=>{
  const s=useStudio.getState(),pending=s.inviteWorkspaceMember('xintai','pending','viewer');
  for(const id of ['self','missing',pending.id])expect(()=>s.transferWorkspaceOwnership('xintai',id)).toThrow();
  expect(()=>s.transferWorkspaceOwnership('personal','self')).toThrow();
  const m=joined();s.setWorkspaceActor('xintai',m.id);expect(()=>s.transferWorkspaceOwnership('xintai','self')).toThrow();
  s.setWorkspaceActor('xintai','self');s.archiveWorkspace('xintai');expect(()=>s.transferWorkspaceOwnership('xintai',m.id)).toThrow();
  s.deleteWorkspace('xintai');expect(()=>s.transferWorkspaceOwnership('xintai',m.id)).toThrow();
 });
 it('allows the new owner to manage the previous owner without reviving removed access on reload',()=>{
  const m=joined(),s=useStudio.getState();s.transferWorkspaceOwnership('xintai',m.id);s.setWorkspaceActor('xintai',m.id);
  s.changeWorkspaceMemberRole('xintai','self','viewer');s.removeWorkspaceMember('xintai','self');
  const restored=normalizeWorkspaceState(useStudio.getState());expect(restored.workspaceMembers.xintai.some(m=>m.id==='self')).toBe(false);
  expect(restored.workspaceMembers.xintai.filter(m=>m.role==='owner')).toHaveLength(1);
 });
});

describe('ownership hydration integrity',()=>{
 it('does not adopt an unversioned legacy owner declaration',()=>{
  const normalized=normalizeWorkspaceState({workspaceMembers:{xintai:[{id:'external',account:'external',name:'外部',role:'owner',status:'member'}]}});
  expect(normalized.workspaceMembers.xintai).toEqual([{id:'self',account:'jiming',name:'纪鸣',role:'owner',status:'member'}]);
 });
 it('rebuilds malformed transferred roles with exactly one owner and no pending-owner access',()=>{
  const normalized=normalizeWorkspaceState({workspaceSchemaVersion:2,workspaceMembers:{xintai:[{id:'a',account:'a',name:'a',role:'owner',status:'member'},{id:'b',account:'b',name:'b',role:'owner',status:'member'},{id:'pending',account:'pending',name:'pending',role:'owner',status:'invited'},{id:'editor',account:'editor',name:'editor',role:'editor',status:'member'}]},workspaceActors:{xintai:'a'}});
  expect(normalized.workspaceMembers.xintai.filter(m=>m.role==='owner').map(m=>m.id)).toEqual(['self']);
  expect(normalized.workspaceMembers.xintai.some(m=>m.id==='pending')).toBe(false);
  expect(normalized.workspaceMembers.xintai.find(m=>m.id==='editor')?.role).toBe('editor');
 });
 it('does not revive a former owner after store persistence merge',()=>{
  const initial=useStudio.getState(),m=joined();initial.transferWorkspaceOwnership('xintai',m.id);initial.setWorkspaceActor('xintai',m.id);initial.removeWorkspaceMember('xintai','self');
  const merged=useStudio.persist.getOptions().merge!(JSON.parse(JSON.stringify(useStudio.getState())),initial);
  expect(merged.workspaceMembers.xintai.some(m=>m.id==='self')).toBe(false);
  expect(workspaceRole(merged,'xintai')).toBe('owner');
 });
});
