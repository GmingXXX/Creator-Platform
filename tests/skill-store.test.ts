import {describe,it,expect} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {createSkillDraft,getSkillMetadata} from '../src/domain/skill-metadata';
import {prepareSkillSave,prepareSkillAdoption} from '../src/domain/skill-store';
import {skillCanManage,skillAvailableToActor,skillActorAccount} from '../src/domain/skill-access';
const make=()=>({...createSkillDraft(),name:'方法',description:'说明',input:'资料',steps:['核对']});
describe('unified skill account ownership',()=>{
 it('saves owned drafts and increments revisions without tying them to project workspace',()=>{
  const s=createInitialData(),draft=make(),saved=prepareSkillSave({...s,activeWorkspaceId:'xintai'},draft);
  expect(saved.workspaceId).toBe('personal');expect(saved.metadata?.ownerAccount).toBe('jiming');
  expect(prepareSkillSave({...s,skills:[saved]},{...saved,description:'更新'}).revision).toBe(2);
 });
 it('rejects foreign owners and forbids editing ownership or expanding legacy scope',()=>{
  const s=createInitialData(),draft=make(),foreign={...draft,metadata:{...getSkillMetadata(draft),ownerAccount:'someone'}};
  expect(()=>prepareSkillSave({...s,skills:[foreign]},foreign)).toThrow();
  expect(()=>prepareSkillSave({...s,skills:[draft]},{...draft,metadata:{...getSkillMetadata(draft),ownerAccount:'someone'}})).toThrow();
  const legacy={...draft,metadata:{...getSkillMetadata(draft),visibility:'restricted' as const,allowedWorkspaceIds:['xintai']}};
  expect(()=>prepareSkillSave({...s,skills:[legacy]},{...legacy,metadata:{...legacy.metadata,visibility:'team'}})).toThrow();
  expect(()=>prepareSkillSave(s,{...draft,public:true})).toThrow();
 });
 it('keeps restricted member access and management permissions distinct',()=>{
  const s=createInitialData(),draft=make(),legacy={...draft,metadata:{...getSkillMetadata(draft),visibility:'restricted' as const,allowedWorkspaceIds:['xintai']}};
  const member={id:'viewer',account:'viewer',name:'只读',role:'viewer' as const,status:'member' as const};
  const state={...s,activeWorkspaceId:'xintai',workspaceActors:{...s.workspaceActors,xintai:'viewer'},workspaceMembers:{...s.workspaceMembers,xintai:[member]}};
  expect(skillActorAccount(state)).toBe('viewer');expect(skillAvailableToActor(legacy,state)).toBe(true);expect(skillCanManage(legacy,state)).toBe(false);
  expect(()=>prepareSkillSave(state,legacy)).toThrow();
  expect(skillActorAccount({...state,workspaceActors:{xintai:'missing'}})).toBeUndefined();
  expect(skillAvailableToActor(draft,{...state,workspaceActors:{xintai:'missing'}})).toBe(false);
 });
 it('adopts a reviewed version once per owner and never copies accessible private methods for projects',()=>{
  const s=createInitialData(),draft=make();expect(prepareSkillAdoption({...s,skills:[draft]},draft.id)).toBe(draft);
  const pub={...draft,public:true,personal:false},copy=prepareSkillAdoption({...s,skills:[pub]},pub.id)!;
  expect(copy.workspaceId).toBe('personal');expect(copy.metadata?.visibility).toBe('private');
  expect(prepareSkillAdoption({...s,skills:[pub,copy]},pub.id)).toBe(copy);expect(prepareSkillAdoption(s,'missing')).toBeUndefined();
  expect(skillCanManage(pub,s)).toBe(false);
 });
});
