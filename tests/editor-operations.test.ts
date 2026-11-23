import {describe,expect,it} from 'vitest';
import type {Work,NodeKind} from '../src/domain/types';
import {createNode,createHistory,pushHistory,undoHistory} from '../src/features/editor/editor-domain';
import {deletePageSelection,reorderPageLayer} from '../src/features/editor/editor-operations';
function fixture(){return {id:'work',pages:[{id:'p',name:'Page',background:'#fff',nodes:['text','html','image','timeline'].map((type,i)=>({...createNode(type as NodeKind),id:`n${i}`,locked:i===3}))},{id:'other',nodes:[]}]} as Work;}
describe('editor layer operations',()=>{
 it('deletes selected native and HTML containers without deleting locked or unrelated nodes',()=>{const w=fixture();const next=deletePageSelection(w,'p',['n0','n1','n3','stale']);expect(next.pages[0].nodes.map(n=>n.id)).toEqual(['n2','n3']);expect(w.pages[0].nodes).toHaveLength(4);expect(next.pages[1]).toBe(w.pages[1]);});
 it('keeps no-op deletions out of history',()=>{const w=fixture();expect(deletePageSelection(w,'p',['n3','missing'])).toBe(w);expect(deletePageSelection(w,'missing',['n0'])).toBe(w);});
 it('maps visual above and below drops to back-to-front storage',()=>{const w=fixture();expect(reorderPageLayer(w,'p','n0','n2','above').pages[0].nodes.map(n=>n.id)).toEqual(['n1','n2','n0','n3']);expect(reorderPageLayer(w,'p','n2','n0','below').pages[0].nodes.map(n=>n.id)).toEqual(['n2','n0','n1','n3']);expect(w.pages[0].nodes.map(n=>n.id)).toEqual(['n0','n1','n2','n3']);});
 it('rejects self, missing, locked and unchanged drops',()=>{const w=fixture();for(const args of [['n0','n0','above'],['n3','n0','above'],['none','n0','above'],['n0','none','above'],['n0','n1','below']] as const)expect(reorderPageLayer(w,'p',...args)).toBe(w);expect(reorderPageLayer(w,'missing','n0','n1','above')).toBe(w);});
 it('undo restores exactly the previous stacking order',()=>{const w=fixture();const next=reorderPageLayer(w,'p','n0','n2','above');const h=pushHistory(createHistory(w),next);expect(h.past).toHaveLength(1);expect(undoHistory(h).present).toEqual(w);});
});
