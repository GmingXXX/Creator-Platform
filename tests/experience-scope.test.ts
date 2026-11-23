import {describe,expect,it} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {experienceScopeLabel,experienceScopeOptions} from '../src/domain/experience-scope';
const sample=()=>createSceneWork({title:'测试作品',type:'时间演进型',width:1920,height:1080});
describe('experience scope selection',()=>{
 it('offers work, containing page and selected component without changing target',()=>{
  const work=sample(),page=work.pages[0],target={scope:'node' as const,pageId:page.id,nodeId:page.nodes[0].id};
  const options=experienceScopeOptions(work,target);
  expect(options.map(o=>o.target.scope)).toEqual(['work','page','node']);
  expect(options[1].label).toContain(page.name);expect(options[2].label).toContain(page.nodes[0].name);
  expect(target.scope).toBe('node');
 });
 it('omits deleted scopes and retains valid containing page',()=>{
  const work=sample(),page=work.pages[0];
  expect(experienceScopeOptions(work,{scope:'node',pageId:page.id,nodeId:'gone'}).map(o=>o.target.scope)).toEqual(['work','page']);
  expect(experienceScopeOptions(work,{scope:'page',pageId:'gone'})).toHaveLength(1);
 });
 it('names story nodes and shots accurately with no artificial page option',()=>{
  const work=sample();
  const story={...work,storyNodes:[{id:'n',type:'scene',x:0,y:0,title:'故事起点',text:'剧情'}]};
  expect(experienceScopeOptions(story,{scope:'node',pageId:'@story',nodeId:'n'}).map(o=>o.label)).toEqual(['整个作品','当前节点 · 故事起点']);
  const video={...work,shots:[{id:'s',title:'开场',narration:'讲述',duration:8,src:''}]};
  expect(experienceScopeOptions(video,{scope:'node',pageId:'@shots',nodeId:'s'}).map(o=>o.label)).toEqual(['整个作品','当前分镜 · 开场']);
 });
 it('labels older records without resolving against a different current selection',()=>{
  expect(experienceScopeLabel({scope:'work'})).toBe('整个作品');
  expect(experienceScopeLabel({scope:'page',pageId:'p'})).toBe('页面 · p');
  expect(experienceScopeLabel({scope:'node',pageId:'@story',nodeId:'n'})).toBe('故事节点 · n');
 });
 it('labels current pages and components by the recorded ids, including later array entries',()=>{
  const base=sample(),first=base.pages[0],work={...base,pages:[first,{...first,id:'second',name:'证据页面',nodes:[...first.nodes,{...first.nodes[0],id:'evidence',name:'专利证据'}]}]};
  expect(experienceScopeLabel({scope:'page',pageId:'second'},work)).toBe('页面 · 证据页面');
  expect(experienceScopeLabel({scope:'node',pageId:'second',nodeId:'evidence'},work)).toBe('组件 · 专利证据（证据页面）');
  const renamed={...work,pages:work.pages.map(p=>p.id==='second'?{...p,name:'更新的证据页'}:p)};
  expect(experienceScopeLabel({scope:'page',pageId:'second'},renamed)).toBe('页面 · 更新的证据页');
  expect(experienceScopeOptions(work,{scope:'page',pageId:'second'}).map(o=>o.target.scope)).toEqual(['work','page']);
  expect(experienceScopeOptions(work,{scope:'work'}).map(o=>o.target.scope)).toEqual(['work']);
 });
 it('falls back to stored ids when page or component was deleted, never another object name',()=>{
  const work=sample(),page=work.pages[0];
  expect(experienceScopeLabel({scope:'page',pageId:'deleted'},work)).toBe('页面 · deleted');
  expect(experienceScopeLabel({scope:'node',pageId:page.id,nodeId:'deleted'},work)).toBe(`组件 · deleted（${page.name}）`);
  expect(experienceScopeLabel({scope:'node',pageId:'deleted-page',nodeId:'deleted'},work)).toBe('组件 · deleted');
  expect(experienceScopeLabel({scope:'page'},work)).toBe('页面 · 未记录名称');
  expect(experienceScopeLabel({scope:'node'},work)).toBe('组件 · 未记录名称');
 });
 it('resolves recorded story and shot names and safely handles deleted or absent collections',()=>{
  const base=sample(),story={...base,storyNodes:[{id:'other',type:'scene',x:0,y:0,title:'别的节点',text:''},{id:'n',type:'scene',x:0,y:0,title:'故事结局',text:''}]};
  const video={...base,shots:[{id:'other',title:'其他',narration:'',duration:8,src:''},{id:'s',title:'开场镜头',narration:'',duration:8,src:''}]};
  expect(experienceScopeLabel({scope:'node',pageId:'@story',nodeId:'n'},story)).toBe('故事节点 · 故事结局');
  expect(experienceScopeLabel({scope:'node',pageId:'@shots',nodeId:'s'},video)).toBe('分镜 · 开场镜头');
  expect(experienceScopeLabel({scope:'node',pageId:'@shots',nodeId:'s'})).toBe('分镜 · s');
  for(const pageId of ['@story','@shots']){
   const collection=pageId==='@story'?story:video,label=pageId==='@story'?'故事节点':'分镜';
   expect(experienceScopeLabel({scope:'node',pageId,nodeId:'gone'},collection)).toBe(`${label} · gone`);
   expect(experienceScopeLabel({scope:'node',pageId},base)).toBe(`${label} · 未记录名称`);
   expect(experienceScopeOptions(collection,{scope:'node',pageId,nodeId:'gone'})).toHaveLength(1);
   expect(experienceScopeOptions(base,{scope:'node',pageId,nodeId:'gone'})).toHaveLength(1);
  }
 });
});
