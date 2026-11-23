import {beforeEach,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {normalizeWorkspaceState} from '../src/domain/workspace-management';
import {captureKnowledgeTarget,isDemoKnowledgeBinding,validateKnowledgeField} from '../src/domain/workspace-knowledge';
beforeEach(()=>useStudio.setState(createInitialData()));
const demo={fieldName:'智创案例演示知识本地场',fieldId:'demo-xintai',demoCatalogId:'zhichuang-20261116' as const};
it('only an explicit known demo catalog opts into simulation, never an opaque id alone',()=>{
 expect(isDemoKnowledgeBinding(undefined)).toBe(false);
 expect(isDemoKnowledgeBinding({fieldId:demo.fieldId,fieldName:demo.fieldName})).toBe(false);
 expect(isDemoKnowledgeBinding(demo)).toBe(true);
 expect(()=>validateKnowledgeField({...demo,demoCatalogId:'unknown'} as never)).toThrow();
});
it('persists a simulated binding without importing files or claiming ACP connection',()=>{
 const before=useStudio.getState();before.bindWorkspaceKnowledge('xintai',demo);
 const state=useStudio.getState(),binding=state.workspaceKnowledge.xintai;
 expect(binding).toMatchObject({...demo,status:'configured',provider:'acp'});
 expect(state.assets).toBe(before.assets);expect(state.skills).toBe(before.skills);
 expect(isDemoKnowledgeBinding(normalizeWorkspaceState(state).workspaceKnowledge.xintai)).toBe(true);
 expect(captureKnowledgeTarget(state,'xintai')).toMatchObject({demoCatalogId:demo.demoCatalogId,state:'not-connected'});
});
it('switches back to an ordinary configuration explicitly and leaves historical routing intact',()=>{
 const state=useStudio.getState();state.bindWorkspaceKnowledge('xintai',demo);
 const previous=captureKnowledgeTarget(useStudio.getState(),'xintai');
 state.bindWorkspaceKnowledge('xintai',{fieldId:'real-acp-id',fieldName:'真实配置'});
 expect(isDemoKnowledgeBinding(useStudio.getState().workspaceKnowledge.xintai)).toBe(false);
 expect(previous.demoCatalogId).toBe(demo.demoCatalogId);
});
it('new spaces can bind simulation atomically and invalid persisted catalogs are not accepted',()=>{
 const space=useStudio.getState().createWorkspace({name:'演示空间',knowledgeField:demo});
 expect(isDemoKnowledgeBinding(useStudio.getState().workspaceKnowledge[space.id])).toBe(true);
 const normalized=normalizeWorkspaceState({workspaceKnowledge:{xintai:{...demo,demoCatalogId:'unknown',provider:'acp'}}});
 expect(normalized.workspaceKnowledge.xintai).toBeUndefined();
});
