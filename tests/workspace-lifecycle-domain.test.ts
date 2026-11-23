import {beforeEach,describe,it,expect} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {workspaceCanEdit,workspaceCanManage,workspaceRole} from '../src/domain/workspace-management';
import {workspaceCanManageLifecycle,workspaceLifecycleSummary} from '../src/domain/workspace-lifecycle';
import {skillAvailableToActor,skillCanManage} from '../src/domain/skill-access';
import {getSkillMetadata} from '../src/domain/skill-metadata';

beforeEach(()=>useStudio.setState(createInitialData()));
const merge=()=>useStudio.persist.getOptions().merge!(JSON.parse(JSON.stringify(useStudio.getState())),useStudio.getState());
describe('workspace archive and recycle lifecycle',()=>{
 it('archives into read-only, returns to personal draft, and restores without altering content',()=>{
  const s=useStudio.getState();s.setWorkspace('xintai');const before=useStudio.getState();
  s.archiveWorkspace('xintai');const archived=useStudio.getState();
  expect(archived.activeWorkspaceId).toBe('personal');expect(archived.drafts.find(d=>d.id===archived.activeDraftId)?.workspaceId).toBe('personal');
  expect(workspaceCanEdit(archived,'xintai')).toBe(false);expect(workspaceCanManage(archived,'xintai')).toBe(false);expect(workspaceCanManageLifecycle(archived,'xintai')).toBe(true);
  expect(archived.works).toEqual(before.works);expect(archived.assets).toEqual(before.assets);expect(merge().workspaces.find(w=>w.id==='xintai')?.archivedAt).toBeTruthy();
  s.setWorkspace('xintai');expect(useStudio.getState().activeWorkspaceId).toBe('xintai');
  expect(()=>s.createWork({title:'阻止创建',type:'时间演进型',width:1920,height:1080})).toThrow();expect(()=>s.inviteWorkspaceMember('xintai','new-user','editor')).toThrow();
  s.unarchiveWorkspace('xintai');expect(workspaceCanEdit(useStudio.getState(),'xintai')).toBe(true);
 });
 it('protects personal space and checks owner on every transition',()=>{
  const s=useStudio.getState();
  for(const action of [s.archiveWorkspace,s.unarchiveWorkspace,s.deleteWorkspace,s.restoreWorkspace])expect(()=>action('personal')).toThrow();
  expect(()=>s.permanentlyDeleteWorkspace('personal','个人空间')).toThrow();expect(()=>s.archiveWorkspace('missing')).toThrow();
  const member=s.inviteWorkspaceMember('xintai','editor','editor');s.acceptWorkspaceInvitation('xintai',member.id);s.setWorkspaceActor('xintai',member.id);
  expect(()=>s.archiveWorkspace('xintai')).toThrow();expect(()=>s.deleteWorkspace('xintai')).toThrow();
 });
 it('soft deletion retains data and binding, blocks navigation and async writes, restore recovers',()=>{
  const s=useStudio.getState();s.setWorkspace('xintai');s.bindWorkspaceKnowledge('xintai',{fieldId:'field-xintai',fieldName:'信泰知识'});
  s.updateDraft({text:'制作企业大事记',model:'demo'});const run=s.startRun()!;const before=useStudio.getState();
  s.deleteWorkspace('xintai');expect(workspaceRole(useStudio.getState(),'xintai')).toBeUndefined();s.setWorkspace('xintai');expect(useStudio.getState().activeWorkspaceId).toBe('personal');
  s.completeRun(run.id);expect(useStudio.getState().works).toEqual(before.works);expect(useStudio.getState().workspaceKnowledge.xintai).toEqual(before.workspaceKnowledge.xintai);
  const restored=merge();expect(restored.workspaces.find(w=>w.id==='xintai')?.deletedAt).toBeTruthy();
  s.restoreWorkspace('xintai');expect(workspaceRole(useStudio.getState(),'xintai')).toBe('owner');expect(useStudio.getState().works).toEqual(before.works);
 });
 it('purges only scoped private content and binding, preserves public copies and no preset resurrection',()=>{
  const s=useStudio.getState();s.setWorkspace('xintai');s.bindWorkspaceKnowledge('xintai',{fieldId:'field-xintai',fieldName:'信泰知识'});
  const work=s.createWork({title:'删除测试',type:'时间演进型',width:1920,height:1080});
  const base=useStudio.getState().assets[0];useStudio.setState(state=>({assets:[...state.assets,{...base,id:'owned-private',workspaceId:'xintai',public:false,source:'uploaded'},{...base,id:'published-copy',workspaceId:'xintai',public:true}],conversationTurns:[...state.conversationTurns,{id:'scoped-turn',workId:work.id,prompt:'a',target:{scope:'work'},status:'applied',summary:'a',createdAt:new Date().toISOString()}]}));
  expect(workspaceLifecycleSummary(useStudio.getState(),'xintai').works).toBeGreaterThan(0);
  s.deleteWorkspace('xintai');expect(()=>s.permanentlyDeleteWorkspace('xintai','错误名字')).toThrow();
  const other=useStudio.getState().works.filter(w=>w.workspaceId!=='xintai');s.permanentlyDeleteWorkspace('xintai','信泰企业展厅');const after=useStudio.getState();
  expect(after.works).toEqual(other);expect(after.assets.some(a=>a.id==='owned-private')).toBe(false);expect(after.assets.some(a=>a.id==='published-copy')).toBe(true);expect(after.workspaceKnowledge.xintai).toBeUndefined();expect(after.conversationTurns.some(t=>t.id==='scoped-turn')).toBe(false);
  const reloaded=merge();expect(reloaded.workspaces.find(w=>w.id==='xintai')?.purgedAt).toBeTruthy();expect(reloaded.works.some(w=>w.workspaceId==='xintai')).toBe(false);expect(()=>s.restoreWorkspace('xintai')).toThrow();
 });
 it('rejects purge when retained content depends on a private asset',()=>{
  const s=useStudio.getState(),base=s.assets[0],work=s.works[0];
  useStudio.setState(state=>({assets:[...state.assets,{...base,id:'needed',workspaceId:'xintai',public:false,source:'uploaded'}],works:state.works.map(w=>w.id===work.id?{...w,pages:w.pages.map((p,i)=>i? p:{...p,nodes:[...p.nodes,{...p.nodes[0],assetId:'needed'}]})}:w)}));
  s.deleteWorkspace('xintai');expect(()=>s.permanentlyDeleteWorkspace('xintai','信泰企业展厅')).toThrow(/依赖/);expect(useStudio.getState().assets.some(a=>a.id==='needed')).toBe(true);
 });
 it('archived scoped skills remain readable but immutable, deleted scopes are inaccessible',()=>{
  const s=useStudio.getState(),skill={...s.skills[0],id:'archived-skill',workspaceId:'xintai',personal:true,public:false,metadata:{...getSkillMetadata(s.skills[0]),visibility:'restricted' as const,allowedWorkspaceIds:['xintai']}};useStudio.setState(state=>({skills:[...state.skills,skill]}));
  s.archiveWorkspace('xintai');expect(skillCanManage(skill,useStudio.getState())).toBe(false);expect(skillAvailableToActor(skill,useStudio.getState())).toBe(true);
  s.deleteWorkspace('xintai');expect(skillAvailableToActor(skill,useStudio.getState())).toBe(false);
 });
 it('preserves account-owned skills and narrows multi-space sharing without deleting other access',()=>{
  const s=useStudio.getState(),base=s.skills[0],metadata={...getSkillMetadata(base),ownerAccount:'jiming'};
  const personal={...base,id:'historical-personal',workspaceId:'xintai',personal:true,public:false,metadata:{...metadata,visibility:'private' as const,allowedWorkspaceIds:[]}};
  const team={...personal,id:'historical-team',metadata:{...metadata,visibility:'team' as const,allowedWorkspaceIds:[]}};
  const shared={...personal,id:'multi-space',metadata:{...metadata,visibility:'restricted' as const,allowedWorkspaceIds:['xintai','dongguan']}};
  useStudio.setState(state=>({skills:[...state.skills,personal,team,shared]}));
  const personalSubmission=s.submitSkill(personal.id)!,teamSubmission=s.submitSkill(team.id)!,sharedSubmission=s.submitSkill(shared.id)!;
  s.deleteWorkspace('xintai');s.permanentlyDeleteWorkspace('xintai','信泰企业展厅');const after=useStudio.getState();
  expect(after.skills.find(item=>item.id===personal.id)).toEqual(personal);expect(after.skills.find(item=>item.id===team.id)).toEqual(team);
  expect(after.skills.find(item=>item.id===shared.id)?.metadata?.allowedWorkspaceIds).toEqual(['dongguan']);expect(shared.metadata.allowedWorkspaceIds).toEqual(['xintai','dongguan']);
  for(const id of [personalSubmission,teamSubmission,sharedSubmission])expect(after.submissions.some(sub=>sub.id===id)).toBe(true);
  s.setRole('reviewer');for(const id of [personalSubmission,teamSubmission,sharedSubmission])expect(s.reviewSubmission(id,'approved')).toBe(true);
  expect(s.submitSkill(personal.id)).toBeTruthy();
 });
 it('prevents review of exclusively archived or deleted space skills',()=>{
  const s=useStudio.getState(),skill=s.skills.find(item=>getSkillMetadata(item).visibility==='restricted'&&getSkillMetadata(item).allowedWorkspaceIds.includes('xintai'))!;
  const sub=s.submitSkill(skill.id)!;s.setRole('reviewer');s.archiveWorkspace('xintai');expect(s.reviewSubmission(sub,'approved')).toBe(false);
  s.deleteWorkspace('xintai');expect(s.reviewSubmission(sub,'approved')).toBe(false);
 });
});
