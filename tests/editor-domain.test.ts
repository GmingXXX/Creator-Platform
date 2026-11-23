import { describe, expect, it } from 'vitest';
import { createHistory, pushHistory, undoHistory, redoHistory, resizeNode, normalizeCommand, findCommand, cloneSelectedNodes, updatePageNodes, createNode, canSetParent, graphLayout, matchCommands, videoPageProgress } from '../src/features/editor/editor-domain';
import type { Work } from '../src/domain/types';
const node=createNode('text',10,20);
const work={id:'w',pages:[{id:'p',name:'首页',background:'#fff',nodes:[{...node,id:'n'}]}]} as Work;
describe('editor immutable history',()=>{
 it('restores one operation and drops future after a new edit',()=>{
  const first=createHistory(work);const next=updatePageNodes(work,'p',['n'],{x:40});
  const edited=pushHistory(first,next);expect(first.present.pages[0].nodes[0].x).toBe(10);
  const undo=undoHistory(edited);expect(undo.present).toEqual(work);expect(redoHistory(undo).present).toEqual(next);
  expect(pushHistory(undo,updatePageNodes(work,'p',['n'],{x:60})).future).toHaveLength(0);
 });
 it('empty undo/redo and identical commits keep state',()=>{const h=createHistory(work);expect(undoHistory(h)).toBe(h);expect(redoHistory(h)).toBe(h);expect(pushHistory(h,work)).toBe(h)});
 it('limits history memory without losing the most recent changes',()=>{let h=createHistory(work);for(let x=11;x<90;x++)h=pushHistory(h,updatePageNodes(work,'p',['n'],{x}));expect(h.past).toHaveLength(60);expect(undoHistory(h).present.pages[0].nodes[0].x).toBe(88);expect(pushHistory(h,structuredClone(h.present))).toBe(h)});
});
describe('editor transform math',()=>{
 it('resizes north-west anchored to far corner and clamps positive dimensions',()=>{const n={...node,x:10,y:20,w:100,h:80};expect(resizeNode(n,'nw',20,10)).toMatchObject({x:30,y:30,w:80,h:70});expect(resizeNode(n,'w',150,0)).toMatchObject({x:86,w:24});expect(n.w).toBe(100)});
 it('resizes every handle in logical scene units',()=>{for(const d of ['n','ne','e','se','s','sw','w','nw'])expect(resizeNode(node,d,5,5).w).toBeGreaterThan(0)});
 it('resizes a rotated object along its own axes, preserving the opposite edge',()=>{const rotated={...node,x:10,y:20,w:100,h:80,rotation:90};expect(resizeNode(rotated,'e',0,20)).toMatchObject({x:0,y:30,w:120,h:80,rotation:90})});
 it('clones internal references and keeps external targets',()=>{const a={...node,id:'a',interactions:[{id:'i',event:'click',action:'show',targetId:'b'}]};const b={...node,id:'b'};const result=cloneSelectedNodes([a,b] as any,['a','b']);expect(result[0].id).not.toBe('a');expect(result[0].interactions?.[0].targetId).toBe(result[1].id);expect(result[0].x).toBe(node.x+24)});
 it('keeps the hierarchy of cloned content items',()=>{const n={...node,items:[{id:'root',title:'根节点',description:''},{id:'child',title:'子节点',description:'',parentId:'root'}]};const [copy]=cloneSelectedNodes([n],[n.id]);expect(copy.items?.[1].parentId).toBe(copy.items?.[0].id);expect(copy.items?.[0].id).not.toBe('root')});
 it('rewrites self-page navigation and command targets when duplicating a page',()=>{const n={...node,interactions:[{id:'i',event:'click' as const,action:'navigate' as const,targetId:'page-old'}],commands:[{id:'c',phrase:'回到本页',aliases:'',scope:'page' as const,enabled:true,action:'navigate',targetId:'page-old'}]};const [copy]=cloneSelectedNodes([n],[n.id],{'page-old':'page-copy'});expect(copy.interactions?.[0].targetId).toBe('page-copy');expect(copy.commands?.[0].targetId).toBe('page-copy')});
 it('rejects a tree cycle and reflects changed parent in layout',()=>{const items=[{id:'a',title:'A',description:''},{id:'b',title:'B',description:'',parentId:'a'},{id:'c',title:'C',description:'',parentId:'b'}];expect(canSetParent(items,'a','c')).toBe(false);expect(canSetParent(items,'c','a')).toBe(true);expect(graphLayout(items).find(n=>n.item.id==='c')?.depth).toBe(2);expect(graphLayout(items.map(i=>i.id==='c'?{...i,parentId:'a'}:i)).find(n=>n.item.id==='c')?.depth).toBe(1)});
 it('video motion advances, holds and restores from the media time',()=>{expect(videoPageProgress(0,10)).toBe(0);expect(videoPageProgress(5,10)).toBe(1);expect(videoPageProgress(7,10)).toBe(1);expect(videoPageProgress(10,10)).toBe(0);expect(videoPageProgress(2,0)).toBe(0)});
 it('handles malformed tree references without recursion or mutation',()=>{const items=[{id:'a',title:'A',description:'',parentId:'b'},{id:'b',title:'B',description:'',parentId:'a'},{id:'c',title:'C',description:'',parentId:'missing'}];expect(graphLayout(items)).toHaveLength(3);expect(graphLayout([])).toEqual([]);expect(canSetParent(items,'a')).toBe(true);expect(canSetParent(items,'a','missing')).toBe(true);expect(items[0].parentId).toBe('b')});
 it('provides usable dimensions and contents for each native component',()=>{for(const type of ['text','image','video','audio','shape','card','timeline','gallery','graph','map','flow','chart','bubble','button','html'] as const){const created=createNode(type);expect(created.w).toBeGreaterThan(24);expect(created.h).toBeGreaterThan(24);expect(created.name.length).toBeGreaterThan(0)}for(const type of ['image','video','audio'] as const){expect(createNode(type).src).toBeUndefined();expect(createNode(type).assetId).toBeUndefined()}});
});
describe('voice scope and normalization',()=>{
 it('normalizes punctuation and spacing',()=>expect(normalizeCommand(' 打开， 荣誉！ ')).toBe('打开荣誉'));
 it('prefers current page, excludes hidden page command, reports no match',()=>{
  const p={...work,pages:[{...work.pages[0],nodes:[{...node,commands:[{id:'a',phrase:'打开荣誉',aliases:'查看荣誉',action:'detail',enabled:true,scope:'page'}]}]},{id:'other',name:'其他',background:'#fff',nodes:[{...node,commands:[{id:'b',phrase:'去别处',aliases:'',action:'detail',enabled:true,scope:'page'}]}]}]} as Work;
  expect(findCommand(p,'p','查看 荣誉!')?.command.id).toBe('a');expect(findCommand(p,'p','去别处')).toBeUndefined();
 });
 it('keeps same-priority ambiguity visible and page commands outrank global',()=>{const commands=[{id:'a',phrase:'打开',aliases:'',action:'detail',enabled:true,scope:'global'},{id:'b',phrase:'打开',aliases:'',action:'detail',enabled:true,scope:'page'},{id:'c',phrase:'打开',aliases:'',action:'detail',enabled:true,scope:'page'}] as const;const current={...work,pages:[{...work.pages[0],nodes:[{...node,commands:[...commands]}]}]} as Work;expect(matchCommands(current,'p','打开').map(m=>m.command.id)).toEqual(['b','c']);expect(matchCommands(current,'p','!')).toEqual([])});
});
