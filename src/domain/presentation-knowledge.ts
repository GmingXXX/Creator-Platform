import type {Work} from './types';
import {workspaceRole,type WorkspaceData} from './workspace-management';
import {isDemoKnowledgeBinding,validateKnowledgeField} from './workspace-knowledge';
export interface PresentationKnowledgeReference {workspaceId:string;fieldId:string;fieldName:string;bindingRevision:number}
type KnowledgeState=Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'|'workspaceKnowledge'>;
export function normalizePresentationKnowledge(value:unknown):PresentationKnowledgeReference|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const raw=value as Record<string,unknown>;
 if(typeof raw.workspaceId!=='string'||!raw.workspaceId.trim()||raw.workspaceId.length>200||!Number.isSafeInteger(raw.bindingRevision)||Number(raw.bindingRevision)<1)return undefined;
 try {const field=validateKnowledgeField({fieldId:raw.fieldId as string,fieldName:raw.fieldName as string});return {...field,workspaceId:raw.workspaceId,bindingRevision:Number(raw.bindingRevision)};}catch{return undefined;}
}
export function selectPresentationKnowledge(state:KnowledgeState,work:Work):PresentationKnowledgeReference {
 const workspaceId=work.workspaceId||'personal';
 if(!workspaceRole(state,workspaceId))throw new Error('当前项目空间不可访问');
 const binding=state.workspaceKnowledge[workspaceId];if(!binding)throw new Error('当前空间尚未绑定知识本地场');
 return {workspaceId,fieldId:binding.fieldId,fieldName:binding.fieldName,bindingRevision:binding.revision};
}
export function presentationKnowledgeStatus(state:KnowledgeState,work:Work,reference?:PresentationKnowledgeReference) {
 const workspaceId=work.workspaceId||'personal',binding=state.workspaceKnowledge[workspaceId];
 const fallback='本次仅依据演示内容与明确加入的资料回答，未检索 ACP。';
 if(!workspaceRole(state,workspaceId))return {state:'unavailable' as const,canSelect:false,notice:`项目空间不可访问。${fallback}`};
 if(workspaceId==='personal'&&!binding)return {state:'personal' as const,canSelect:false,notice:`个人空间未绑定知识本地场。${fallback}`};
 if(!binding)return {state:'unbound' as const,canSelect:false,notice:`项目空间尚未绑定知识本地场。${fallback}`};
 if(reference&&(reference.workspaceId!==workspaceId||reference.fieldId!==binding.fieldId||reference.bindingRevision!==binding.revision))return {state:'changed' as const,canSelect:true,fieldId:binding.fieldId,fieldName:binding.fieldName,notice:`项目绑定已变化，请重新确认引用。${fallback}`};
 if(isDemoKnowledgeBinding(binding))return {state:reference?'demo-ready' as const:'demo-available' as const,canSelect:true,fieldName:binding.fieldName,fieldId:binding.fieldId,notice:reference?'已启用模拟知识检索，依据预置演示资料回答并显示出处；未连接真实 ACP。':'此空间已模拟绑定。启用后，可直接引用预置演示资料进行问答。'};
 return {state:'not-connected' as const,canSelect:true,fieldId:binding.fieldId,fieldName:binding.fieldName,notice:reference?`已保存引用设置，ACP 未连接。${fallback}`:'ACP 未连接，当前仅支持保存引用设置。'};
}
