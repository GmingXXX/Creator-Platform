import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import evidence from '../src/domain/demo-knowledge-evidence.json';
import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {buildPresentationWork} from '../src/domain/presentation-generation';
import {selectPresentationKnowledge,presentationKnowledgeStatus} from '../src/domain/presentation-knowledge';
import {answerDemoKnowledge,presentationKnowledgeDocuments} from '../src/domain/presentation-demo-knowledge';
const work=()=>buildPresentationWork({title:'客户介绍',sections:[{title:'能力',narration:'介绍设备能力。',bullets:['设备'],layout:'bullets'}]},{prompt:'',model:'demo',styleId:'',workspaceId:'xintai',width:1920,height:1080,referenceText:'',assets:[]});
const bind=()=>{useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'demo-xintai',fieldName:'演示知识场',demoCatalogId:'zhichuang-20261116'});return selectPresentationKnowledge(useStudio.getState(),work());};
beforeEach(()=>useStudio.setState(createInitialData()));
describe('simulated presentation knowledge QA',()=>{
 it('answers from an explicitly bound personal field and rejects another space reference',()=>{
  useStudio.getState().bindWorkspaceKnowledge('personal',{fieldId:'demo-personal',fieldName:'个人演示知识',demoCatalogId:'zhichuang-20261116'});
  const personalWork={...work(),workspaceId:'personal'},ref=selectPresentationKnowledge(useStudio.getState(),personalWork);
  useStudio.getState().setWorkspace('dongguan');
  expect(answerDemoKnowledge(useStudio.getState(),personalWork,ref,'单位产品能耗下降多少')?.answer).toContain('12%');
  expect(answerDemoKnowledge(useStudio.getState(),work(),ref,'能耗')).toBeUndefined();
 });
 it('requires explicit simulation binding and per-work opt-in',()=>{bind();expect(answerDemoKnowledge(useStudio.getState(),work(),undefined,'能耗降低多少')).toBeUndefined();useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'real',fieldName:'真实待连接'});const ref=selectPresentationKnowledge(useStudio.getState(),work());expect(answerDemoKnowledge(useStudio.getState(),work(),ref,'能耗降低多少')).toBeUndefined();});
 it('reports simulation and answers with actual source and metric scope',()=>{const ref=bind();expect(presentationKnowledgeStatus(useStudio.getState(),work(),ref).state).toBe('demo-ready');const result=answerDemoKnowledge(useStudio.getState(),work(),ref,'绿色运营的单位产品能耗下降多少？');expect(result?.answer).toContain('12%');expect(answerDemoKnowledge(useStudio.getState(),work(),ref,'能耗')?.answer).toContain('12%');expect(result?.answer).toContain('2020');expect(result?.sources.some(s=>s.name==='星澜智造_智能演示大纲.pptx'&&s.location==='第 5 页')).toBe(true);expect(presentationKnowledgeDocuments(useStudio.getState(),work(),ref)).toHaveLength(4);});
 it('does not invent unprovided answers',()=>{const ref=bind();const result=answerDemoKnowledge(useStudio.getState(),work(),ref,'公司董事长手机号码是多少？');expect(result?.answer).toContain('未提供');expect(result?.sources).toEqual([]);});
 it('rejects rebinding, cross-space reuse, missing access and deleted works',()=>{const ref=bind();expect(answerDemoKnowledge(useStudio.getState(),{...work(),workspaceId:'dongguan'},ref,'能耗')).toBeUndefined();expect(answerDemoKnowledge(useStudio.getState(),{...work(),deletedAt:'now'},ref,'能耗')).toBeUndefined();useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'another',fieldName:'另一个',demoCatalogId:'zhichuang-20261116'});expect(answerDemoKnowledge(useStudio.getState(),work(),ref,'能耗')).toBeUndefined();});
 it('honors document deletion or AI denial in the current binding',()=>{const ref=bind();const base=useStudio.getState().assets[0];useStudio.setState({assets:[{...base,id:'denied',workspaceId:'xintai',deletedAt:'now',package:{id:'p',version:'1',prompt:'',files:[],skillIds:[],complete:true,params:{knowledgeCatalogId:'zhichuang-20261116',knowledgeFieldId:ref.fieldId,knowledgeRevision:String(ref.bindingRevision),knowledgeCase:'presentation',knowledgePath:'星澜智造_智能演示大纲.pptx'}}}]});expect(presentationKnowledgeDocuments(useStudio.getState(),work(),ref).map(d=>d.name)).not.toContain('星澜智造_智能演示大纲.pptx');});
 it('indexes the exact shipped documents with verifiable fingerprints',()=>{for(const doc of evidence){expect(createHash('sha256').update(readFileSync(`public${doc.url}`)).digest('hex')).toBe(doc.sha256);expect(doc.chunks.length).toBeGreaterThan(0);}});
 it('refuses inaccessible workspace actors',()=>{const ref=bind();useStudio.setState({workspaceActors:{...useStudio.getState().workspaceActors,xintai:'not-member'}});expect(presentationKnowledgeDocuments(useStudio.getState(),work(),ref)).toEqual([]);expect(answerDemoKnowledge(useStudio.getState(),work(),ref,'能耗')).toBeUndefined();});
 it('validates question length and does not mutate work or binding',()=>{const ref=bind(),w=work(),before=JSON.stringify(w);expect(()=>answerDemoKnowledge(useStudio.getState(),w,ref,'x'.repeat(2001))).toThrow();answerDemoKnowledge(useStudio.getState(),w,ref,'三项核心能力');expect(JSON.stringify(w)).toBe(before);});
});
