import {afterEach, describe, expect, it, vi} from 'vitest';
import {createSceneWork, systems} from '../src/domain/scenes';
import {sceneThemeForBackground} from '../src/features/editor/editor-domain';
import {normalizeEditorView, readEditorView, writeEditorView, sameWorkContent, selectionTarget} from '../src/features/editor/editor-session';

const work=createSceneWork({title:'上下文验证',type:'时间演进型',width:1920,height:1080});
describe('editor context and persistence',()=>{
 it('restores only valid selected nodes and view values',()=>{
  const view=normalizeEditorView(work,{pageId:work.pages[0].id,selected:[work.pages[0].nodes[1].id,'removed'],zoom:.65,pan:{x:72,y:-31},tab:'AI'});
  expect(view.selected).toEqual([work.pages[0].nodes[1].id]);expect(view.zoom).toBe(.65);expect(view.pan).toEqual({x:72,y:-31});expect(view.tab).toBe('AI');
 });
 it('falls back safely after a page is removed or stored view is invalid',()=>{
  const view=normalizeEditorView(work,{pageId:'removed',selected:['removed'],zoom:NaN,pan:{x:Infinity,y:'bad'},tab:'unknown'});
  expect(view.pageId).toBe(work.pages[0].id);expect(view.selected).toEqual([]);expect(view.zoom).toBe(.4);expect(view.pan).toEqual({x:0,y:0});expect(view.tab).toBe('属性');
 });
 it('uses selected component otherwise current page without widening a multi-selection silently',()=>{
  const page=work.pages[0];expect(selectionTarget(page.id,[page.nodes[0].id])).toEqual({scope:'node',pageId:page.id,nodeId:page.nodes[0].id});
  expect(selectionTarget(page.id,[])).toEqual({scope:'page',pageId:page.id});
  expect(selectionTarget(page.id,[page.nodes[0].id,page.nodes[1].id])).toEqual({scope:'page',pageId:page.id});
 });
 it('avoids extra saves for metadata-only updates but detects actual edits',()=>{
  expect(sameWorkContent(work,{...work,revision:work.revision+1,updatedAt:'later'})).toBe(true);
  expect(sameWorkContent(work,{...work,title:'已修改'})).toBe(false);
  expect(sameWorkContent(work,{...work,pages:work.pages.map(p=>({...p,background:'#ffeedd'}))})).toBe(false);
 });
});

describe('rendered scene theme',()=>{
 it('uses actual page background without any design-system binding',()=>{
  for(const system of systems){
   const expected=['government','jewelry','culture','finance'].includes(system.id)?'light':'dark';
   expect(sceneThemeForBackground(system.background)).toBe(expected);
   const scene=createSceneWork({title:'无绑定浅色作品',type:'时间演进型',width:1920,height:1080,styleId:system.id});
   expect(sceneThemeForBackground({...scene,styleId:''}.pages[0].background)).toBe(expected);
  }
 });
 it('handles short hex and RGB backgrounds and has a stable unknown fallback',()=>{
  expect(sceneThemeForBackground('#fff')).toBe('light');expect(sceneThemeForBackground('#000')).toBe('dark');
  expect(sceneThemeForBackground('rgb(246, 242, 235)')).toBe('light');expect(sceneThemeForBackground('rgba(13, 27, 42, 1)')).toBe('dark');
  expect(sceneThemeForBackground('transparent')).toBe('dark');
 });
});

describe('editor session storage',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('saves only editing view and restores it for the same work',()=>{
  const values=new Map<string,string>();vi.stubGlobal('sessionStorage',{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)});
  expect(readEditorView(work)).toBeUndefined();const view=normalizeEditorView(work,{zoom:.7,tab:'AI'});writeEditorView(work.id,view);expect(readEditorView(work)).toEqual(view);expect([...values.values()][0]).not.toContain('backgroundImage');
 });
 it('keeps editing usable with unavailable or invalid session storage',()=>{
  vi.stubGlobal('sessionStorage',{getItem:()=>'{',setItem:()=>{throw new Error('blocked')}});
  expect(readEditorView(work)).toBeUndefined();expect(()=>writeEditorView(work.id,normalizeEditorView(work,{}))).not.toThrow();
 });
});
