import {beforeEach,describe,it,expect} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio,attachAssetToDraft} from '../src/domain/store';

// Set through the public local-demo membership actions, not a fabricated global role.
function viewerSpace(){
 const s=useStudio.getState();
 const space=s.createWorkspace({name:'权限验收'});
 const member=s.inviteWorkspaceMember(space.id,'viewer@example.com','viewer');
 s.acceptWorkspaceInvitation(space.id,member.id);
 const work=s.createWork({workspaceId:space.id,title:'受保护展项',type:'时间演进型',width:1920,height:1080});
 s.setWorkspaceActor(space.id,member.id);
 return {space,member,work};
}
beforeEach(()=>useStudio.setState(createInitialData()));
describe('workspace writes enforce member permissions',()=>{
 it('rejects direct project creation and saves for viewers without changing work data',()=>{
  const {space,work}=viewerSpace();const s=useStudio.getState(),before=structuredClone(s.works);
  expect(()=>s.createWork({workspaceId:space.id,title:'越权',type:'时间演进型',width:100,height:100})).toThrow();
  expect(()=>s.saveWork({...work,title:'越权改名'})).toThrow();
  expect(s.deleteWork(work.id)).toBe(false);expect(s.restoreWork(work.id)).toBe(false);
  expect(s.duplicateWork(work.id)).toBeUndefined();s.archiveWork(work.id);
  expect(s.submitWork(work.id)).toBeUndefined();expect(s.reviseWork(work.id,'改标题').ok).toBe(false);
  expect(useStudio.getState().works).toEqual(before);
 });
 it('blocks shared resources but keeps personal resource creation available',()=>{
  const {space}=viewerSpace();const s=useStudio.getState();
  const asset={...s.assets[0],id:'viewer-shared',workspaceId:space.id,public:false,source:'uploaded' as const};
  expect(()=>s.addAsset(asset)).toThrow();expect(useStudio.getState().assets.some(a=>a.id===asset.id)).toBe(false);
  s.addAsset({...asset,id:'viewer-personal',workspaceId:'personal'});
  expect(useStudio.getState().assets.some(a=>a.id==='viewer-personal')).toBe(true);
  expect(s.adoptAsset(s.assets[0].id,space.id)).toBeUndefined();
 });
 it('does not let a forged destination move an existing shared asset or skill into personal',()=>{
  const s=useStudio.getState(),space=s.createWorkspace({name:'资源防护'});
  const asset={...s.assets[0],id:'locked-asset',workspaceId:space.id,public:false,source:'uploaded' as const};s.addAsset(asset);
  const skill={...s.skills[0],id:'locked-skill',workspaceId:space.id,personal:true,public:false};s.addSkill(skill);
  const member=s.inviteWorkspaceMember(space.id,'reader','viewer');s.acceptWorkspaceInvitation(space.id,member.id);s.setWorkspaceActor(space.id,member.id);
  expect(()=>s.addAsset({...asset,workspaceId:'personal'})).toThrow();expect(()=>s.addSkill({...skill,workspaceId:'personal'})).toThrow();
  expect(s.removeAsset(asset.id)).toBe(false);expect(s.updateAssetMetadata(asset.id,{})).toBe(false);
 });
 it('blocks drafts, generation and delayed uploads after changing role',()=>{
  const s=useStudio.getState(),space=s.createWorkspace({name:'异步防护'});s.updateDraft({text:'企业发展时间轴'});
  const draft=useStudio.getState().activeDraftId,run=s.startRun()!;
  const member=s.inviteWorkspaceMember(space.id,'reader','viewer');s.acceptWorkspaceInvitation(space.id,member.id);s.setWorkspaceActor(space.id,member.id);
  const before=structuredClone(useStudio.getState().drafts);
  s.updateDraft({text:'越权'});expect(s.startRun()).toBeUndefined();s.completeRun(run.id);
  expect(useStudio.getState().runs.find(r=>r.id===run.id)?.workId).toBeUndefined();
  expect(()=>attachAssetToDraft(draft,{...s.assets[0],id:'late',workspaceId:space.id})).toThrow();
  expect(useStudio.getState().drafts).toEqual(before);
 });
 it('reset retains custom spaces and their uploaded files, and rejects global reset with a read-only space',()=>{
  const s=useStudio.getState(),space=s.createWorkspace({name:'重置保留空间'});
  const asset={...s.assets[0],id:'retained-upload',workspaceId:space.id,source:'uploaded' as const,public:false};s.addAsset(asset);
  const member=s.inviteWorkspaceMember(space.id,'reader','viewer');s.acceptWorkspaceInvitation(space.id,member.id);
  s.resetDemo();let current=useStudio.getState();
  expect(current.workspaces.some(item=>item.id===space.id)).toBe(true);
  expect(current.assets.find(item=>item.id===asset.id)?.workspaceId).toBe(space.id);
  expect(current.workspaceMembers[space.id].some(item=>item.id===member.id)).toBe(true);
  current.setWorkspaceActor(space.id,member.id);current.setWorkspace('personal');
  const works=current.works;expect(()=>current.resetDemo()).toThrow();expect(useStudio.getState().works).toBe(works);
 });

});
