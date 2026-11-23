import {describe,expect,it} from 'vitest';
import type {Asset} from '../src/domain/types';
import type {PresentationPlan} from '../src/domain/presentation-generation';
import {applyDemoPresentationMedia,demoPresentationFiles,demoPresentationMediaContext} from '../src/domain/demo-presentation-media';
const titles=['从感知到协同','企业发展历程','三项核心能力','示范产线实践','绿色运营实践','业务与服务布局','储能监测案例','下一阶段的方向'];
const plan=():PresentationPlan=>({title:'星澜智造',sections:titles.map(title=>({title,narration:'模拟讲解',bullets:['资料事实'],layout:'bullets',imageAssetId:'preset-0'}))});
const images=():Asset[]=>demoPresentationFiles.map((file,i)=>({id:`preset-${i}`,name:file.name,kind:'image',src:file.url,preview:file.url,description:'预置概念图',tags:[],author:'',createdAt:'',source:'builtin',workspaceId:'xintai',package:{id:`pack-${i}`,version:'1',prompt:'',files:[],skillIds:[],params:{knowledgeCatalogId:'zhichuang-20261116',knowledgeCase:'presentation',knowledgePath:file.path},complete:true}}));
describe('presentation demo media',()=>{
 it('defines six distinct ready-to-use images and reserves two live slots',()=>{
  expect(demoPresentationFiles).toHaveLength(6);expect(new Set(demoPresentationFiles.map(f=>f.url)).size).toBe(6);
  const before=plan(),snapshot=structuredClone(before),result=applyDemoPresentationMedia(before,images(),'xintai');
  expect(result.sections.map(s=>s.imageAssetId)).toEqual(['preset-0','preset-1','preset-2','preset-3','preset-4','preset-5',undefined,undefined]);
  expect(result.sections.slice(0,6).every(s=>s.layout==='split')).toBe(true);expect(before).toEqual(snapshot);
 });
 it('maps renamed prefixes and reordered titles by meaning rather than page position',()=>{
  const before=plan();before.sections=[...before.sections].reverse().map((s,i)=>({...s,title:`${i+1}. ${s.title} · 星澜智造`}));
  expect(applyDemoPresentationMedia(before,images(),'xintai').sections.map(s=>s.imageAssetId)).toEqual([undefined,undefined,'preset-5','preset-4','preset-3','preset-2','preset-1','preset-0']);
 });
 it('keeps the known demo first six images and reserves the last two when model titles drift',()=>{
  const before={...plan(),sections:plan().sections.map((s,i)=>({...s,title:`第${i+1}章：重新组织的标题`}))};
  expect(applyDemoPresentationMedia(before,images(),'xintai',true).sections.map(s=>s.imageAssetId)).toEqual(['preset-0','preset-1','preset-2','preset-3','preset-4','preset-5',undefined,undefined]);
  expect(applyDemoPresentationMedia({...before,sections:before.sections.slice(0,4)},images(),'xintai',true).sections).toHaveLength(4);
 });
 it('leaves unrelated and partial outlines alone',()=>{
  const other={...plan(),sections:plan().sections.map((s,i)=>i===0?{...s,title:'旅游推荐'}:s)};
  expect(applyDemoPresentationMedia(other,images(),'xintai')).toBe(other);
  const short={...plan(),sections:plan().sections.slice(0,4)};expect(applyDemoPresentationMedia(short,images(),'xintai')).toBe(short);
 });
 it('requires exact source provenance and accepts the home demo v3 package',()=>{
  const plain=images().map(a=>({...a,package:undefined})),before=plan();expect(applyDemoPresentationMedia(before,plain,'xintai')).toBe(before);
  const home=images().map((a,i)=>({...a,package:{...a.package!,params:{demoInputKey:`v3:presentation:${demoPresentationFiles[i].path}`}}}));
  expect(applyDemoPresentationMedia(before,home,'xintai').sections[1].imageAssetId).toBe('preset-1');
  const forged=images().map(a=>({...a,package:{...a.package!,params:{...a.package!.params,knowledgeCatalogId:'another'}}}));expect(applyDemoPresentationMedia(before,forged,'xintai')).toBe(before);
 });
 it.each(['wrong-space','deleted','archived','blocked','reference','document'])('does not select %s assets',reason=>{
  const pool=images().map((a,i)=>i!==2?a:reason==='wrong-space'?{...a,workspaceId:'dongguan'}:reason==='deleted'?{...a,deletedAt:'2026-11-18'}:reason==='archived'?{...a,archived:true}:reason==='document'?{...a,kind:'document' as const}:{...a,metadata:{business:{note:'',subject:'',confirmed:false,usage:reason==='reference'?'reference' as const:'reusable' as const,allowAi:reason!=='blocked'}}});
  expect(applyDemoPresentationMedia(plan(),pool,'xintai').sections[2].imageAssetId).toBeUndefined();
 });
 it('exposes only usable mappings to the generation context',()=>{
  const context=demoPresentationMediaContext(images(),'xintai');expect(context?.prepared).toHaveLength(6);expect(context?.generate).toEqual(titles.slice(6));
  expect(demoPresentationMediaContext(images(),'dongguan')).toBeUndefined();
 });
});
