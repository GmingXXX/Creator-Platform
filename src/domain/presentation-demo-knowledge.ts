import type {Asset,Work} from './types';
import type {WorkspaceData} from './workspace-management';
import {assetAvailableForAI} from './asset-access';
import {presentationKnowledgeStatus,type PresentationKnowledgeReference} from './presentation-knowledge';
import evidence from './demo-knowledge-evidence.json';
type State=Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'|'workspaceKnowledge'>&{assets?:Asset[]};
export interface KnowledgeAnswerSource {name:string;location:string;url:string}
export interface DemoKnowledgeAnswer {answer:string;sources:KnowledgeAnswerSource[]}
/** The index is extracted from bundled documents, never from invented remote ACP results. */
export function presentationKnowledgeDocuments(state:State,work:Work,reference?:PresentationKnowledgeReference){
 if(work.deletedAt||presentationKnowledgeStatus(state,work,reference).state!=='demo-ready')return [];
 return evidence.filter(doc=>{
  const copies=(state.assets||[]).filter(asset=>asset.workspaceId===work.workspaceId&&asset.package?.params.knowledgeCatalogId==='zhichuang-20261116'&&asset.package.params.knowledgeFieldId===reference!.fieldId&&asset.package.params.knowledgeRevision===String(reference!.bindingRevision)&&asset.package.params.knowledgeCase===doc.caseId&&asset.package.params.knowledgePath===doc.path);
  return copies.every(asset=>assetAvailableForAI(asset,work.workspaceId));
 });
}
function terms(question:string){
 const value=question.toLowerCase().replace(/星澜智造|请问|介绍一下|是什么|有哪些|怎么样|多少|什么|是否|可以|能不能|公司|企业|资料|请|的|了|吗|呢|？|\?/g,' ').replace(/[^\p{L}\p{N}%.-]+/gu,' ');
 return [...new Set(value.split(/\s+/).flatMap(part=>/^[a-z0-9%.-]+$/.test(part)?[part]:Array.from({length:Math.max(0,part.length-1)},(_,i)=>part.slice(i,i+2))).filter(Boolean))];
}
export function answerDemoKnowledge(state:State,work:Work,reference:PresentationKnowledgeReference|undefined,question:string):DemoKnowledgeAnswer|undefined {
 if(!question.trim()||question.length>2000)throw new Error('请输入 1–2000 字的问题');
 if(!reference||presentationKnowledgeStatus(state,work,reference).state!=='demo-ready'||work.deletedAt)return;
 const keys=terms(question),documents=presentationKnowledgeDocuments(state,work,reference);
 const ranked=documents.flatMap(doc=>doc.chunks.map(chunk=>({doc,chunk,score:keys.reduce((score,key)=>score+(chunk.text.toLowerCase().includes(key)?key.length:0),0)}))).filter(item=>item.score>=2).sort((a,b)=>b.score-a.score);
 const chosen=ranked.slice(0,2);
 if(!chosen.length)return {answer:'当前模拟资料未提供可确认的相关信息。可以询问企业核心能力、绿色运营指标或储能监测案例。',sources:[]};
 return {answer:`模拟资料摘录（企业数据与故事均为虚构演示）：\n${chosen.map(item=>item.chunk.text).join('\n')}`,sources:chosen.map(({doc,chunk})=>({name:doc.name,location:chunk.location,url:doc.url}))};
}
