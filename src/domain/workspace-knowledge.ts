import {workspaceCanManage,type WorkspaceData} from './workspace-management';
import {isWorkspace,type Workspace} from './workspaces';

export const DEMO_KNOWLEDGE_CATALOG_ID='zhichuang-20261116' as const;
export interface KnowledgeFieldInput {fieldId:string;fieldName:string;demoCatalogId?:typeof DEMO_KNOWLEDGE_CATALOG_ID}
/** Explicit opt-in only: an arbitrary ACP id never enables bundled demonstration data. */
export function isDemoKnowledgeBinding(binding:Pick<KnowledgeFieldInput,'demoCatalogId'>|undefined):boolean {return binding?.demoCatalogId===DEMO_KNOWLEDGE_CATALOG_ID;}
export interface ACPKnowledgeBinding extends KnowledgeFieldInput {
 provider:'acp';
 revision:number;
 updatedAt:string;
 /** A saved local association, never an ACP connection or ingestion receipt. */
 status:'configured';
}
export type KnowledgeTarget = Readonly<{
 workspaceId:string;
 fieldId?:string;
 fieldName?:string;
 bindingRevision?:number;
 demoCatalogId?:typeof DEMO_KNOWLEDGE_CATALOG_ID;
 state:'not-connected'|'unbound'|'personal';
}>;
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const controls=/[\u0000-\u001f\u007f-\u009f]/;

/** Personal knowledge is editable without enabling collaboration or lifecycle controls. */
export function canManageKnowledgeBinding(state:WorkspaceData,workspaceId:string):boolean {
 return workspaceId==='personal'?isWorkspace(workspaceId,state.workspaces):workspaceCanManage(state,workspaceId);
}

export function validateKnowledgeField(input:KnowledgeFieldInput):KnowledgeFieldInput {
 const fieldId=typeof input?.fieldId==='string'?input.fieldId.trim():'';
 const fieldName=typeof input?.fieldName==='string'?input.fieldName.trim():'';
 if(!fieldName||fieldName.length>80||controls.test(fieldName))throw new Error('请填写 1–80 个字的知识本地场名称');
 if(!fieldId||fieldId.length>200||/\s/.test(fieldId)||controls.test(fieldId))throw new Error('请填写有效的知识本地场id，不含空格或控制字符，最多 200 个字符');
 if(input.demoCatalogId!==undefined&&input.demoCatalogId!==DEMO_KNOWLEDGE_CATALOG_ID)throw new Error('演示知识本地场不存在，请重新选择');
 return {fieldId,fieldName,...(input.demoCatalogId?{demoCatalogId:input.demoCatalogId}:{})};
}
export function assertKnowledgeFieldAvailable(bindings:Record<string,ACPKnowledgeBinding>,workspaceId:string,fieldId:string):void {
 if(Object.entries(bindings).some(([id,binding])=>id!==workspaceId&&binding.fieldId===fieldId))throw new Error('该知识本地场已绑定其他项目空间，请核对归属');
}
export function createKnowledgeBinding(input:KnowledgeFieldInput,previous?:ACPKnowledgeBinding):ACPKnowledgeBinding {
 return {...validateKnowledgeField(input),provider:'acp',revision:(previous?.revision||0)+1,updatedAt:new Date().toISOString(),status:'configured'};
}
export function normalizeWorkspaceKnowledge(raw:unknown,spaces:readonly Workspace[]):Record<string,ACPKnowledgeBinding> {
 const candidates=object(raw);
 return spaces.reduce<Record<string,ACPKnowledgeBinding>>((bindings,space)=>{
  if(space.purgedAt||!Object.hasOwn(candidates,space.id))return bindings;
  const candidate=object(candidates[space.id]);if(candidate.provider!=='acp')return bindings;
  try{
   const input=validateKnowledgeField(candidate as unknown as KnowledgeFieldInput);
   assertKnowledgeFieldAvailable(bindings,space.id,input.fieldId);
   const revision=Number.isSafeInteger(candidate.revision)&&Number(candidate.revision)>0?Number(candidate.revision):1;
   const updatedAt=typeof candidate.updatedAt==='string'&&Number.isFinite(Date.parse(candidate.updatedAt))?candidate.updatedAt:'1970-01-01T00:00:00.000Z';
   return {...bindings,[space.id]:{...input,provider:'acp',revision,updatedAt,status:'configured'}};
  }catch{return bindings;}
 },{});
}
/** Freeze routing at the start of an upload; a later workspace/binding change cannot retarget it. */
export function captureKnowledgeTarget(state:Pick<WorkspaceData,'workspaces'|'workspaceKnowledge'>,workspaceId:string):KnowledgeTarget {
 if(!isWorkspace(workspaceId,state.workspaces))throw new Error('项目空间已不存在，无法确认资料归属');
 const binding=state.workspaceKnowledge[workspaceId];
 return Object.freeze(binding?{workspaceId,fieldId:binding.fieldId,fieldName:binding.fieldName,bindingRevision:binding.revision,...(binding.demoCatalogId?{demoCatalogId:binding.demoCatalogId}:{}),state:'not-connected'}:{workspaceId,state:workspaceId==='personal'?'personal':'unbound'});
}
