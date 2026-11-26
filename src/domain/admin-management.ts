import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {StudioData} from './types';

export type AdminPermission='accounts'|'permissions'|'review'|'resources'|'plugins'|'models';
export type CatalogKind='template'|'asset'|'skill'|'style';
type PlatformRole=StudioData['role'];
export interface AdminAccount {id:string;name:string;email:string;role:'creator'|'admin';status:'active'|'invited'|'disabled';permissions:AdminPermission[]}
interface AuditEntry {id:string;at:string;actor:string;action:string;target:string;reason?:string}
interface AdminData {accounts:AdminAccount[];activeAdminId:string;hidden:Record<string,{reason:string;at:string}>;audit:AuditEntry[]}
export const adminPermissionLabels:Record<AdminPermission,string>={accounts:'账号管理',permissions:'权限配置',review:'社区审核',resources:'共享资源管理',plugins:'插件管理',models:'模型管理'};
export const catalogKindLabels:Record<CatalogKind,string>={template:'作品模板',asset:'素材',skill:'Skill',style:'设计风格'};
export function initialAdminData():AdminData{return {activeAdminId:'jiming',hidden:{},audit:[],accounts:[
 {id:'jiming',name:'纪鸣',email:'jiming@demo.local',role:'admin',status:'active',permissions:['accounts','permissions','review','resources','plugins','models']},
 {id:'linan',name:'林安',email:'linan@demo.local',role:'creator',status:'active',permissions:[]},
 {id:'sunxiao',name:'孙晓',email:'sunxiao@demo.local',role:'creator',status:'invited',permissions:[]}
]};}
export const useAdminManagement=create<AdminData>()(persist(()=>initialAdminData(),{name:'zhichuang-admin-v1'}));
export function canAdmin(role:PlatformRole,permission:AdminPermission){const state=useAdminManagement.getState(),account=state.accounts.find(a=>a.id===state.activeAdminId);return role==='reviewer'&&account?.role==='admin'&&account.status==='active'&&(account.id==='jiming'||account.permissions.includes(permission))||false;}
// Workspace-only invitations can exist before an account is registered in this local prototype.
function findPlatformAccount(handle:string){
 const normalized=handle.trim().toLowerCase();
 return useAdminManagement.getState().accounts.find(a=>a.email===normalized||a.id===normalized);
}
export function canonicalMemberAccount(handle:string){
 return findPlatformAccount(handle)?.email||handle.trim().toLowerCase();
}
export function platformAccountEnabled(handle:string){
 const account=findPlatformAccount(handle);
 return !account||account.status==='active';
}
function requirePermission(role:PlatformRole,permission:AdminPermission){if(!canAdmin(role,permission))throw new Error('当前管理员没有此操作权限。');}
function audit(state:AdminData,action:string,target:string,reason?:string){return [{id:crypto.randomUUID(),at:new Date().toISOString(),actor:state.accounts.find(a=>a.id===state.activeAdminId)?.name||'管理员',action,target,reason},...state.audit].slice(0,200);}
export function recordAdminAudit(role:PlatformRole,action:string,target:string,reason?:string){requirePermission(role,'review');useAdminManagement.setState(state=>({audit:audit(state,action,target,reason)}));}
export function inviteAdminAccount(role:PlatformRole,input:{name:string;email:string;role:AdminAccount['role']}){
 requirePermission(role,'accounts');const name=input.name.trim(),email=input.email.trim().toLowerCase();
 if(!name||name.length>40)throw new Error('请输入 1 至 40 字的姓名。');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('请输入有效邮箱。');
 if(!['creator','admin'].includes(input.role))throw new Error('请选择有效角色。');
 const state=useAdminManagement.getState();if(state.accounts.some(a=>a.email===email))throw new Error('该邮箱已有账号或邀请。');
 const account:AdminAccount={id:crypto.randomUUID(),name,email,role:input.role,status:'invited',permissions:[]};
 useAdminManagement.setState({accounts:[...state.accounts,account],audit:audit(state,'创建模拟邀请',name)});return account;
}
export function updateAdminAccount(role:PlatformRole,id:string,patch:Partial<Pick<AdminAccount,'role'|'status'>>){
 requirePermission(role,'accounts');const state=useAdminManagement.getState(),account=state.accounts.find(a=>a.id===id);if(!account)throw new Error('账号不存在。');
 if(patch.role&&!['creator','admin'].includes(patch.role)||patch.status&&!['active','invited','disabled'].includes(patch.status))throw new Error('账号设置无效。');
 if(id==='jiming'&&(patch.role&&patch.role!=='admin'||patch.status&&patch.status!=='active'))throw new Error('不能停用或降级主管理员。');
 if(id===state.activeAdminId&&(patch.role==='creator'||patch.status==='disabled'))throw new Error('不能停用或降级当前管理员。');
 const updated={...account,...patch,permissions:patch.role==='creator'?[]:account.permissions};
 useAdminManagement.setState({accounts:state.accounts.map(a=>a.id===id?updated:a),audit:audit(state,'更新账号',account.name,patch.role?`角色：${patch.role==='admin'?'管理员':'创作者'}`:`状态：${patch.status}`)});
}
export function setAdminPermission(role:PlatformRole,id:string,permission:AdminPermission,enabled:boolean){
 requirePermission(role,'permissions');const state=useAdminManagement.getState(),account=state.accounts.find(a=>a.id===id);if(!account||account.role!=='admin')throw new Error('仅管理员可配置管理权限。');
 if(!Object.hasOwn(adminPermissionLabels,permission))throw new Error('权限无效。');if(id==='jiming'&&!enabled)throw new Error('主管理员权限不能移除。');
 if(id===state.activeAdminId&&id!=='jiming')throw new Error('不能更改自己的后台职责。');
 if(!canAdmin(role,permission))throw new Error('只能委派或收回自己持有的后台职责。');
 const permissions=enabled?Array.from(new Set([...account.permissions,permission])):account.permissions.filter(p=>p!==permission);
 useAdminManagement.setState({accounts:state.accounts.map(a=>a.id===id?{...a,permissions}:a),audit:audit(state,'调整管理权限',account.name,`${enabled?'授予':'移除'}${adminPermissionLabels[permission]}`)});
}
export function selectDemoAdministrator(role:PlatformRole,id:string){const state=useAdminManagement.getState();if(role!=='reviewer')throw new Error('当前身份没有管理员权限。');if(!state.accounts.some(a=>a.id===id&&a.role==='admin'&&a.status==='active'))throw new Error('请选择已启用的管理员。');useAdminManagement.setState({activeAdminId:id});}
export function catalogIsHidden(kind:CatalogKind,id:string){return Boolean(useAdminManagement.getState().hidden[`${kind}:${id}`]);}
export function sharedCatalog(state:StudioData){return [
 ...state.templates.map(t=>({kind:'template' as const,id:t.id,name:t.title,author:t.author})),
 ...state.assets.filter(a=>a.public&&!a.deletedAt&&!a.archived).map(a=>({kind:'asset' as const,id:a.id,name:a.name,author:a.author})),
 ...state.skills.filter(s=>s.public&&!s.personal).map(s=>({kind:'skill' as const,id:s.id,name:s.name,author:s.author||'团队'})),
 ...state.systems.map(s=>({kind:'style' as const,id:s.id,name:s.name,author:'团队'}))
];}
export function moderateCatalog(role:PlatformRole,studio:StudioData,kind:CatalogKind,id:string,hidden:boolean,reason:string){
 requirePermission(role,'resources');const item=sharedCatalog(studio).find(i=>i.kind===kind&&i.id===id);if(!item)throw new Error('只能管理共创社区的公开资源。');
 const clean=reason.trim();if(hidden&&(!clean||clean.length>300))throw new Error('请填写 1 至 300 字的下架原因。');
 const state=useAdminManagement.getState(),key=`${kind}:${id}`;
 const next=hidden?{...state.hidden,[key]:{reason:clean,at:new Date().toISOString()}}:Object.fromEntries(Object.entries(state.hidden).filter(([k])=>k!==key));
 useAdminManagement.setState({hidden:next,audit:audit(state,hidden?'下架共享资源':'恢复共享资源',item.name,clean)});
}

export function auditConfiguration(role:PlatformRole,permission:'plugins'|'models',action:string,target:string){requirePermission(role,permission);useAdminManagement.setState(state=>({audit:audit(state,action,target)}));}

export function recordMemberAccessAudit(role:PlatformRole,name:string,summary:string){requirePermission(role,'permissions');useAdminManagement.setState(state=>({audit:audit(state,'更新成员空间权限',name,summary)}));}
