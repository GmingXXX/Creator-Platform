import {describe,it,expect} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {submissionSpaceVisible} from '../src/domain/submission-space-access';
import {getSkillMetadata} from '../src/domain/skill-metadata';
describe('submission space visibility',()=>{
 it('hides private submission snapshots after space deletion while retaining published copies',()=>{
  const state=createInitialData(),work={...state.works[0],workspaceId:'xintai'};
  const submission={...state.submissions[0],work,status:'pending' as const};
  expect(submissionSpaceVisible(state,submission)).toBe(true);
  const archived={...state,workspaces:state.workspaces.map(space=>space.id==='xintai'?{...space,archivedAt:new Date().toISOString()}:space)};
  expect(submissionSpaceVisible(archived,submission)).toBe(true);
  const deleted={...state,workspaces:state.workspaces.map(space=>space.id==='xintai'?{...space,deletedAt:new Date().toISOString()}:space)};
  expect(submissionSpaceVisible(deleted,submission)).toBe(false);
  expect(submissionSpaceVisible(deleted,{...submission,status:'approved'})).toBe(true);
 });
 it('checks asset and skill snapshots and refuses missing spaces',()=>{
  const state=createInitialData(),base={...state.submissions[0],work:undefined,status:'pending' as const};
  expect(submissionSpaceVisible(state,{...base,asset:{...state.assets[0],workspaceId:'gone'}})).toBe(false);
  expect(submissionSpaceVisible(state,{...base,skill:{...state.skills[0],id:'missing-skill',workspaceId:'gone'}})).toBe(false);
  expect(submissionSpaceVisible(state,{...base,asset:{...state.assets[0],workspaceId:'personal'}})).toBe(true);
 });
 it('retains private account-owned skill submissions despite a historical deleted workspace',()=>{
  const state=createInitialData(),skill={...state.skills[0],workspaceId:'gone',personal:true,public:false,metadata:{...getSkillMetadata(state.skills[0]),visibility:'private' as const,ownerAccount:'jiming'}};
  expect(submissionSpaceVisible({...state,skills:[skill]},{...state.submissions[0],work:undefined,asset:undefined,skill,status:'pending'})).toBe(true);
 });
});
