import type {StudioStore} from './types';
import {createDraft} from './fixtures';
import {uid} from './scenes';
import {isWorkspace} from './workspaces';
import {assertKnowledgeFieldAvailable,canManageKnowledgeBinding,createKnowledgeBinding} from './workspace-knowledge';
import {canonicalMemberAccount} from './admin-management';
import {matchingMemberships,primaryMembership,replaceMemberships,normalizeMemberAccount,validateMemberRole,validateWorkspaceDetails,workspaceCanManage,type WorkspaceMember} from './workspace-management';

type Setter=(update:Partial<StudioStore>)=>void;
export function createWorkspaceActions(set:Setter,get:()=>StudioStore):Pick<StudioStore,'createWorkspace'|'updateWorkspaceDetails'|'transferWorkspaceOwnership'|'inviteWorkspaceMember'|'changeWorkspaceMemberRole'|'removeWorkspaceMember'|'acceptWorkspaceInvitation'|'setWorkspaceActor'|'bindWorkspaceKnowledge'|'unbindWorkspaceKnowledge'> {
 const requireOwner=(id:string)=>{
  const state=get();if(!workspaceCanManage(state,id))throw new Error('仅使用中空间的负责人可以修改空间设置、成员与权限');return state;
 };
 const requireKnowledgeOwner=(id:string)=>{
  const state=get();if(!canManageKnowledgeBinding(state,id))throw new Error('仅使用中空间的负责人可以修改知识本地场绑定');return state;
 };
 const findMember=(id:string,memberId:string)=>{
  const state=requireOwner(id),member=state.workspaceMembers[id]?.find(item=>item.id===memberId);
  if(!member)throw new Error('成员或邀请已不存在');
  const matches=matchingMemberships(state.workspaceMembers[id],member.account),primary=primaryMembership(matches)||member;
  if(primary.role==='owner')throw new Error('不能更改或移除空间负责人');
  return {state,member:primary,matches};
 };
 const saveMembers=(id:string,members:WorkspaceMember[])=>set({workspaceMembers:{...get().workspaceMembers,[id]:members}});
 return {
  updateWorkspaceDetails:(id,input)=>{
   const state=requireOwner(id),details=validateWorkspaceDetails(input);
   if(state.workspaces.some(space=>space.id!==id&&!space.purgedAt&&space.name.toLocaleLowerCase()===details.name.toLocaleLowerCase()))throw new Error('已有同名空间，请换一个名称');
   set({workspaces:state.workspaces.map(space=>space.id===id?{...space,...details}:space)});
  },
  transferWorkspaceOwnership:(id,memberId)=>{
   const state=requireOwner(id),members=state.workspaceMembers[id],selected=members.find(item=>item.id===memberId);
   const matches=selected?matchingMemberships(members,selected.account):[],target=primaryMembership(matches);
   if(!target||target.status!=='member'||target.role==='owner')throw new Error('请选择已加入空间的其他成员');
   const previous=members.find(member=>member.role==='owner')!;
   const demoted=replaceMemberships(members,matchingMemberships(members,previous.account),{...previous,role:'editor'});
   const transferred=replaceMemberships(demoted,matches,{...target,account:canonicalMemberAccount(target.account),role:'owner'});
   set({workspaceSchemaVersion:2,workspaceMembers:{...state.workspaceMembers,[id]:transferred}});
  },
  createWorkspace:input=>{
   const details=validateWorkspaceDetails(input),state=get();
   if(state.workspaces.some(space=>!space.purgedAt&&space.name.toLocaleLowerCase()===details.name.toLocaleLowerCase()))throw new Error('已有同名空间，请换一个名称');
   const space={id:uid('space'),...details,color:'#527786'},draft=createDraft({workspaceId:space.id});
   const binding=input.knowledgeField?createKnowledgeBinding(input.knowledgeField):undefined;
   if(binding)assertKnowledgeFieldAvailable(state.workspaceKnowledge,space.id,binding.fieldId);
   const self:WorkspaceMember={id:'self',name:'纪鸣',account:'jiming',role:'owner',status:'member'};
   set({workspaces:[...state.workspaces,space],workspaceKnowledge:binding?{...state.workspaceKnowledge,[space.id]:binding}:state.workspaceKnowledge,workspaceMembers:{...state.workspaceMembers,[space.id]:[self]},workspaceActors:{...state.workspaceActors,[space.id]:'self'},activeWorkspaceId:space.id,drafts:[draft,...state.drafts],activeDraftId:draft.id});
   return space;
  },
  bindWorkspaceKnowledge:(id,input)=>{
   const state=requireKnowledgeOwner(id),binding=createKnowledgeBinding(input,state.workspaceKnowledge[id]);
   assertKnowledgeFieldAvailable(state.workspaceKnowledge,id,binding.fieldId);
   set({workspaceKnowledge:{...state.workspaceKnowledge,[id]:binding}});return binding;
  },
  unbindWorkspaceKnowledge:id=>{
   const state=requireKnowledgeOwner(id);
   set({workspaceKnowledge:Object.fromEntries(Object.entries(state.workspaceKnowledge).filter(([spaceId])=>spaceId!==id))});
  },
  inviteWorkspaceMember:(id,input,role)=>{
   const state=requireOwner(id);validateMemberRole(role);const account=canonicalMemberAccount(normalizeMemberAccount(input)),members=state.workspaceMembers[id];
   if(matchingMemberships(members,account).length)throw new Error('该账号已在成员或邀请列表中');
   const member:WorkspaceMember={id:uid('member'),name:input.trim(),account,role,status:'invited'};
   saveMembers(id,[...members,member]);return member;
  },
  changeWorkspaceMemberRole:(id,memberId,role)=>{
   const {state,member,matches}=findMember(id,memberId);validateMemberRole(role);
   saveMembers(id,replaceMemberships(state.workspaceMembers[id],matches,{...member,account:canonicalMemberAccount(member.account),role}));
  },
  removeWorkspaceMember:(id,memberId)=>{
   const {state,matches}=findMember(id,memberId);saveMembers(id,replaceMemberships(state.workspaceMembers[id],matches));
  },
  acceptWorkspaceInvitation:(id,memberId)=>{
   const {state,member,matches}=findMember(id,memberId);
   if(member.status!=='invited')throw new Error('该成员已经加入空间');
   saveMembers(id,replaceMemberships(state.workspaceMembers[id],matches,{...member,account:canonicalMemberAccount(member.account),status:'member'}));
  },
  // Explicit local demonstration control, not an authentication or access-granting endpoint.
  setWorkspaceActor:(id,memberId)=>{
   const state=get();if(id==='personal'||!isWorkspace(id,state.workspaces))throw new Error('请选择项目空间');
   if(!state.workspaceMembers[id]?.some(member=>member.id===memberId&&member.status==='member'))throw new Error('只能体验已加入成员的权限');
   set({workspaceActors:{...state.workspaceActors,[id]:memberId}});
  },
 };
}
