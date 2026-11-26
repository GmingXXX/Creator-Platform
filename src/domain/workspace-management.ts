import {canonicalMemberAccount,platformAccountEnabled} from './admin-management';
import {isWorkspace,workspaces,type Workspace} from './workspaces';
import {normalizeWorkspaceKnowledge,type ACPKnowledgeBinding} from './workspace-knowledge';

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';
export interface WorkspaceMember {id:string;name:string;account:string;role:WorkspaceRole;status:'member'|'invited'}
export interface WorkspaceData {
 workspaceSchemaVersion:number;
 workspaces:Workspace[];
 workspaceMembers:Record<string,WorkspaceMember[]>;
 workspaceActors:Record<string,string>;
 workspaceKnowledge:Record<string,ACPKnowledgeBinding>;
}
export const workspaceRoleLabels:Record<WorkspaceRole,string>={owner:'负责人',editor:'编辑者',viewer:'查看者'};
const owner=():WorkspaceMember=>({id:'self',name:'纪鸣',account:'jiming',role:'owner',status:'member'});
const safeId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

export function validateWorkspaceDetails(input:{name:string;description?:string}):{name:string;description:string} {
 const name=typeof input?.name==='string'?input.name.trim():'';
 const description=typeof input?.description==='string'?input.description.trim():'';
 if(!name||name.length>40)throw new Error('请填写 1–40 个字的空间名称');
 if(description.length>200)throw new Error('空间说明不能超过 200 个字');
 return {name,description};
}
export function normalizeMemberAccount(value:unknown):string {
 const account=typeof value==='string'?value.trim().toLocaleLowerCase():'';
 if(!account||account.length>100||!(account.includes('@')?/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(account):/^[\p{L}\p{N}_.-]{1,40}$/u.test(account)))throw new Error('请输入有效账号或邮箱，账号不含空格');
 return account;
}
export function matchingMemberships(members:WorkspaceMember[],handle:string){
 const key=canonicalMemberAccount(handle);
 return members.filter(member=>canonicalMemberAccount(member.account)===key);
}

export function primaryMembership(matches:WorkspaceMember[]):WorkspaceMember|undefined{
 // An owner record always wins. An accepted membership takes precedence over a pending invitation.
 const active=matches.filter(member=>member.status==='member');
 const pool=active.length?active:matches;
 return pool.find(member=>member.role==='owner')||pool.find(member=>member.role==='editor')||pool[0];
}

export function replaceMemberships(members:WorkspaceMember[],matches:WorkspaceMember[],next?:WorkspaceMember){
 const ids=new Set(matches.map(member=>member.id));
 if(!matches.length)return next?[...members,next]:members;
 return members.flatMap(member=>member.id===next?.id?[next]:ids.has(member.id)?[]:[member]);
}
export function validateMemberRole(role:unknown):asserts role is 'editor'|'viewer' {
 if(role!=='editor'&&role!=='viewer')throw new Error('请选择编辑者或查看者');
}
export function activeWorkspaceMember(state:Pick<WorkspaceData,'workspaceMembers'|'workspaceActors'>,workspaceId:string){
 const actor=state.workspaceActors[workspaceId]||'self';
 const member=state.workspaceMembers[workspaceId]?.find(item=>item.id===actor&&item.status==='member');
 return member&&platformAccountEnabled(member.account)?member:undefined;
}
export function workspaceRole(state:Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'>,workspaceId:string):WorkspaceRole|undefined {
 if(!isWorkspace(workspaceId,state.workspaces))return;
 if(workspaceId==='personal')return 'owner';
 return activeWorkspaceMember(state,workspaceId)?.role;
}
export const workspaceCanEdit=(state:Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'>,id:string):boolean=>!state.workspaces.find(space=>space.id===id)?.archivedAt&&['owner','editor'].includes(workspaceRole(state,id)||'');
export const workspaceCanManage=(state:Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'>,id:string):boolean=>id!=='personal'&&workspaceCanEdit(state,id)&&workspaceRole(state,id)==='owner';

/** Legacy invitations stored display names, not login identities. Keep them as local demo accounts. */
function legacyMemberAccount(id:string):string {
 let fingerprint=2166136261;
 for(const character of id)fingerprint=Math.imul(fingerprint^character.charCodeAt(0),16777619);
 return `legacy-${id.slice(0,16).toLowerCase()}-${(fingerprint>>>0).toString(36)}`;
}
function normalizeTransferredMembers(raw:unknown):WorkspaceMember[]|undefined {
 if(!Array.isArray(raw))return;
 const members:WorkspaceMember[]=[];
 for(const item of raw){
  const row=record(item);
  if(!safeId(row.id)||(row.status!=='invited'&&row.status!=='member'))continue;
  if(!['owner','editor','viewer'].includes(row.role as string)||(row.role==='owner'&&row.status!=='member'))continue;
  try{
   const account=normalizeMemberAccount(row.account);
   if(members.some(member=>member.id===row.id||member.account===account))continue;
   const name=typeof row.name==='string'&&row.name.trim()?row.name.trim().slice(0,100):account;
   members.push({id:row.id,name,account,role:row.role as WorkspaceRole,status:row.status});
  }catch{/* Invalid saved members cannot grant a role. */}
 }
 return members.filter(member=>member.role==='owner').length===1?members:undefined;
}
function normalizeMembers(raw:unknown,allowTransferredOwner=false):WorkspaceMember[] {
 if(allowTransferredOwner){const transferred=normalizeTransferredMembers(raw);if(transferred)return transferred;}
 const members=[owner()];
 if(!Array.isArray(raw))return members;
 for(const item of raw){
  const row=record(item);
  if(!safeId(row.id)||row.id==='self'||(row.status!=='invited'&&row.status!=='member'))continue;
  try{
   validateMemberRole(row.role);
   const account=row.account===undefined?legacyMemberAccount(row.id):normalizeMemberAccount(row.account);
   if(members.some(member=>member.id===row.id||member.account===account))continue;
   const name=typeof row.name==='string'&&row.name.trim()?row.name.trim().slice(0,100):account;
   members.push({id:row.id,name,account,role:row.role,status:row.status});
  }catch{/* Invalid legacy entries cannot grant a role. */}
 }
 return members;
}
function parseLegacy(raw:string|null):unknown {
 try{return raw?JSON.parse(raw):undefined;}catch{return undefined;}
}
/** Rebuilds immutable state while retaining legacy preset invitations; no global registry. */
export function normalizeWorkspaceState(input:unknown,readLegacy?:(id:string)=>string|null):WorkspaceData {
 const data=record(input);let spaces:Workspace[]=workspaces.map(space=>({...space})),seen:string[]=[];
 if(Array.isArray(data.workspaces))for(const item of data.workspaces){
  const row=record(item);if(!safeId(row.id)||row.id==='personal'||seen.includes(row.id))continue;
  try{
   const details=validateWorkspaceDetails({name:row.name as string,description:row.description as string});
   const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:undefined;
   const purgedAt=timestamp(row.purgedAt),deletedAt=timestamp(row.deletedAt)||purgedAt;
   const space:Workspace={id:row.id,...details,color:typeof row.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(row.color)?row.color:'#527786',...(timestamp(row.archivedAt)?{archivedAt:timestamp(row.archivedAt)}:{}),...(deletedAt?{deletedAt}:{}),...(purgedAt?{purgedAt}:{})};
   spaces=spaces.some(item=>item.id===row.id)?spaces.map(item=>item.id===row.id?space:item):[...spaces,space];seen=[...seen,row.id];
  }catch{/* A malformed saved entry is not an accessible workspace. */}
 }
 const rawMembers=record(data.workspaceMembers),rawActors=record(data.workspaceActors);
 const memberPairs=spaces.filter(space=>space.id!=='personal'&&!space.purgedAt).map(space=>{
  let legacy:unknown;
  if(!Object.hasOwn(rawMembers,space.id)&&readLegacy){try{legacy=parseLegacy(readLegacy(space.id));}catch{/* Unavailable browser storage leaves the owner intact. */}}
  return [space.id,normalizeMembers(rawMembers[space.id]??legacy,data.workspaceSchemaVersion===2&&Object.hasOwn(rawMembers,space.id))] as const;
 });
 const workspaceMembers=Object.fromEntries(memberPairs);
 const workspaceActors=Object.fromEntries(memberPairs.map(([id,members])=>[id,members.some(member=>member.id===rawActors[id]&&member.status==='member')?rawActors[id] as string:'self']));
 return {workspaceSchemaVersion:2,workspaces:spaces,workspaceMembers,workspaceActors,workspaceKnowledge:normalizeWorkspaceKnowledge(data.workspaceKnowledge,spaces)};
}
