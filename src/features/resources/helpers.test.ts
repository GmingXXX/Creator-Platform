import { describe, expect, it, vi } from 'vitest';
import { applySystem, assetCanInsert, assetNode, assetPreviewWork, filterWorks, formatDate, parseSkill, workRoute, typeLabels, kindLabels } from './helpers';
import type { Asset, DesignSystem, Work } from '../../domain/types';
const work: Work = {id:'w',projectId:'p',title:'钢铁企业',kind:'exhibit',type:'时间演进型',width:1920,height:1080,styleId:'industrial',updatedAt:'2026-11-06T00:00:00Z',createdAt:'2026-11-06T00:00:00Z',revision:1,pages:[{id:'p',name:'首页',background:'#000',nodes:[{id:'n',type:'text',name:'标题',content:'不变的内容',x:10,y:10,w:200,h:60,rotation:0,opacity:1,hidden:false,locked:false,color:'#fff',background:'transparent',fontSize:24,radius:0}]}]};
const system: DesignSystem={id:'gov',name:'政务风',subtitle:'庄重',description:'',colors:['#b00'],background:'#fff',text:'#111',accent:'#b00',font:'sans-serif',motion:'淡入',tags:[]};
describe('resource workflows',()=>{
 it('style application preserves structure, content and original',()=>{const result=applySystem(work,system); expect(result.styleId).toBe('gov');expect(result.pages[0].nodes[0].content).toBe('不变的内容');expect(result.pages[0].nodes[0].x).toBe(10);expect(result.pages[0].nodes[0].color).toBe('#111');expect(work.pages[0].background).toBe('#000');});
 it('filters active works and handles searches',()=>{expect(filterWorks([work,{...work,id:'a',archived:true}],{query:'钢铁',type:'全部',time:'全部时间',archived:false,sort:'recent'})).toHaveLength(1);expect(filterWorks([work],{query:'不存在',type:'全部',time:'全部时间',archived:false,sort:'recent'})).toHaveLength(0);});
 it('uses correct specialized routes',()=>{expect(workRoute({...work,kind:'story'})).toBe('/dream/w');expect(workRoute(work)).toBe('/editor/w');});
 it('validates imported skill packages instead of running code',()=>{expect(()=>parseSkill('{broken','skill.json')).toThrow();expect(()=>parseSkill(JSON.stringify({name:'仅名称'}),'skill.json')).toThrow();expect(parseSkill('# 背景制作\n\n生成展厅背景图。\n\n## 输入\n主题\n\n## 步骤\n1. 理解主题\n2. 生成图片','skill.md').name).toBe('背景制作');});
 it('rejects unsupported imports and preserves safe fields',()=>{expect(()=>parseSkill('alert(1)','skill.js')).toThrow();const s=parseSkill(JSON.stringify({name:'技能',description:'用途',input:'需求',steps:['生成']}),'skill.json');expect(s.personal).toBe(true);expect(s.steps).toEqual(['生成']);});
 it('inserts an editable asset node with stable source reference',()=>{const asset:Asset={id:'a',name:'图片',kind:'image',src:'idb:a',preview:'',description:'',tags:[],author:'纪鸣',createdAt:'',source:'uploaded'};const n=assetNode(asset,work);expect(n.type).toBe('image');expect(n.src).toBe('idb:a');expect(n.w).toBeGreaterThan(0);});
});

describe('editable material resource boundaries',()=>{
 const asset:Asset={id:'material',name:'讲解演示',kind:'presentation',src:'',preview:'',description:'',tags:[],author:'纪鸣',createdAt:'',source:'generated',sourceWorkId:'w'};
 it('previews the latest private engineering document',()=>{
  const live={...work,kind:'presentation' as const,title:'最新保存的讲解演示'};
  expect(assetPreviewWork({...asset,workSnapshot:work},[live])).toBe(live);
 });
 it('never reads private engineering data for a community preview',()=>{
  const published={...work,title:'已审核发布的版本'};
  const live={...work,title:'后续修改的私有版本'};
  expect(assetPreviewWork({...asset,public:true,workSnapshot:published},[live])).toBe(published);
  expect(assetPreviewWork({...asset,public:true},[live])).toBeUndefined();
 });
 it('prevents presentation and unrendered video documents from becoming media nodes',()=>{
  expect(assetCanInsert(asset)).toBe(false);
  expect(assetCanInsert({...asset,kind:'video'})).toBe(false);
  expect(()=>assetNode(asset,work)).toThrow('继续编辑');
  expect(assetCanInsert({...asset,kind:'video',sourceWorkId:undefined})).toBe(true);
  expect(assetCanInsert({...asset,kind:'image',sourceWorkId:undefined})).toBe(true);
 });
});

describe('resource edge cases',()=>{
 it('normalizes accidental surrounding search whitespace',()=>{expect(filterWorks([work],{query:'  钢铁  ',type:'全部',time:'全部时间',archived:false,sort:'recent'})).toHaveLength(1);});
 it('filters dates and exhibit types without changing source order',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-10T00:00:00Z'));const old={...work,id:'old',title:'A',updatedAt:'2026-10-01T00:00:00Z'};const recent={...work,id:'new',title:'B',updatedAt:'2026-11-09T00:00:00Z'};const list=[old,work,recent];expect(filterWorks(list,{query:'',type:'时间演进型',time:'最近7天',archived:false,sort:'recent'}).map(x=>x.id)).toEqual(['new','w']);expect(filterWorks(list,{query:'',type:'关系图谱型',time:'最近30天',archived:false,sort:'name'})).toHaveLength(0);expect(filterWorks([recent,old],{query:'',type:'全部',time:'全部时间',archived:false,sort:'name'})[0].id).toBe('old');expect(list[0].id).toBe('old');vi.useRealTimers();});
 it('routes all supported work types and formats display dates',()=>{expect(workRoute({...work,kind:'presentation'})).toBe('/presentations/w');expect(workRoute({...work,kind:'video'})).toBe('/video/w');expect(formatDate('2026-11-06T00:00:00Z')).toContain('11');});
 it('applies theme to shapes, controls and animated content',()=>{const base=work.pages[0].nodes[0];const themed=applySystem({...work,pages:[{...work.pages[0],backgroundImage:'/old.svg',backgroundAssetId:'old-asset',nodes:[{...base,type:'button',background:'#555'},{...base,id:'shape',type:'shape',background:'#444',motion:{preset:'淡入',duration:1,delay:0,easing:'linear',hold:true}},{...base,id:'card',type:'card',background:'#555'}]}]},system);expect(themed.pages[0].backgroundImage).toBe('/media/gov.svg');expect(themed.pages[0].backgroundAssetId).toBeUndefined();expect(themed.pages[0].nodes[0].background).toBe(system.accent);expect(themed.pages[0].nodes[0].color).toBe(system.background);expect(themed.pages[0].nodes[1].motion?.easing).toBe('ease-in-out');expect(themed.pages[0].nodes[2].background).toBe(system.background);});
 it('rejects unsafe shapes, empty steps and oversized manifests',()=>{expect(()=>parseSkill('x'.repeat(200001),'skill.md')).toThrow('过大');expect(()=>parseSkill('null','skill.json')).toThrow('有效');for(const data of [{name:' ',description:'内容',steps:['生成']},{name:'技能',description:'内容',steps:[null]},{name:'技能',description:'内容',steps:[' ']},{name:'技能',description:'内容',steps:[]}])expect(()=>parseSkill(JSON.stringify(data),'skill.json')).toThrow('名称');});
 it('imports explicit manifest metadata and markdown defaults',()=>{const skill=parseSkill(JSON.stringify({name:'定制',description:'用途',steps:['创建'],input:'主题',category:'组件',styleId:'jewelry',version:'2.0'}),'x.json');expect(skill).toMatchObject({input:'主题',category:'组件',styleId:'jewelry',version:'2.0'});const markdown=parseSkill('# 制作背景\n生成背景图。\n1. 创建图片','x.md');expect(markdown.input).toContain('屏幕');expect(markdown.steps).toEqual(['创建图片']);});
 it('only inserts registered components and preserves asset identity',()=>{const a:Asset={id:'a',name:'素材',kind:'component',src:'idb:a',preview:'',description:'',tags:[],author:'纪鸣',createdAt:'',source:'generated'};expect(assetCanInsert(a)).toBe(false);expect(()=>assetNode(a,work)).toThrow();const card=assetNode({...a,componentType:'card'},work);expect(card.type).toBe('card');expect(card.items).toHaveLength(1);expect(card.assetId).toBe('a');expect(assetCanInsert({...a,kind:'document'})).toBe(false);});
});


describe('V1.4 resource vocabulary',()=>{
 it('shows embedded HTML as a component and uses project-facing labels',()=>{
  expect(typeLabels.html).toBe('嵌入式组件');
  expect(typeLabels.presentation).toBe('文档资料');
  expect(kindLabels.exhibit).toBe('交互页面');
  expect(kindLabels.story).toBe('互动影片');
 });
});
