import {describe,it,expect} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {applyCreationReferences,referenceExhibitType} from '../src/domain/reference-application';
import type {ExhibitReference} from '../src/domain/exhibit-references';
const reference=(dimension:ExhibitReference['dimension'],patch:Partial<ExhibitReference>={}):ExhibitReference=>({id:dimension,sourceKind:'template',sourceId:'source',sourceTitle:'参考作品',sourceRevision:1,dimension,scope:'work',scopeLabel:'整个作品',note:'',status:'reference',snapshot:{kind:'exhibit',pageCount:1,nodeTypes:['timeline'],itemGroupSizes:[4],interactions:[],visuals:{background:'#fafafa',text:'#101010',accent:'#225588',radius:18,fontSize:48},layout:[],motion:[]},...patch});
const work=()=>createSceneWork({title:'当前客户',type:'时间演进型',width:1920,height:1080});
describe('supported reference application',()=>{
 it('applies UI tokens to editable nodes and preserves customer content and interactions',()=>{
  const original=work(),next=applyCreationReferences(original,[reference('ui')]);
  expect(next.pages[0].background).toBe('#fafafa');expect(next.pages[0].nodes[0].color).toBe('#101010');
  expect(next.pages.flatMap(p=>p.nodes).map(n=>n.content)).toEqual(original.pages.flatMap(p=>p.nodes).map(n=>n.content));
  expect(next.references?.[0].status).toBe('adopted');expect(next.references?.[0].adoptionEvidence).toContain('样式');
  expect(original.pages[0].background).not.toBe('#fafafa');
 });
 it('keeps explicit project colors and reports only properties really applied',()=>{
  const original=work(),next=applyCreationReferences(original,[reference('ui')],{preserveColors:true});
  expect(next.pages[0].background).toBe(original.pages[0].background);expect(next.references?.[0].adoptionEvidence).toContain('作品配色');
 });
 it('does not silently pick among conflicting UI sources or apply a local reference globally',()=>{
  const original=work(),next=applyCreationReferences(original,[reference('ui'),reference('ui',{id:'other',sourceId:'other'})]);expect(next.pages).toEqual(original.pages);expect(next.references?.every(r=>r.status==='reference')).toBe(true);
  expect(applyCreationReferences(original,[reference('ui',{scope:'node:page:node'})]).pages).toEqual(original.pages);
 });
 it('selects supported interaction structure only without an explicit conflicting request',()=>{
  expect(referenceExhibitType('做一个完整展项',[reference('interaction')],'卡片浏览型')).toEqual({type:'时间演进型',referenceId:'interaction'});
  expect(referenceExhibitType('制作案例卡片墙',[reference('interaction')],'卡片浏览型')).toEqual({type:'卡片浏览型'});
  const next=applyCreationReferences(work(),[reference('interaction')],{interactionId:'interaction'});expect(next.references?.[0].adoptionEvidence).toContain('原生');
 });
 it('keeps freeform scope constraints as references instead of applying globally',()=>{
  const original=work(),limited=reference('ui',{note:'只应用主内容区，保留导航'});
  expect(applyCreationReferences(original,[limited]).pages).toEqual(original.pages);
  expect(applyCreationReferences(original,[reference('ui')],{prompt:'UI参考A。仅应用主内容区。'}).references?.[0].status).toBe('reference');
  expect(referenceExhibitType('制作完整展项',[reference('interaction',{note:'只参考弹窗'})],'卡片浏览型').referenceId).toBeUndefined();
 });
 it('does not mark unused effects as applied and keeps provenance with the package',()=>{
  const original={...work(),creationPackage:{id:'pack',version:'1',prompt:'',files:[],skillIds:[],params:{},complete:true}};
  const next=applyCreationReferences(original,[reference('effect')]);expect(next.references?.[0].status).toBe('reference');expect(next.creationPackage?.references).toEqual(next.references);
 });
});
