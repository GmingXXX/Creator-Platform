import {describe,it,expect} from 'vitest';
import {updateReferenceSelection,groupReferenceSources} from '../src/features/conversation/reference-selection';
import type {ExhibitReference} from '../src/domain/exhibit-references';
const ref=(dimension:ExhibitReference['dimension'],patch:Partial<ExhibitReference>={}):ExhibitReference=>({id:`r-${dimension}`,sourceKind:'work',sourceId:'one',sourceTitle:'来源一',sourceRevision:1,dimension,scope:'work',scopeLabel:'整个展项',note:'',status:'reference',snapshot:{kind:'exhibit',pageCount:1,nodeTypes:['text'],itemGroupSizes:[],interactions:[],visuals:{},layout:[],motion:[]},...patch});
describe('multi-dimension reference selection',()=>{
 it('groups sources while retaining independent dimensions, ranges and evidence',()=>{
  const refs=[ref('ui'),ref('interaction',{scope:'page:one'}),ref('effect',{sourceId:'two'})];
  const grouped=groupReferenceSources(refs);expect(grouped).toHaveLength(2);expect(grouped[0].references).toEqual(refs.slice(0,2));
 });
 it('adds all four dimensions atomically and leaves other sources intact',()=>{
  const existing=[ref('ui',{sourceId:'two',id:'other'})];
  const next=updateReferenceSelection(existing,['interaction','ui','content','effect'].map(d=>ref(d as ExhibitReference['dimension'])));
  expect(next).toHaveLength(5);expect(next[0]).toEqual(existing[0]);expect(existing).toHaveLength(1);
 });
 it('editing selection preserves frozen versions and actual adoption until constraints change',()=>{
  const old=ref('ui',{status:'adopted',adoptionEvidence:'已采用文字色'}),newer=ref('ui',{sourceRevision:8,snapshot:{...ref('ui').snapshot,visuals:{background:'#123456'}}});
  expect(updateReferenceSelection([old],[newer],[old.id])[0]).toEqual(old);
  const changed=updateReferenceSelection([old],[{...newer,note:'仅用于标题'}],[old.id])[0];
  expect(changed).toMatchObject({sourceRevision:1,note:'仅用于标题',status:'reference'});expect(changed.adoptionEvidence).toBeUndefined();
 });
 it('deselection removes only edited dimensions and rejects empty/duplicate/oversized batches',()=>{
  const refs=[ref('ui'),ref('interaction'),ref('effect',{sourceId:'two',id:'other'})];
  expect(updateReferenceSelection(refs,[ref('ui')],['r-ui','r-interaction']).map(r=>r.id)).toEqual(['other','r-ui']);
  expect(()=>updateReferenceSelection(refs,[],['r-ui'])).toThrow('至少');
  expect(()=>updateReferenceSelection(refs,[ref('ui')])).toThrow('已添加');
  expect(()=>updateReferenceSelection([],Array.from({length:13},(_,i)=>ref('ui',{id:`${i}`,sourceId:`${i}`})))).toThrow('12');
 });
});
