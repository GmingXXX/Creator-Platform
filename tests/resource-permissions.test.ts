import {beforeEach, describe, expect, it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import type {Asset} from '../src/domain/types';

beforeEach(()=>useStudio.setState(createInitialData()));
const secret=():Asset=>({...createInitialData().assets[0],id:'private-secret',workspaceId:'xintai',source:'uploaded',public:false,src:'idb:private-secret',package:undefined});

describe('dependency access across resource reuse',()=>{
 it('does not auto-apply a reused private background marked reference-only',()=>{
  const state=useStudio.getState(),source=state.assets.find(asset=>asset.public&&asset.kind==='image')!;
  const adopted=state.adoptAsset(source.id,'personal')!;
  state.updateAssetMetadata(adopted.id,{business:{note:'仅作参考',subject:'',confirmed:false,usage:'reference',allowAi:true}});
  state.updateDraft({text:'制作企业大事记'});const run=state.startRun()!;
  state.updateRun(run.id,{resourceStrategy:'reuse',backgroundAssetId:state.adoptAsset(source.id,'personal')!.id});
  state.completeRun(run.id);
  expect(useStudio.getState().runs.find(task=>task.id===run.id)?.status).toBe('failed');
  expect(useStudio.getState().runs.find(task=>task.id===run.id)?.error).toContain('参考');
 });
 it('rejects a template with a private registered dependency before copying any resource',()=>{
  const state=useStudio.getState(),template=state.templates[0],privateAsset=secret();state.addAsset(privateAsset);
  useStudio.setState({templates:[{...template,work:{...template.work,pages:[{...template.work.pages[0],backgroundImage:privateAsset.src,backgroundAssetId:privateAsset.id}]}}]});
  const count=useStudio.getState().assets.length;
  expect(state.cloneTemplate(template.id)).toBeUndefined();
  expect(useStudio.getState().creationError).toContain('依赖');
  expect(useStudio.getState().assets).toHaveLength(count);
 });
 it('does not downgrade a forbidden explicit asset ID to a public source URL',()=>{
  const state=useStudio.getState(),privateAsset=secret(),template=state.templates[0];
  state.addAsset(privateAsset);state.addAsset({...privateAsset,id:'public-same-src',public:true,source:'community'});
  useStudio.setState({templates:[{...template,work:{...template.work,pages:[{...template.work.pages[0],backgroundImage:privateAsset.src,backgroundAssetId:privateAsset.id}]}}]});
  expect(state.cloneTemplate(template.id)).toBeUndefined();
 });
 it('rejects unknown browser-local dependency URLs in a public engineering snapshot',()=>{
  const state=useStudio.getState(),work=state.works.find(work=>work.kind==='presentation')!;
  state.addAsset({...state.assets[0],id:'unsafe-output',kind:'presentation',public:true,workSnapshot:{...work,pages:[{...work.pages[0],backgroundImage:'idb:missing-secret'}]},package:undefined});
  expect(state.adoptAsset('unsafe-output','aitown')).toBeUndefined();
 });
 it('rejects private package files recursively in same-style generation and direct adoption',()=>{
  const state=useStudio.getState(),privateAsset=secret();state.addAsset(privateAsset);
  const shared={...state.assets[0],id:'shared-package',public:true,package:{...state.assets[0].package!,files:[{name:'private.png',type:'image',src:privateAsset.src}]}};
  state.addAsset(shared);
  expect(state.referenceAsset(shared)).toBeUndefined();
  expect(state.adoptAsset(shared.id,'personal')).toBeUndefined();
  state.updateDraft({text:'参考这个包生成背景',reference:shared.package});
  expect(state.startRun()).toBeUndefined();
 });
 it('checks nested dependencies and engineering JSON without getting trapped in reference cycles',()=>{
  const state=useStudio.getState(),privateAsset=secret();state.addAsset(privateAsset);
  const first={...state.assets[0],id:'cycle-a',public:true,src:'/cycle-a.png',package:{...state.assets[0].package!,files:[{name:'other.png',type:'image',src:'/cycle-b.png'}]}};
  const second={...first,id:'cycle-b',src:'/cycle-b.png',package:{...first.package,files:[{name:'first.png',type:'image',src:'/cycle-a.png'},{name:'scene.json',type:'config',content:JSON.stringify({backgroundImage:privateAsset.src})}]}};
  state.addAsset(first);state.addAsset(second);
  expect(state.adoptAsset(first.id,'personal')).toBeUndefined();
  state.addAsset({...second,package:{...second.package,files:[second.package.files[0]]}});
  expect(state.adoptAsset(first.id,'personal')).toBeDefined();
 });
 it('rechecks private reference package dependency changes when a run completes',()=>{
  const state=useStudio.getState(),asset={...secret(),workspaceId:'personal'};state.addAsset(asset);
  state.updateDraft({text:'生成背景图片',reference:{...state.assets[0].package!,files:[{name:'image.png',type:'image',src:asset.src}]}});
  const run=state.startRun()!;expect(run).toBeDefined();
  state.addAsset({...asset,workspaceId:'xintai'});state.completeRun(run.id);
  expect(useStudio.getState().runs.find(task=>task.id===run.id)?.status).toBe('failed');
 });
});

describe('legacy submitted composer migration',()=>{
 it('consumes only an exactly matched draft with reliable timestamps',()=>{
  const state=useStudio.getState(),draft={...state.drafts[0],text:'已发送的需求',updatedAt:'2026-11-06T01:00:00.000Z'};
  const run={id:'old-run',workspaceId:draft.workspaceId,prompt:draft.text,model:draft.model,styleId:draft.styleId,skillIds:draft.skillIds,attachmentIds:draft.attachmentIds,reference:draft.reference,status:'complete' as const,step:5,outputKind:'exhibit' as const,createdAt:'2026-11-06T01:00:01.000Z'};
  const old={...state,composerSchemaVersion:undefined,drafts:[draft],runs:[run]};
  const merged=useStudio.persist.getOptions().merge!(old,state);
  expect(merged.drafts.some(item=>item.id===draft.id)).toBe(false);
  expect(merged.drafts.find(item=>item.id===merged.activeDraftId)?.text).toBe('');
  expect(merged.runs).toContainEqual(run);
  for(const patch of [{updatedAt:'2026-11-06T01:00:02.000Z'},{updatedAt:'invalid'},{attachmentIds:['different']},{workspaceId:'xintai'}]){
   const retained=useStudio.persist.getOptions().merge!({...old,drafts:[{...draft,...patch}]},state);
   expect(retained.drafts.some(item=>item.id===draft.id)).toBe(true);
  }
 });
 it('does not consume ambiguous input again after the migration marker is present',()=>{
  const state=useStudio.getState();state.updateDraft({text:'相同内容'});const run=state.startRun()!;
  const current=useStudio.getState(),draft={...current.drafts[0],text:run.prompt,updatedAt:run.createdAt};
  expect(useStudio.persist.getOptions().merge!({...current,composerSchemaVersion:1,drafts:[draft]},state).drafts[0].id).toBe(draft.id);
 });
});
