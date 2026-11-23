import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {assetAvailableForAI,assetAvailableForInsertion,assetAvailableForPersonalImport} from '../src/domain/asset-access';
import {getBackgroundCandidates} from '../src/domain/generation-resource';
import type {Asset,Run} from '../src/domain/types';
const image=(id:string,workspaceId:string):Asset=>({...createInitialData().assets[0],id,workspaceId,public:false,source:'uploaded',name:'蓝色工业背景',src:`/media/${id}.png`,package:undefined,metadata:{analysis:{status:'ready',summary:'蓝色工业背景',tags:['工业','背景'],basis:'demo'},business:{note:'',subject:'',confirmed:false,usage:'reusable',allowAi:true}}});
beforeEach(()=>useStudio.setState(createInitialData()));
describe('project context only uses explicitly adopted personal media',()=>{
 it('does not make personal media implicitly available to a project',()=>{
  const personal=image('personal-photo','personal');
  expect(assetAvailableForAI(personal,'xintai')).toBe(false);
  expect(assetAvailableForInsertion(personal,'xintai')).toBe(false);
  expect(assetAvailableForPersonalImport(personal,'xintai')).toBe(true);
  expect(assetAvailableForPersonalImport(personal,'personal')).toBe(false);
  expect(assetAvailableForPersonalImport({...personal,workspaceId:'dongguan'},'xintai')).toBe(false);
  expect(assetAvailableForPersonalImport({...personal,deletedAt:'now'},'xintai')).toBe(false);
 });
 it('keeps background discovery within project, public and platform resources',()=>{
  const assets=[image('personal','personal'),image('other','dongguan'),image('project','xintai'),{...image('public','personal'),public:true},{...image('builtin','personal'),source:'builtin' as const,workspaceId:undefined}];
  const run={workspaceId:'xintai',prompt:'蓝色工业背景',styleId:''} as Run;
  expect(getBackgroundCandidates(run,assets).map(match=>match.asset.id).sort()).toEqual(['builtin','project','public']);
 });
 it('allows a stable explicit project copy without removing the personal original',()=>{
  const state=useStudio.getState(),personal=image('personal-photo','personal');state.addAsset(personal);
  state.setWorkspace('xintai');const copy=state.adoptAsset(personal.id,'xintai')!;
  expect(copy.workspaceId).toBe('xintai');expect(copy.id).not.toBe(personal.id);
  expect(assetAvailableForAI(copy,'xintai')).toBe(true);expect(assetAvailableForAI(copy,'dongguan')).toBe(false);
  expect(useStudio.getState().assets.find(asset=>asset.id===personal.id)?.workspaceId).toBe('personal');
  expect(state.adoptAsset(personal.id,'xintai')?.id).toBe(copy.id);
 });
});
