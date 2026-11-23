import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {normalizeWorkspaceState} from '../src/domain/workspace-management';
import {captureKnowledgeTarget,validateKnowledgeField} from '../src/domain/workspace-knowledge';

beforeEach(()=>useStudio.setState(createInitialData()));
const field={fieldId:'acp:customer/中铁-001',fieldName:'中铁知识本地场'};
function asMember(role:'editor'|'viewer'){
 const state=useStudio.getState(),member=state.inviteWorkspaceMember('xintai',`${role}@example.com`,role);
 state.acceptWorkspaceInvitation('xintai',member.id);state.setWorkspaceActor('xintai',member.id);
}
describe('ACP knowledge field local binding',()=>{
 it('starts unbound without inventing ACP catalog entries',()=>{
  expect(useStudio.getState().workspaceKnowledge).toEqual({});
  expect(captureKnowledgeTarget(useStudio.getState(),'xintai')).toEqual({workspaceId:'xintai',state:'unbound'});
  expect(captureKnowledgeTarget(useStudio.getState(),'personal')).toEqual({workspaceId:'personal',state:'personal'});
  expect(()=>captureKnowledgeTarget(useStudio.getState(),'missing')).toThrow();
 });
 it('binds a stable opaque identifier and records only local configuration',()=>{
  const state=useStudio.getState(),before=state.workspaceKnowledge;
  state.bindWorkspaceKnowledge('xintai',{fieldId:` ${field.fieldId} `,fieldName:` ${field.fieldName} `});
  const binding=useStudio.getState().workspaceKnowledge.xintai;
  expect(binding).toMatchObject({...field,provider:'acp',status:'configured',revision:1});expect(Number.isFinite(Date.parse(binding.updatedAt))).toBe(true);
  expect(before).toEqual({});
  state.bindWorkspaceKnowledge('xintai',{...field,fieldName:'重命名后的知识场'});
  expect(useStudio.getState().workspaceKnowledge.xintai).toMatchObject({fieldId:field.fieldId,fieldName:'重命名后的知识场',revision:2,status:'configured'});
 });
 it.each(['editor','viewer'] as const)('prevents %s from binding or removing the project binding',role=>{
  const state=useStudio.getState();state.bindWorkspaceKnowledge('xintai',field);asMember(role);
  const before=useStudio.getState().workspaceKnowledge;
  expect(()=>state.bindWorkspaceKnowledge('xintai',{fieldId:'other',fieldName:'其他场'})).toThrow();
  expect(()=>state.unbindWorkspaceKnowledge('xintai')).toThrow();expect(useStudio.getState().workspaceKnowledge).toBe(before);
 });
 it('rejects missing spaces for binding or unbinding',()=>{
  const state=useStudio.getState();for(const id of ['missing']){
   expect(()=>state.bindWorkspaceKnowledge(id,field)).toThrow();expect(()=>state.unbindWorkspaceKnowledge(id)).toThrow();
  }
 });
 it('binds personal knowledge independently, preserves it on restore, and keeps member management closed',()=>{
  const state=useStudio.getState();state.bindWorkspaceKnowledge('personal',{fieldId:'personal-field',fieldName:'我的知识本地场'});
  state.bindWorkspaceKnowledge('xintai',field);state.setWorkspace('xintai');
  const target=captureKnowledgeTarget(useStudio.getState(),'personal');
  expect(target).toMatchObject({workspaceId:'personal',fieldId:'personal-field',state:'not-connected',bindingRevision:1});
  const saved=JSON.parse(JSON.stringify(useStudio.getState()));
  expect(normalizeWorkspaceState(saved).workspaceKnowledge.personal.fieldId).toBe('personal-field');
  expect(()=>state.inviteWorkspaceMember('personal','guest','editor')).toThrow();
  expect(()=>state.archiveWorkspace('personal')).toThrow();
  expect(()=>state.deleteWorkspace('personal')).toThrow();
  state.unbindWorkspaceKnowledge('personal');
  expect(captureKnowledgeTarget(useStudio.getState(),'personal')).toEqual({workspaceId:'personal',state:'personal'});
  expect(useStudio.getState().workspaceKnowledge.xintai.fieldId).toBe(field.fieldId);
  expect(target.fieldId).toBe('personal-field');
 });
 it('prevents duplicate field binding across spaces without changing either mapping',()=>{
  const state=useStudio.getState();state.bindWorkspaceKnowledge('xintai',field);
  const before=useStudio.getState().workspaceKnowledge;
  expect(()=>state.bindWorkspaceKnowledge('dongguan',field)).toThrow(/已绑定/);expect(useStudio.getState().workspaceKnowledge).toBe(before);
  state.bindWorkspaceKnowledge('dongguan',{...field,fieldId:'DifferentCase'});
  expect(useStudio.getState().workspaceKnowledge.dongguan.fieldId).toBe('DifferentCase');
 });
 it('creates and binds a workspace atomically, never leaving a partial space on invalid data',()=>{
  const state=useStudio.getState(),space=state.createWorkspace({name:'新客户',knowledgeField:field});
  expect(useStudio.getState().workspaceKnowledge[space.id]).toMatchObject(field);
  const before=useStudio.getState();
  expect(()=>state.createWorkspace({name:'重复客户',knowledgeField:field})).toThrow(/已绑定/);
  expect(()=>state.createWorkspace({name:'无效知识场',knowledgeField:{...field,fieldId:'bad id'}})).toThrow();
  expect(useStudio.getState()).toBe(before);
 });
 it('captures immutable upload targets unaffected by workspace switches, edits or unbinding',()=>{
  const state=useStudio.getState();state.bindWorkspaceKnowledge('xintai',field);
  const captured=captureKnowledgeTarget(useStudio.getState(),'xintai');
  state.setWorkspace('dongguan');state.bindWorkspaceKnowledge('xintai',{fieldId:'new-id',fieldName:'新场'});state.unbindWorkspaceKnowledge('xintai');
  expect(captured).toEqual({workspaceId:'xintai',fieldId:field.fieldId,fieldName:field.fieldName,bindingRevision:1,state:'not-connected'});
  expect(Object.isFrozen(captured)).toBe(true);expect(useStudio.getState().workspaceKnowledge.xintai).toBeUndefined();
  expect(captureKnowledgeTarget(useStudio.getState(),'xintai').state).toBe('unbound');
  expect(()=>state.unbindWorkspaceKnowledge('xintai')).not.toThrow();
 });
 it('preserves preset and custom bindings through store restore and reset',()=>{
  const state=useStudio.getState();state.bindWorkspaceKnowledge('xintai',field);
  const space=state.createWorkspace({name:'自建空间',knowledgeField:{fieldId:'custom',fieldName:'自建知识场'}});
  const saved=JSON.parse(JSON.stringify(useStudio.getState()));
  const restored=useStudio.persist.getOptions().merge!(saved,state);
  expect(restored.workspaceKnowledge).toEqual(useStudio.getState().workspaceKnowledge);
  expect(restored.workspaceKnowledge[space.id].fieldId).toBe('custom');state.resetDemo();expect(useStudio.getState().workspaceKnowledge).toEqual(restored.workspaceKnowledge);
 });
 it('normalizes corrupted persisted mapping without trusting remote status or unknown spaces',()=>{
  const good={...field,provider:'acp',status:'connected',revision:3,updatedAt:'2026-11-17T00:00:00.000Z'};
  const normalized=normalizeWorkspaceState({workspaceKnowledge:{xintai:good,dongguan:good,aitown:{...good,fieldId:'second',revision:-10,updatedAt:'invalid'},personal:{...good,fieldId:'personal-field'},missing:good}});
  expect(Object.keys(normalized.workspaceKnowledge)).toEqual(['personal','xintai','aitown']);
  expect(normalized.workspaceKnowledge.xintai).toEqual({...good,status:'configured'});
  expect(normalized.workspaceKnowledge.aitown).toMatchObject({revision:1,status:'configured',updatedAt:'1970-01-01T00:00:00.000Z'});
  expect(normalizeWorkspaceState({workspaceKnowledge:{xintai:{...good,provider:'other'},dongguan:{...good,fieldId:' '},aitown:null}}).workspaceKnowledge).toEqual({});
  expect(normalizeWorkspaceState({workspaceKnowledge:[]}).workspaceKnowledge).toEqual({});
 });
 it('validates names and opaque identifiers at the boundary',()=>{
  for(const value of ['', ' ', 'x'.repeat(201), 'a b', 'a\nb', 'a\u0000b', 'a\u007fb'])expect(()=>validateKnowledgeField({...field,fieldId:value})).toThrow();
  for(const value of ['', ' ', 'x'.repeat(81), 'a\nb'])expect(()=>validateKnowledgeField({...field,fieldName:value})).toThrow();
  expect(()=>validateKnowledgeField(null as never)).toThrow();expect(()=>validateKnowledgeField({fieldId:42,fieldName:42} as never)).toThrow();
  expect(validateKnowledgeField({fieldId:'客户:/opaque@id#01',fieldName:' 某客户 知识本地场 '})).toEqual({fieldId:'客户:/opaque@id#01',fieldName:'某客户 知识本地场'});
 });
});
