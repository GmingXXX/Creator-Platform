import {beforeEach,expect,it} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {captureKnowledgeTarget} from '../src/domain/workspace-knowledge';
beforeEach(()=>useStudio.setState(createInitialData()));
it('keeps original upload routing private when publishing or copying a resource',()=>{
 const state=useStudio.getState();state.setWorkspace('xintai');state.bindWorkspaceKnowledge('xintai',{fieldId:'private-acp-field',fieldName:'客户知识本地场'});
 const original={...state.assets[0],id:'knowledge-upload',name:'项目参考资料',source:'uploaded' as const,workspaceId:'xintai',public:false,knowledgeTarget:captureKnowledgeTarget(useStudio.getState(),'xintai')};state.addAsset(original);
 const same=state.adoptAsset(original.id,'xintai');expect(same?.knowledgeTarget?.fieldId).toBe('private-acp-field');
 const personal=state.adoptAsset(original.id,'personal');expect(personal).toBeDefined();expect(personal?.knowledgeTarget).toBeUndefined();
 const submissionId=state.submitAsset(original.id)!;state.setRole('reviewer');expect(state.reviewSubmission(submissionId,'approved')).toBe(true);
 expect(useStudio.getState().assets.find(asset=>asset.id===`published-${original.id}`)?.knowledgeTarget).toBeUndefined();
 expect(useStudio.getState().assets.find(asset=>asset.id===original.id)?.knowledgeTarget?.fieldId).toBe('private-acp-field');
});
