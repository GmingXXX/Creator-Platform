import {cloneWork} from '../src/domain/logic';
import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData,createDraft} from '../src/domain/fixtures';
import {createSceneWork} from '../src/domain/scenes';
import {previewWorkTransfer,transferWorkToWorkspace} from '../src/domain/workspace-transfer';
import {createExhibitReference,validateReferences,referenceSource} from '../src/domain/exhibit-references';
import type {Asset,StudioData,Work} from '../src/domain/types';
const blank=(id:string):Work=>({...createSceneWork({title:id,type:'卡片浏览型',width:1920,height:1080,blank:true}),id,workspaceId:'personal'});
const asset=(id:string):Asset=>({id,workspaceId:'personal',name:id,kind:'image',src:`idb:${id}`,preview:`idb:${id}`,description:'资料',tags:[],author:'我',createdAt:'2026-11-17',source:'uploaded'});
let state:StudioData;
beforeEach(()=>{state={...createInitialData(),works:[blank('moving'),blank('untouched')],assets:[asset('image'),asset('unused')],runs:[],conversationTurns:[],drafts:[createDraft({id:'personal-draft',text:'不相关草稿',attachmentIds:['unused']}),createDraft({id:'target-draft',workspaceId:'xintai',text:'目标项目已有草稿'})],activeDraftId:'personal-draft'};});
describe('move personal work into project workspace',()=>{
 it('previews and atomically moves the work and its complete context while copying only dependencies',()=>{
  const work=state.works[0];work.pages[0].backgroundImage='idb:image';work.pages[0].backgroundAssetId='image';
  work.creationPackage={id:'pack',version:'1',prompt:'需求',files:[{name:'工程.json',type:'json',content:JSON.stringify({assetId:'image',src:'idb:image'})}],skillIds:['skill-1'],params:{referenceAssetIds:'["image"]'},complete:true};
  state.runs=[{id:'related',workId:work.id,workspaceId:'personal',prompt:'需求',model:'demo',styleId:'',skillIds:[],attachmentIds:['image'],status:'complete',step:5,outputKind:'exhibit',createdAt:''},{id:'other',workId:'untouched',workspaceId:'personal',prompt:'别的',model:'demo',styleId:'',skillIds:[],attachmentIds:['unused'],status:'complete',step:5,outputKind:'exhibit',createdAt:''}];
  state.conversationTurns=[{id:'turn',workId:work.id,prompt:'修改',target:{scope:'work'},summary:'已改',status:'applied',createdAt:'',before:structuredClone(work),afterRevision:work.revision,attachmentIds:['image']}];
  const before=structuredClone(state),preview=previewWorkTransfer(state,'moving','xintai');expect(preview.assetsToCopy).toHaveLength(1);expect(preview.runsCount).toBe(1);
  const next=transferWorkToWorkspace(state,'moving','xintai'),moved=next.works.find(w=>w.id==='moving')!,copied=next.assets.find(a=>a.origin?.assetId==='image')!;
  expect(state).toEqual(before);expect(moved.workspaceId).toBe('xintai');expect(moved.pages[0].backgroundAssetId).toBe(copied.id);expect(copied.workspaceId).toBe('xintai');expect(next.assets.find(a=>a.id==='image')).toEqual(before.assets[0]);expect(next.assets).toHaveLength(3);
  expect(next.runs[0].workspaceId).toBe('xintai');expect(next.runs[0].attachmentIds).toEqual([copied.id]);expect(next.runs[1]).toEqual(before.runs[1]);
  expect(next.conversationTurns[0].before?.workspaceId).toBe('xintai');expect(next.conversationTurns[0].before?.pages[0].backgroundAssetId).toBe(copied.id);expect(next.conversationTurns[0].afterRevision).toBe(moved.revision);
  expect(moved.creationPackage?.files[0].content).toContain(copied.id);expect(moved.creationPackage?.params.referenceAssetIds).toBe(JSON.stringify([copied.id]));
  expect(next.activeWorkspaceId).toBe('xintai');expect(next.activeDraftId).toBe('target-draft');expect(next.drafts).toEqual(before.drafts);
 });
 it('copies nested package dependencies and associates generated media without moving unrelated assets',()=>{
  state.assets[0]={...state.assets[0],package:{id:'p',version:'1',prompt:'',files:[{name:'nested',type:'image',src:'idb:unused'}],skillIds:[],params:{experienceWorkId:'moving'},complete:true}};
  const next=transferWorkToWorkspace(state,'moving','xintai');expect(next.assets.filter(a=>a.workspaceId==='xintai')).toHaveLength(2);expect(next.assets.find(a=>a.origin?.assetId==='image')?.package?.params.experienceWorkId).toBe('moving');
 });
 it('blocks unreadable targets, unavailable dependencies, and active related runs without mutation',()=>{
  expect(()=>transferWorkToWorkspace(state,'moving','missing')).toThrow();expect(()=>transferWorkToWorkspace(state,'moving','personal')).toThrow();
  state.workspaceActors.xintai='viewer';state.workspaceMembers.xintai.push({id:'viewer',name:'查看者',account:'viewer',role:'viewer',status:'member'});expect(()=>transferWorkToWorkspace(state,'moving','xintai')).toThrow(/权限|编辑/);
  state.workspaceActors.xintai='self';state.works[0].pages[0].backgroundAssetId='missing';expect(()=>transferWorkToWorkspace(state,'moving','xintai')).toThrow(/依赖/);
  state.works[0].pages[0].backgroundAssetId=undefined;state.runs=[{id:'busy',workId:'moving',prompt:'',model:'demo',styleId:'',skillIds:[],attachmentIds:[],status:'running',step:1,outputKind:'exhibit',createdAt:''}];expect(()=>transferWorkToWorkspace(state,'moving','xintai')).toThrow(/执行|停止/);
 });
 it('preserves private reference snapshots without granting access to their source work',()=>{
  const ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'untouched',dimension:'ui'});state.works[0].references=[ref];
  const next=transferWorkToWorkspace(state,'moving','xintai'),moved=next.works[0];expect(moved.references?.[0].transfer?.workspaceId).toBe('xintai');expect(validateReferences(moved.references,next,'xintai')).toHaveLength(1);
  expect(()=>referenceSource(next,'xintai','work','untouched')).toThrow();expect(()=>validateReferences(moved.references,next,'dongguan')).toThrow();
  expect(validateReferences(moved.references?.map(r=>({...r,note:'补充说明'})),next,'xintai')[0].note).toBe('补充说明');
  expect(()=>validateReferences(moved.references?.map(r=>({...r,snapshot:{...r.snapshot,pageCount:99}})),next,'xintai')).toThrow();
 });
 it('keeps adopted history and creates a target draft when none exists',()=>{
  state.drafts=state.drafts.filter(d=>d.workspaceId!=='xintai');const ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'untouched',dimension:'interaction'});state.works[0].referenceHistory=[{...ref,status:'adopted',adoptionEvidence:'已采用浏览结构'}];
  const next=transferWorkToWorkspace(state,'moving','xintai');expect(next.works[0].referenceHistory?.[0].status).toBe('adopted');expect(next.drafts.find(d=>d.id===next.activeDraftId)?.workspaceId).toBe('xintai');expect(next.drafts.find(d=>d.id==='personal-draft')?.text).toBe('不相关草稿');
 });
});

describe('complete dependency and provenance boundaries',()=>{
 it('reuses an already pinned version and moves engineering aliases without duplicating them',async()=>{
  const {assetVersion}=await import('../src/domain/resource-adoption');
  state.works[0].pages[0].backgroundImage='idb:image';state.works[0].pages[0].backgroundAssetId='image';
  state.assets.push({...state.assets[0],id:'already',workspaceId:'xintai',origin:{assetId:'image',version:assetVersion(state.assets[0])}});
  state.assets.push({...asset('alias'),sourceWorkId:'moving',workSnapshot:structuredClone(state.works[0])});
  const next=transferWorkToWorkspace(state,'moving','xintai');expect(next.assets).toHaveLength(state.assets.length);expect(next.works[0].pages[0].backgroundAssetId).toBe('already');expect(next.assets.find(a=>a.id==='alias')?.workspaceId).toBe('xintai');expect(next.assets.find(a=>a.id==='alias')?.workSnapshot?.workspaceId).toBe('xintai');
 });
 it('copies selected dependency IDs only when multiple private records share a URL',()=>{
  state.assets.push({...asset('twin'),src:'idb:image'});state.works[0].pages[0].backgroundImage='idb:image';state.works[0].pages[0].backgroundAssetId='twin';
  expect(previewWorkTransfer(state,'moving','xintai').assetsToCopy.map(a=>a.id)).toEqual(['twin']);
 });
 it('retains historical references used by earlier runs for later continuation',()=>{
  const ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'untouched',dimension:'interaction'});
  state.runs=[{id:'earlier',workId:'moving',prompt:'',model:'demo',styleId:'',skillIds:[],attachmentIds:[],references:[ref],status:'complete',step:5,outputKind:'exhibit',createdAt:''}];
  const next=transferWorkToWorkspace(state,'moving','xintai');expect(validateReferences(next.runs[0].references,next,'xintai')).toHaveLength(1);expect(next.works[0].referenceHistory).toBeUndefined();expect(next.works[0].referenceSnapshots?.[0].status).toBe('reference');
 });
 it('keeps unscoped builtins, pins public assets, and preserves story/video media IDs',()=>{
  state.assets[0]={...state.assets[0],public:true,workspaceId:undefined};state.assets[1]={...state.assets[1],source:'builtin',workspaceId:undefined};
  state.works[0]={...state.works[0],cover:'idb:image',coverAssetId:'image',storyNodes:[{id:'n',type:'start',x:0,y:0,title:'',text:'',media:'idb:image',mediaAssetId:'image'}],shots:[{id:'s',title:'',narration:'',duration:3,src:'idb:unused',assetId:'unused'}]};
  const next=transferWorkToWorkspace(state,'moving','xintai'),copy=next.assets.find(a=>a.origin?.assetId==='image')!;expect(copy.public).toBe(false);expect(next.works[0].coverAssetId).toBe(copy.id);expect(next.works[0].storyNodes?.[0].mediaAssetId).toBe(copy.id);expect(next.works[0].shots?.[0].assetId).toBe('unused');
 });
 it('rejects deleted work and referenced engineering belonging to another private work',()=>{
  expect(()=>previewWorkTransfer(state,'absent','xintai')).toThrow(/不存在/);
  state.assets[0].sourceWorkId='untouched';state.works[0].pages[0].backgroundImage='idb:image';state.works[0].pages[0].backgroundAssetId='image';expect(()=>previewWorkTransfer(state,'moving','xintai')).toThrow(/另一个/);
 });
 it('exposes a reusable dependency tree and remapper for explicit asset adoption',async()=>{
  const {collectAssetTreeDependencies,remapAssetReferences}=await import('../src/domain/workspace-transfer');
  state.assets[0].package={id:'pack',version:'1',prompt:'',files:[{name:'schema',type:'json',content:JSON.stringify({assetId:'unused',src:'idb:unused'})},{name:'text',type:'text',content:'普通文字'}],skillIds:[],params:{referenceAssetIds:'["unused"]'},complete:true};
  expect(collectAssetTreeDependencies(state,state.assets[0]).map(a=>a.id)).toEqual(['image','unused']);
  const remapped=remapAssetReferences(state.assets[0],new Map([['unused','new-unused']]));expect(remapped.package?.files[0].content).toContain('new-unused');expect(remapped.package?.files[1].content).toBe('普通文字');expect(state.assets[0].package.files[0].content).not.toContain('new-unused');
 });
});

describe('continuing after a move',()=>{
 it('rejects an old personal editor snapshot after the work moves',async()=>{
  const {useStudio}=await import('../src/domain/store');useStudio.setState(state);
  const stale=structuredClone(state.works[0]);useStudio.getState().moveWorkToWorkspace('moving','xintai');
  expect(()=>useStudio.getState().saveWork(stale)).toThrow(/已移动/);
  expect(useStudio.getState().works.find(work=>work.id==='moving')?.workspaceId).toBe('xintai');
 });
 it('can continue a named portable reference without re-reading its private source',async()=>{
  const {referencesFromPrompt}=await import('../src/domain/exhibit-references');
  state.works[0].references=[createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'untouched',dimension:'ui'})];
  const next=transferWorkToWorkspace(state,'moving','xintai');
  const refs=referencesFromPrompt('UI沿用「untouched」仅调整标题',next,'xintai',next.works[0].references);
  expect(refs[0].note).toContain('仅调整标题');expect(validateReferences(refs,next,'xintai')[0].transfer?.workId).toBe('moving');
 });
});

describe('transfer evidence is separate from adoption history',()=>{
 it('keeps a transferred candidate as a candidate in experience summaries',async()=>{
  const {experienceReferences}=await import('../src/domain/creation-experience');
  const candidate=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'untouched',dimension:'ui'});
  state.works[0].references=[candidate];
  const next=transferWorkToWorkspace(state,'moving','xintai'),moved=next.works[0];
  expect(experienceReferences(moved)).toContain('参考候选');expect(experienceReferences(moved)).not.toContain('历史采用');
  expect(moved.referenceHistory).toBeUndefined();expect(moved.referenceSnapshots?.[0].status).toBe('reference');
  expect(validateReferences(moved.references,next,'xintai')).toHaveLength(1);
 });
});

describe('pending backgrounds and plan image provenance',()=>{
 it('blocks a pending or recoverable background job even when the main run is complete',()=>{
  const run={id:'background-run',workId:'moving',workspaceId:'personal',prompt:'背景',model:'demo',styleId:'',skillIds:[],attachmentIds:[],status:'complete' as const,step:5,outputKind:'exhibit' as const,createdAt:'',backgroundDraft:{requestId:'background',prompt:'背景',size:'1920x1080',status:'pending' as const}};
  state.runs=[run];const before=structuredClone(state);expect(()=>transferWorkToWorkspace(state,'moving','xintai')).toThrow(/背景|执行|停止/);expect(state).toEqual(before);
  state.runs=[{...run,backgroundDraft:{...run.backgroundDraft,status:'failed',retryable:true}}];expect(()=>transferWorkToWorkspace(state,'moving','xintai')).toThrow(/背景|执行|停止/);
  state.runs=[{...run,backgroundDraft:{...run.backgroundDraft,status:'failed',retryable:false}}];expect(transferWorkToWorkspace(state,'moving','xintai').works[0].workspaceId).toBe('xintai');
 });
 it('copies and rewrites section image IDs retained in a completed AI plan',()=>{
  state.runs=[{id:'plan-run',workId:'moving',workspaceId:'personal',prompt:'资料配图',model:'demo',styleId:'',skillIds:[],attachmentIds:[],status:'complete',step:5,outputKind:'exhibit',createdAt:'',aiPlan:{mode:'create',title:'计划',type:'卡片浏览型',answer:'',sections:[{title:'阶段',body:'说明',imageAssetId:'image'}]}}];
  const next=transferWorkToWorkspace(state,'moving','xintai'),copy=next.assets.find(asset=>asset.origin?.assetId==='image');
  expect(copy?.workspaceId).toBe('xintai');expect(next.runs[0].aiPlan?.sections?.[0].imageAssetId).toBe(copy?.id);expect(next.assets.find(asset=>asset.id==='image')?.workspaceId).toBe('personal');
 });
});

it('a copied moved work keeps its own reference snapshots when the original work is deleted',()=>{
 const data=createInitialData(),original={...data.works[0],workspaceId:'personal'},source={...structuredClone(original),id:'private-reference',title:'参考来源'};
 const context={...data,works:[original,source]},ref=createExhibitReference(context,'personal',{sourceKind:'work',sourceId:source.id,dimension:'ui'});
 const moved=transferWorkToWorkspace({...context,works:[{...original,references:[ref]},source]},original.id,'xintai');
 const copy=cloneWork(moved.works.find(work=>work.id===original.id)!);
 const withoutOriginal={...moved,works:[copy,source]};
 expect(()=>validateReferences(copy.references,withoutOriginal,'xintai')).not.toThrow();
});
