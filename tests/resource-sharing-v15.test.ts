import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData,createDraft} from '../src/domain/fixtures';
import {assetAvailableInSpace} from '../src/domain/asset-access';
import {resourceInView,skillAvailableInSpace} from '../src/domain/resource-sharing';
import {migrateResourcesV15} from '../src/domain/seeds-v15';
import {workDependencyError} from '../src/domain/resource-permissions';
import {useStudio} from '../src/domain/store';

describe('personal resources and project snapshots',()=>{
 beforeEach(()=>useStudio.setState(createInitialData()));
 it('requires explicit personal adoption without leaking another project',()=>{
  const asset={...createInitialData().assets[0],public:false,source:'uploaded' as const,workspaceId:'personal'};
  expect(assetAvailableInSpace(asset,'xintai')).toBe(false);
  expect(assetAvailableInSpace({...asset,workspaceId:'dongguan'},'xintai')).toBe(false);
  expect(resourceInView(asset,'mine','xintai')).toBe(true);
  expect(resourceInView(asset,'shared','xintai')).toBe(false);
  expect(resourceInView({...asset,workspaceId:'xintai'},'shared','xintai')).toBe(true);
 });
 it('pins personal assets when saving a shared work',()=>{
  const asset={...createInitialData().assets[0],id:'my-image',public:false,source:'uploaded' as const,workspaceId:'personal',package:undefined};
  const state=useStudio.getState();state.addAsset(asset);
  const work=state.createWork({title:'共享工程',type:'卡片浏览型',width:1920,height:1080,workspaceId:'xintai'});
  const adopted=state.adoptAsset(asset.id,'xintai')!;
  state.saveWork({...work,pages:work.pages.map(p=>({...p,backgroundImage:adopted.src,backgroundAssetId:adopted.id}))});
  const saved=useStudio.getState().works.find(w=>w.id===work.id)!;
  const copy=useStudio.getState().assets.find(a=>a.id===saved.pages[0].backgroundAssetId)!;
  expect(copy.id).not.toBe(asset.id);expect(copy.workspaceId).toBe('xintai');
  expect(copy.origin?.assetId).toBe(asset.id);
  state.addAsset({...asset,name:'后来改名'});expect(copy.name).toBe(asset.name);
  state.saveWork(saved);expect(useStudio.getState().assets.filter(a=>a.origin?.assetId===asset.id)).toHaveLength(1);
 });
 it('deleting a personal original keeps the project copy usable',()=>{
  const state=useStudio.getState();
  const asset={...state.assets[0],id:'private-original',src:'idb:independent-photo',public:false,source:'uploaded' as const,workspaceId:'personal',package:{...state.assets[0].package!,sourceId:undefined,files:[{name:'原图.png',type:'image' as const,src:'idb:independent-photo'}]}};
  state.addAsset(asset);
  const work=state.createWork({title:'固定副本',type:'卡片浏览型',width:1920,height:1080,workspaceId:'xintai'});
  const adopted=state.adoptAsset(asset.id,'xintai')!;
  state.saveWork({...work,creationPackage:{...adopted.package!,sourceId:adopted.id},pages:work.pages.map(p=>({...p,backgroundImage:adopted.src,backgroundAssetId:adopted.id}))});
  expect(state.removeAsset(asset.id)).toBe(true);
  const current=useStudio.getState(),saved=current.works.find(w=>w.id===work.id)!;
  expect(saved.pages[0].backgroundAssetId).not.toBe(asset.id);
  expect(workDependencyError(current.assets,saved,'xintai')).toBeUndefined();
 });
 it('uses one accessible skill across projects without creating project copies',()=>{
  const skill=useStudio.getState().skills.find(s=>s.personal)!;
  const copy=useStudio.getState().copySkillToSpace(skill.id,'xintai')!;
  expect(copy.id).toBe(skill.id);expect(copy.workspaceId||'personal').toBe('personal');
  expect(skillAvailableInSpace(copy,'dongguan',useStudio.getState())).toBe(true);
  expect(useStudio.getState().copySkillToSpace(skill.id,'xintai')?.id).toBe(copy.id);
 });
 it('pins a personal attachment after a project conversation revision',()=>{
  const state=useStudio.getState(),asset={...state.assets[4],id:'revision-personal',public:false,source:'uploaded' as const,workspaceId:'personal',package:undefined};
  state.addAsset(asset);
  const work=state.createWork({title:'多轮共享',type:'卡片浏览型',width:1920,height:1080,workspaceId:'xintai'});
  expect(state.reviseWork(work.id,'替换页面背景',{scope:'page',pageId:work.pages[0].id},[asset.id]).ok).toBe(false);
  const adopted=state.adoptAsset(asset.id,'xintai')!;
  expect(state.reviseWork(work.id,'替换页面背景',{scope:'page',pageId:work.pages[0].id},[adopted.id]).ok).toBe(true);
  const current=useStudio.getState(),saved=current.works.find(w=>w.id===work.id)!;
  expect(saved.pages[0].backgroundAssetId).not.toBe(asset.id);
  expect(current.assets.find(a=>a.id===saved.pages[0].backgroundAssetId)?.workspaceId).toBe('xintai');
 });
 it('keeps selected skill version inside the work after library changes',()=>{
  const state=useStudio.getState(),skill=state.skills.find(s=>s.personal)!;
  const work=state.createWork({title:'技能快照',type:'时间演进型',width:1920,height:1080,workspaceId:'xintai'});
  state.saveWork({...work,creationPackage:{...state.assets[0].package!,sourceId:undefined,files:[],skillIds:[skill.id]}});
  const saved=useStudio.getState().works.find(w=>w.id===work.id)!;
  const snapshot=saved.creationPackage!.skillSnapshots![0];
  expect(snapshot.workspaceId||'personal').toBe('personal');expect(snapshot.id).toBe(skill.id);expect(snapshot).not.toBe(skill);
  state.addSkill({...skill,name:'个人后续修改'});
  useStudio.setState(current=>({skills:current.skills.filter(s=>s.id!==skill.id)}));
  state.saveWork(saved);
  expect(useStudio.getState().works.find(w=>w.id===work.id)?.creationPackage?.skillSnapshots?.[0].name).toBe(skill.name);
 });
 it('seeds are idempotent, preserve edits and do not resurrect deletion',()=>{
  const data=createInitialData();const migrated=migrateResourcesV15(data);
  expect(migrated.skills.filter(s=>s.source==='builtin'&&s.personal).length).toBeGreaterThanOrEqual(6);
  const skill=migrated.skills.find(s=>s.source==='builtin')!;
  const edited={...migrated,skills:migrated.skills.map(s=>s.id===skill.id?{...s,name:'用户修改'}:s)};
  expect(migrateResourcesV15(edited).skills.find(s=>s.id===skill.id)?.name).toBe('用户修改');
  const deleted={...edited,skills:edited.skills.filter(s=>s.id!==skill.id)};
  expect(migrateResourcesV15(deleted).skills.some(s=>s.id===skill.id)).toBe(false);
  expect(createDraft().model).toBe('deepseek-flash');
 });
});
