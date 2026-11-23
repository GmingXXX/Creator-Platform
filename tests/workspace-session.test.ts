import {beforeEach,describe,it,expect} from 'vitest';
import {createInitialData,createDraft} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
const merge=(data:unknown)=>useStudio.persist.getOptions().merge!(data,useStudio.getState());
beforeEach(()=>useStudio.setState(createInitialData()));
describe('workspace refresh ownership',()=>{
 it('restores the selected workspace instead of the last draft from another space',()=>{
  const state=useStudio.getState(),personal=createDraft({workspaceId:'personal',text:'个人需求'}),project=createDraft({workspaceId:'xintai',text:'项目需求',attachmentIds:['project-only']});
  const restored=merge({...state,composerSchemaVersion:1,activeWorkspaceId:'xintai',activeDraftId:personal.id,drafts:[personal,project]});
  expect(restored.activeWorkspaceId).toBe('xintai');expect(restored.activeDraftId).toBe(project.id);expect(restored.drafts).toEqual([personal,project]);
 });
 it('creates a blank draft in the current space without moving an unrelated draft',()=>{
  const state=useStudio.getState(),personal=createDraft({workspaceId:'personal',text:'独立个人需求'});
  const restored=merge({...state,composerSchemaVersion:1,activeWorkspaceId:'dongguan',activeDraftId:personal.id,drafts:[personal]});
  expect(restored.activeWorkspaceId).toBe('dongguan');expect(restored.drafts.find(d=>d.id===restored.activeDraftId)).toMatchObject({workspaceId:'dongguan',text:'',attachmentIds:[]});expect(restored.drafts).toContainEqual(personal);
 });
 it('keeps the active draft when it belongs to the selected project',()=>{
  const state=useStudio.getState(),a=createDraft({workspaceId:'xintai',text:'旧'}),b=createDraft({workspaceId:'xintai',text:'当前'});
  expect(merge({...state,composerSchemaVersion:1,activeWorkspaceId:'xintai',activeDraftId:b.id,drafts:[a,b]}).activeDraftId).toBe(b.id);
 });
 it('falls back with an explanation when saved space or actor access disappears',()=>{
  const state=useStudio.getState(),project=createDraft({workspaceId:'gone',text:'不能移动此资料'});
  const missing=merge({...state,composerSchemaVersion:1,activeWorkspaceId:'gone',activeDraftId:project.id,drafts:[project]});
  expect(missing.activeWorkspaceId).toBe('personal');expect(missing.workspaceRestoreNotice).toContain('不可用');expect(missing.drafts).toContainEqual(project);
  const revoked=merge({...state,composerSchemaVersion:1,activeWorkspaceId:'xintai',workspaceActors:{...state.workspaceActors,xintai:'removed-member'}});
  expect(revoked.activeWorkspaceId).toBe('personal');expect(revoked.workspaceRestoreNotice).toContain('访问');
 });
});
