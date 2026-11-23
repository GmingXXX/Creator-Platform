import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {isProjectWork,reconcileWorkOutputs} from '../src/domain/work-outputs';
import {isLibraryAsset} from '../src/domain/project-taxonomy';
import {workDependencyError} from '../src/domain/resource-permissions';
import type {Asset,Submission} from '../src/domain/types';
beforeEach(()=>useStudio.setState(createInitialData()));
const legacyAsset=():Asset=>{
 const state=useStudio.getState(),work=state.works[3];
 return {...state.assets[0],id:'old-engine-index',kind:'presentation',public:false,source:'generated',sourceWorkId:work.id,src:'',name:work.title,package:{...state.assets[0].package!,files:[{name:'可编辑工程.json',type:'config',content:JSON.stringify(work)}]}};
};
describe('V1.4 project ownership migration',()=>{
 it('keeps every editable work in projects without creating new engineering library records',()=>{
  const state=useStudio.getState();expect(state.works.filter(isProjectWork)).toHaveLength(12);
  const work=state.createWork({title:'我的演示',kind:'presentation',type:'媒体叙事型',width:1920,height:1080});
  state.saveWork({...work,title:'演示修订'});
  expect(useStudio.getState().works.filter(w=>w.id===work.id)).toHaveLength(1);
  expect(useStudio.getState().assets.some(a=>a.sourceWorkId===work.id)).toBe(false);
 });
 it('preserves legacy private aliases, source packages, lifecycle and linked run idempotently',()=>{
  const state=useStudio.getState(),original=state.works[3],work={...original,workspaceId:'xintai',deletedAt:'2026-10-01'},asset={...legacyAsset(),workspaceId:'xintai'};
  const old={...state,works:[work],assets:[asset],favorites:[asset.id],runs:[{id:'run',model:'GPT',prompt:'演示',styleId:'',skillIds:[],attachmentIds:[],status:'complete' as const,step:5,outputKind:'presentation' as const,workId:work.id,assetId:asset.id,createdAt:work.createdAt}]};
  const migrated=reconcileWorkOutputs(old);
  expect(migrated.works).toEqual([{...work,creationPackage:asset.package}]);expect(migrated.assets).toContainEqual(asset);expect(migrated.assets.filter(isLibraryAsset)).toEqual([]);
  expect(migrated.runs[0].workId).toBe(work.id);expect(migrated.favorites).toEqual([asset.id]);expect(reconcileWorkOutputs(migrated)).toEqual(migrated);
 });
 it('moves published engineering snapshots and submissions to templates without changing publication identity',()=>{
  const state=useStudio.getState(),work=state.works[3],asset={...legacyAsset(),id:'public-engine',public:true,source:'community' as const,sourceWorkId:undefined,workSnapshot:structuredClone(work)};
  const submission:Submission={id:'old-review',kind:'asset',name:'审核快照',author:'纪鸣',createdAt:work.createdAt,status:'pending',revision:2,asset};
  const migrated=reconcileWorkOutputs({...state,assets:[asset],submissions:[submission],favorites:[asset.id]});
  expect(migrated.templates.find(t=>t.id===asset.id)?.work).toEqual({...work,creationPackage:asset.package});
  expect(migrated.assets[0]).toEqual(asset);expect(migrated.submissions[0]).toMatchObject({kind:'template',work,revision:2});
  useStudio.setState(migrated);state.saveWork({...work,title:'私有后续修改'});state.setRole('reviewer');state.reviewSubmission(submission.id,'approved');
  const published=useStudio.getState().templates.filter(t=>t.work.id===work.id);
  expect(published).toHaveLength(1);expect(published[0].id).toBe(asset.id);expect(published[0].work.title).toBe(work.title);
  expect(reconcileWorkOutputs(useStudio.getState()).templates.filter(t=>t.work.id===work.id)).toHaveLength(1);
 });
 it('copies legacy creation packages into private, public and review engineering without replacing existing packages',()=>{
  const state=useStudio.getState(),work=state.works[3],alias=legacyAsset(),published={...alias,id:'old-public',public:true,sourceWorkId:undefined,workSnapshot:structuredClone(work)};
  const submission:Submission={id:'legacy-pending',kind:'asset',name:work.title,author:'纪鸣',createdAt:work.createdAt,status:'pending',revision:1,asset:structuredClone(published)};
  const old={...state,assets:[alias,published],submissions:[submission]};
  const migrated=reconcileWorkOutputs(old),privateWork=migrated.works.find(item=>item.id===work.id)!,template=migrated.templates.find(item=>item.id===published.id)!;
  expect(privateWork.creationPackage).toEqual(alias.package);expect(template.work.creationPackage).toEqual(published.package);expect(migrated.submissions[0].work?.creationPackage).toEqual(published.package);
  expect(privateWork.creationPackage).not.toBe(alias.package);expect(template.work.creationPackage).not.toBe(published.package);expect(template.work.creationPackage).not.toBe(migrated.submissions[0].work?.creationPackage);
  expect(reconcileWorkOutputs(migrated)).toEqual(migrated);expect(work.creationPackage).toBeUndefined();
  const newer={...alias.package!,prompt:'新版工程自己的资料包'};
  const retained=reconcileWorkOutputs({...old,works:[{...work,creationPackage:newer}],templates:[{...template,work:{...work,creationPackage:newer}}]});
  expect(retained.works[0].creationPackage).toEqual(newer);expect(retained.templates[0].work.creationPackage).toEqual(newer);
  expect(reconcileWorkOutputs({...old,works:[]}).works[0].creationPackage).toEqual(alias.package);
 });
 it('omits only derived engineering indexes from copied provenance, retaining original resources',()=>{
  const state=useStudio.getState(),alias=legacyAsset(),original={name:'原始参考.png',type:'image',src:'/media/reference.png'};
  const old={...alias,package:{...alias.package!,files:[{...alias.package!.files[0],generatedBy:'work-output' as const},original]}};
  const migrated=reconcileWorkOutputs({...state,assets:[old]});
  expect(migrated.works.find(work=>work.id===alias.sourceWorkId)?.creationPackage?.files).toEqual([original]);expect(migrated.assets).toEqual([old]);
 });
 it('does not hide real rendered or uploaded media merely because a run has a work',()=>{
  const state=useStudio.getState(),asset={...state.assets.find(a=>a.kind==='video')!,id:'rendered-mp4',public:false,source:'uploaded' as const};
  const migrated=reconcileWorkOutputs({...state,assets:[asset]});expect(migrated.assets.filter(isLibraryAsset)).toEqual([asset]);
 });
 it('routes presentation and video submissions into template snapshots',()=>{
  const state=useStudio.getState();for(const work of state.works.filter(w=>['presentation','video'].includes(w.kind))){const id=state.submitWork(work.id)!;expect(useStudio.getState().submissions.find(s=>s.id===id)).toMatchObject({kind:'template',work:{id:work.id,kind:work.kind,title:work.title,pages:work.pages,...(work.shots?{shots:work.shots}:{})}});}
 });
 it('preserves canonical publication IDs and favorites when an old alias targets the same work',()=>{
  const state=useStudio.getState(),work=state.works[3],template={...state.templates[0],id:'existing-template',work};
  const asset={...legacyAsset(),id:'old-public-alias',public:true,sourceWorkId:undefined,workSnapshot:work};
  const migrated=reconcileWorkOutputs({...state,templates:[template],assets:[asset],favorites:[asset.id,template.id]});
  expect(migrated.templates).toEqual([{...template,work:{...work,creationPackage:asset.package}}]);expect(migrated.favorites).toEqual([template.id]);expect(migrated.assets).toEqual([asset]);
 });
 it('marks a newly generated complete HTML program as a project while preserving its source',()=>{
  const state=useStudio.getState();state.updateDraft({text:'制作HTML交互网页'});const run=state.startRun()!;state.completeRun(run.id);
  const after=useStudio.getState(),completed=after.runs.find(r=>r.id===run.id)!,work=after.works.find(w=>w.id===completed.workId)!;
  const asset=after.assets.find(item=>item.id===completed.assetId)!;
  expect(work.kind).toBe('exhibit');expect(work.pages[0].nodes[0].type).toBe('html');expect(asset).toMatchObject({presentationRole:'project-source',sourceWorkId:work.id});expect(isLibraryAsset(asset)).toBe(false);
 });
 it('retains creation context inside generated projects and checks its private dependencies',()=>{
  const state=useStudio.getState(),reference={...state.assets[0],id:'private-reference',public:false,workspaceId:'personal',src:'idb:reference',source:'uploaded' as const};state.addAsset(reference);
  state.updateDraft({text:'制作企业演示PPT',attachmentIds:[reference.id]});const run=state.startRun()!;state.completeRun(run.id);
  const after=useStudio.getState(),completed=after.runs.find(r=>r.id===run.id)!,work=after.works.find(w=>w.id===completed.workId)!;
  expect(work.creationPackage?.prompt).toBe(run.prompt);expect(work.creationPackage?.files.some(file=>file.src===reference.src)).toBe(true);
  expect(workDependencyError(after.assets,work,'personal')).toBeUndefined();
  expect(workDependencyError(after.assets,work,'xintai')).toBeTruthy();
  const otherSpace=after.assets.map(a=>a.id===reference.id?{...a,workspaceId:'dongguan'}:a);
  expect(workDependencyError(otherSpace,work,'xintai')).toBeTruthy();
 });
 it('generates editable video in projects without inventing a rendered MP4 output',()=>{
  const state=useStudio.getState();state.updateDraft({text:'生成企业讲解视频'});const run=state.startRun()!;state.completeRun(run.id);
  const after=useStudio.getState(),completed=after.runs.find(r=>r.id===run.id)!;
  expect(after.works.find(w=>w.id===completed.workId)?.kind).toBe('video');expect(completed.assetId).toBeUndefined();
 });
});
