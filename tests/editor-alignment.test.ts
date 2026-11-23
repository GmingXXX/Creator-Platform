import { describe, expect, it } from 'vitest';
import { alignPageSelection, createHistory, createNode, pushHistory, redoHistory, undoHistory } from '../src/features/editor/editor-domain';
import type { Work } from '../src/domain/types';

function fixture(): Work {
 return {
  id:'alignment-work',width:1920,height:1080,
  pages:[
   {id:'page',name:'主页',background:'#fff',nodes:[
    {...createNode('text'),id:'a',x:120,y:180,w:400,h:100},
    {...createNode('image'),id:'b',x:800,y:420,w:200,h:200},
    {...createNode('shape'),id:'locked',x:-100,y:-200,w:80,h:80,locked:true},
   ]},
   {id:'other',name:'另一页',background:'#fff',nodes:[{...createNode('text'),id:'c',x:40,y:80}]},
  ],
 } as Work;
}

describe('canvas selection alignment',()=>{
 it.each([
  ['left',{x:0,y:180}],
  ['center',{x:760,y:180}],
  ['top',{x:120,y:0}],
 ] as const)('aligns one component to the canvas: %s',(direction,expected)=>{
  const work=fixture();
  const result=alignPageSelection(work,'page',['a'],direction);
  expect(result.pages[0].nodes[0]).toMatchObject(expected);
  expect(work.pages[0].nodes[0]).toMatchObject({x:120,y:180});
  expect(result.pages[1]).toBe(work.pages[1]);
 });

 it('aligns multiple editable components to their shared bounds, excluding locked nodes',()=>{
  const work=fixture();
  const ids=['a','b','locked'];
  const left=alignPageSelection(work,'page',ids,'left');
  expect(left.pages[0].nodes.map(n=>n.x)).toEqual([120,120,-100]);
  const center=alignPageSelection(work,'page',ids,'center');
  expect(center.pages[0].nodes.map(n=>n.x)).toEqual([360,460,-100]);
  const top=alignPageSelection(work,'page',ids,'top');
  expect(top.pages[0].nodes.map(n=>n.y)).toEqual([180,180,-200]);
  expect(top.pages[0].nodes[2]).toBe(work.pages[0].nodes[2]);
 });

 it('uses canvas bounds when only one unlocked component remains selected',()=>{
  expect(alignPageSelection(fixture(),'page',['a','locked'],'left').pages[0].nodes[0].x).toBe(0);
 });

 it('returns unchanged work for empty, stale, locked or already aligned selections',()=>{
  const work=fixture();
  for(const ids of [[],['missing'],['locked']])expect(alignPageSelection(work,'page',ids,'left')).toBe(work);
  expect(alignPageSelection(work,'missing-page',['a'],'left')).toBe(work);
  const aligned=alignPageSelection(work,'page',['a'],'left');
  expect(alignPageSelection(aligned,'page',['a'],'left')).toBe(aligned);
 });

 it('records a multi-component action as one undoable operation',()=>{
  const work=fixture();
  const aligned=alignPageSelection(work,'page',['a','b'],'center');
  const history=pushHistory(createHistory(work),aligned);
  expect(history.past).toHaveLength(1);
  expect(undoHistory(history).present).toEqual(work);
  expect(redoHistory(undoHistory(history)).present).toEqual(aligned);
 });
});
