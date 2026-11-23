import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useAdminManagement,initialAdminData,canAdmin,inviteAdminAccount,updateAdminAccount,setAdminPermission,moderateCatalog,catalogIsHidden,selectDemoAdministrator} from '../src/domain/admin-management';

beforeEach(()=>useAdminManagement.setState(initialAdminData()));
describe('local administrator management',()=>{
 it('denies creator mutations and preserves state',()=>{
  expect(canAdmin('creator','accounts')).toBe(false);
  expect(()=>inviteAdminAccount('creator',{name:'测试',email:'test@example.com',role:'creator'})).toThrow('权限');
  expect(useAdminManagement.getState().accounts).toHaveLength(3);
 });
 it('validates invites and stores local pending invitations with audit',()=>{
  expect(()=>inviteAdminAccount('reviewer',{name:'测试',email:'bad',role:'creator'})).toThrow('邮箱');
  const added=inviteAdminAccount('reviewer',{name:'  测试  ',email:'TEST@example.com',role:'creator'});
  expect(added).toMatchObject({name:'测试',email:'test@example.com',status:'invited'});
  expect(()=>inviteAdminAccount('reviewer',{name:'重复',email:'test@example.com',role:'creator'})).toThrow('已有');
  expect(useAdminManagement.getState().audit[0].action).toBe('创建模拟邀请');
 });
 it('cannot disable or demote the protected owner',()=>{
  expect(()=>updateAdminAccount('reviewer','jiming',{status:'disabled'})).toThrow('主管理员');
  expect(()=>updateAdminAccount('reviewer','jiming',{role:'creator'})).toThrow('主管理员');
  expect(()=>setAdminPermission('reviewer','jiming','permissions',false)).toThrow('主管理员');
 });
 it('can manage account role, status and effective delegated permissions',()=>{
  updateAdminAccount('reviewer','linan',{role:'admin'});
  setAdminPermission('reviewer','linan','review',true);
  selectDemoAdministrator('reviewer','linan');
  expect(canAdmin('reviewer','review')).toBe(true);
  expect(canAdmin('reviewer','resources')).toBe(false);
  expect(()=>inviteAdminAccount('reviewer',{name:'测试',email:'test@example.com',role:'creator'})).toThrow('权限');
  selectDemoAdministrator('reviewer','jiming');updateAdminAccount('reviewer','linan',{status:'disabled'});
  expect(()=>selectDemoAdministrator('reviewer','linan')).toThrow('启用');
 });
 it('moderates public catalog entries while preserving all private and in-use content',()=>{
  const state=createInitialData(),before=structuredClone(state),publicAsset=state.assets.find(a=>a.public)!;
  expect(()=>moderateCatalog('reviewer',state,'asset',state.assets.find(a=>!a.public)!.id,true,'错误')).toThrow('公开');
  expect(()=>moderateCatalog('reviewer',state,'asset',publicAsset.id,true,'')).toThrow('原因');
  moderateCatalog('reviewer',state,'asset',publicAsset.id,true,'待核对版权');
  expect(catalogIsHidden('asset',publicAsset.id)).toBe(true);expect(state).toEqual(before);
  moderateCatalog('reviewer',state,'asset',publicAsset.id,false,'');
  expect(catalogIsHidden('asset',publicAsset.id)).toBe(false);
  for(const [kind,id] of [['template',state.templates[0].id],['skill',state.skills.find(s=>s.public)!.id],['style',state.systems[0].id]] as const){moderateCatalog('reviewer',state,kind,id,true,'待整理');expect(catalogIsHidden(kind,id)).toBe(true);}
 });
});

import {prepareAssetAdoption} from '../src/domain/asset-adoption-context';
import {prepareSkillAdoption} from '../src/domain/skill-store';
import {sharedCatalog,recordAdminAudit} from '../src/domain/admin-management';
describe('shared catalog enforcement',()=>{
 it('blocks newly adopting a hidden asset and skill without modifying source state',()=>{
  const state=createInitialData(),asset=state.assets.find(a=>a.public)!,skill=state.skills.find(s=>s.public&&!s.personal)!;
  moderateCatalog('reviewer',state,'asset',asset.id,true,'待核对');moderateCatalog('reviewer',state,'skill',skill.id,true,'待核对');
  expect(()=>prepareAssetAdoption(state,asset,'personal')).toThrow('下架');expect(prepareSkillAdoption(state,skill.id)).toBeUndefined();
  expect(sharedCatalog(state).some(item=>item.kind==='asset'&&item.id===asset.id)).toBe(true);
 });
 it('validates account changes and denies unauthorized permission assignment',()=>{
  expect(()=>inviteAdminAccount('reviewer',{name:' ',email:'a@example.com',role:'creator'})).toThrow('姓名');
  expect(()=>inviteAdminAccount('reviewer',{name:'有效',email:'a@example.com',role:'invalid' as never})).toThrow('角色');
  expect(()=>updateAdminAccount('reviewer','missing',{status:'active'})).toThrow('不存在');
  expect(()=>updateAdminAccount('reviewer','linan',{status:'invalid' as never})).toThrow('无效');
  expect(()=>setAdminPermission('reviewer','linan','review',true)).toThrow('仅管理员');
  expect(()=>selectDemoAdministrator('creator','jiming')).toThrow('权限');
  updateAdminAccount('reviewer','linan',{role:'admin'});
  expect(()=>setAdminPermission('reviewer','linan','invalid' as never,true)).toThrow('无效');
  setAdminPermission('reviewer','linan','accounts',true);selectDemoAdministrator('reviewer','linan');
  expect(()=>updateAdminAccount('reviewer','linan',{status:'disabled'})).toThrow('当前管理员');
  expect(()=>setAdminPermission('reviewer','linan','review',true)).toThrow('权限');
  selectDemoAdministrator('reviewer','jiming');setAdminPermission('reviewer','linan','accounts',false);
  updateAdminAccount('reviewer','linan',{role:'creator'});expect(useAdminManagement.getState().accounts.find(a=>a.id==='linan')?.permissions).toEqual([]);
 });
 it('records review audit only for authorized roles and preserves public catalog metadata',()=>{
  expect(()=>recordAdminAudit('creator','通过投稿','模板')).toThrow('权限');recordAdminAudit('reviewer','通过投稿','模板','检查通过');
  expect(useAdminManagement.getState().audit[0]).toMatchObject({actor:'纪鸣',action:'通过投稿',target:'模板'});
  const state=createInitialData();expect(sharedCatalog(state).filter(i=>i.kind==='asset')).toHaveLength(state.assets.filter(a=>a.public&&!a.deletedAt&&!a.archived).length);
 });
});

import {useStudio} from '../src/domain/store';
it('enforces review and template moderation at store mutation boundaries',()=>{
 const state=createInitialData();useStudio.setState({...state,role:'reviewer'});
 const pending=state.submissions.find(s=>s.status==='pending')!;
 updateAdminAccount('reviewer','linan',{role:'admin'});selectDemoAdministrator('reviewer','linan');
 expect(useStudio.getState().reviewSubmission(pending.id,'approved','')).toBe(false);
 selectDemoAdministrator('reviewer','jiming');const template=state.templates[0];moderateCatalog('reviewer',state,'template',template.id,true,'待审核');
 expect(useStudio.getState().cloneTemplate(template.id)).toBeUndefined();expect(useStudio.getState().works).toEqual(state.works);
});
