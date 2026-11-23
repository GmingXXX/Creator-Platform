import {beforeEach,describe,expect,it} from 'vitest';
import JSZip from 'jszip';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {collectAssetSources} from '../src/domain/logic';
import {workDependencyError} from '../src/domain/resource-permissions';
import {exportWork} from '../src/domain/export';
beforeEach(()=>useStudio.setState(createInitialData()));
const setup=()=>{const state=useStudio.getState();const asset={...state.assets[0],id:'cover-only',kind:'video' as const,src:'idb:movie',preview:'idb:poster',public:true,package:undefined};state.addAsset(asset);const work={...state.works[5],cover:asset.preview,coverAssetId:asset.id,pages:[{id:'blank',name:'页面',background:'#fff',nodes:[]}],storyNodes:[],storyEdges:[]};return {state,work,asset};};
describe('story cover dependencies',()=>{
 it('collects and rewrites a cover-only poster in an offline package',async()=>{
  const {work}=setup();expect(collectAssetSources(work)).toContain('idb:poster');
  const result=await exportWork(work,'browser',{loadMedia:async()=>new Blob(['poster'],{type:'image/png'})});
  const zip=await JSZip.loadAsync(await result.blob.arrayBuffer());const scene=JSON.parse(await zip.file('scene.json')!.async('string'));
  expect(scene.cover).toMatch(/^assets\//);expect(zip.file(scene.cover)).not.toBeNull();
 });
 it('checks ownership using the cover asset poster and rejects forged binding',()=>{
  const {work,asset}=setup();expect(workDependencyError([asset],work,'personal')).toBeUndefined();
  expect(workDependencyError([{...asset,public:false,workspaceId:'xintai'}],work,'personal')).toBeTruthy();
  expect(workDependencyError([asset],{...work,cover:'idb:other'},'personal')).toBeTruthy();
 });
 it('adopts cover-only resources into a fixed project copy and protects deletion',()=>{
  const {state,work,asset}=setup();state.setWorkspace('xintai');state.saveWork({...work,id:'new-story',workspaceId:'xintai'});
  const saved=useStudio.getState().works.find(w=>w.id==='new-story')!;
  expect(saved.coverAssetId).not.toBe(asset.id);const adopted=useStudio.getState().assets.find(a=>a.id===saved.coverAssetId)!;expect(adopted.workspaceId).toBe('xintai');expect(state.removeAsset(adopted.id)).toBe(false);
 });
});
