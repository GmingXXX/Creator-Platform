import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {selectPresentationKnowledge,presentationKnowledgeStatus,normalizePresentationKnowledge} from '../src/domain/presentation-knowledge';
import {buildPresentationWork,presentationQuestionMessages} from '../src/domain/presentation-generation';
import {readPresentationStudio,writePresentationStudio,questionWork} from '../src/features/studios/presentation-studio';
const fixture=()=>buildPresentationWork({title:'演示',sections:[{title:'第一页',narration:'正文。',bullets:['内容'],layout:'bullets'}]},{prompt:'',model:'demo',styleId:'',workspaceId:'xintai',width:1920,height:1080,referenceText:'',assets:[]});
beforeEach(()=>useStudio.setState(createInitialData()));
describe('presentation knowledge reference',()=>{
 it('defaults to no knowledge reference and refuses unbound spaces',()=>{const w=fixture();expect(readPresentationStudio(w).qa.knowledge).toBeUndefined();expect(()=>selectPresentationKnowledge(useStudio.getState(),w)).toThrow(/绑定/);expect(()=>selectPresentationKnowledge(useStudio.getState(),{...w,workspaceId:'personal'})).toThrow(/绑定/);});
 it('uses and persists the personal field for personal presentations, independent of the active project',()=>{
  const w={...fixture(),workspaceId:'personal'};
  useStudio.getState().bindWorkspaceKnowledge('personal',{fieldId:'personal-demo',fieldName:'个人模拟知识场',demoCatalogId:'zhichuang-20261116'});
  useStudio.getState().setWorkspace('xintai');
  const reference=selectPresentationKnowledge(useStudio.getState(),w);
  expect(normalizePresentationKnowledge(reference)).toEqual(reference);
  expect(presentationKnowledgeStatus(useStudio.getState(),w,reference).state).toBe('demo-ready');
  expect(presentationKnowledgeStatus(useStudio.getState(),fixture(),reference).canSelect).toBe(false);
 });
 it('persists an explicit binding snapshot while never claiming retrieval',()=>{const w=fixture();useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'field-a',fieldName:'客户知识本地场'});const selected=selectPresentationKnowledge(useStudio.getState(),w);const s=readPresentationStudio(w);const saved=readPresentationStudio(writePresentationStudio(w,{...s,qa:{...s.qa,knowledge:selected}}));expect(saved.qa.knowledge).toEqual(selected);const status=presentationKnowledgeStatus(useStudio.getState(),w,selected);expect(status.state).toBe('not-connected');expect(status.notice).toContain('未检索');expect(status.fieldName).toBe('客户知识本地场');});
 it('does not silently follow rebinding or copied workspaces',()=>{const w=fixture();useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'field-a',fieldName:'甲'});const selected=selectPresentationKnowledge(useStudio.getState(),w);useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'field-b',fieldName:'乙'});expect(presentationKnowledgeStatus(useStudio.getState(),w,selected).state).toBe('changed');useStudio.getState().bindWorkspaceKnowledge('dongguan',{fieldId:'field-c',fieldName:'丙'});expect(presentationKnowledgeStatus(useStudio.getState(),{...w,workspaceId:'dongguan'},selected).state).toBe('changed');});
 it('recognizes removed bindings and unavailable spaces',()=>{const w=fixture();useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'field-a',fieldName:'甲'});const selected=selectPresentationKnowledge(useStudio.getState(),w);useStudio.getState().unbindWorkspaceKnowledge('xintai');expect(presentationKnowledgeStatus(useStudio.getState(),w,selected).state).toBe('unbound');expect(presentationKnowledgeStatus(useStudio.getState(),{...w,workspaceId:'missing'},selected).state).toBe('unavailable');});
 it('rejects corrupt persisted references and ignores invented remote status',()=>{expect(normalizePresentationKnowledge(null)).toBeUndefined();expect(normalizePresentationKnowledge({workspaceId:'xintai',fieldId:'a b',fieldName:'x',bindingRevision:1})).toBeUndefined();expect(normalizePresentationKnowledge({workspaceId:'xintai',fieldId:'a',fieldName:'x',bindingRevision:-1})).toBeUndefined();expect(normalizePresentationKnowledge({workspaceId:'xintai',fieldId:'a',fieldName:'x',bindingRevision:1,status:'connected',secret:'x'})).toEqual({workspaceId:'xintai',fieldId:'a',fieldName:'x',bindingRevision:1});});
 it('does not put configured ACP metadata or invented evidence into the model context',()=>{const w=fixture();useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'secret-field-id',fieldName:'未读取资料'});const s=readPresentationStudio(w),knowledge=selectPresentationKnowledge(useStudio.getState(),w);const messages=presentationQuestionMessages(questionWork(w,{...s,qa:{...s.qa,knowledge}},0),'问题',0);expect(JSON.stringify(messages)).not.toContain('secret-field-id');expect(JSON.stringify(messages)).not.toContain('未读取资料');});
});
