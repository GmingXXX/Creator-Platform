import {describe,it,expect,beforeEach} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {applyCreationReferences} from '../src/domain/reference-application';
import {createExhibitReference,mergeReferences,referenceContext,validateReferences,referenceConflicts,appendReferenceToDraft,referencesFromPrompt,referenceHasScopeConstraint} from '../src/domain/exhibit-references';

const seed=()=>{
 const state=createInitialData(), original=state.works[0];
 const work={...original,id:'ref-source',workspaceId:'personal',revision:7,title:'参考展项',pages:[{id:'source-page',name:'首页',background:'#102030',nodes:[{...original.pages[0].nodes[0],id:'source-node',name:'标题',type:'text' as const,content:'未公开客户营业额987654万元',src:'https://private.invalid/photo.jpg',fontSize:42,color:'#fafafa',radius:12,x:40,y:30,w:400,h:100,interactions:[{id:'i',event:'click' as const,action:'navigate' as const,targetId:'other-page'}]},{...original.pages[0].nodes[0],id:'other-node',name:'其他区域',fontSize:80,color:'#123456',content:'另一条私人事实',x:500,y:500,w:300,h:100}]}]};
 return {...state,works:[work,...state.works.filter(w=>w.id!==original.id)],activeWorkspaceId:'personal'};
};
describe('multiple exhibit references',()=>{
 beforeEach(()=>useStudio.setState(seed()));
 it('captures only structural patterns and scoped visual tokens, never client facts or media',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui',scope:'node:source-page:source-node'});
  expect(ref.snapshot.visuals.fontSize).toBe(42);
  expect(ref.snapshot.layout).toHaveLength(1);
  const text=JSON.stringify(referenceContext([ref]));
  expect(text).not.toContain('987654');expect(text).not.toContain('private.invalid');expect(text).not.toContain('另一条');
  expect(text).not.toContain('interactions');expect(ref.status).toBe('reference');
 });
 it('keeps same source with different dimensions and deduplicates identical scope',()=>{
  const state=seed(),ui=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  const interaction=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'interaction'});
  expect(mergeReferences([ui],ui)).toEqual([ui]);
  expect(mergeReferences([ui],interaction)).toHaveLength(2);
  expect(JSON.stringify(referenceContext([interaction]))).not.toContain('visuals');
 });
 it('rejects another space, recycled source, unknown local scope and changed membership',()=>{
  const state=seed(),input={sourceKind:'work' as const,sourceId:'ref-source',dimension:'ui' as const};
  expect(()=>createExhibitReference(state,'xintai',input)).toThrow();
  expect(()=>createExhibitReference(state,'personal',{...input,scope:'node:source-page:missing'})).toThrow();
  const ref=createExhibitReference(state,'personal',input);
  expect(()=>validateReferences([ref],{...state,works:state.works.map(w=>({...w,deletedAt:'now'}))},'personal')).toThrow();
  expect(()=>validateReferences([ref],state,'does-not-exist')).toThrow();
 });
 it('pins old snapshot version without adopting later source edits',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  const changed={...state,works:state.works.map(w=>({...w,revision:w.revision+1,pages:w.pages.map(p=>({...p,background:'#ff0000'}))}))};
  const validated=validateReferences([ref],changed,'personal');
  expect(validated[0].sourceRevision).toBe(7);expect(validated[0].snapshot.visuals.background).toBe('#102030');
 });
 it('detects competing sources in the same dimension while keeping distinct dimensions separate',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  expect(referenceConflicts([ref,{...ref,id:'other',sourceId:'other'}])).toHaveLength(1);
  expect(referenceConflicts([ref,{...ref,id:'other',dimension:'interaction'}])).toEqual([]);
 });
 it('appends to an existing draft without losing prompt, attachments or earlier references',()=>{
  const state=useStudio.getState(),draft=state.drafts.find(d=>d.id===state.activeDraftId)!;
  useStudio.setState({drafts:state.drafts.map(d=>d.id===draft.id?{...d,text:'当前客户的新需求',attachmentIds:['kept-file']}:d)});
  appendReferenceToDraft('work','ref-source');
  appendReferenceToDraft('work','ref-source','ui');
  const current=useStudio.getState(),next=current.drafts.find(d=>d.id===current.activeDraftId)!;
  expect(next.id).toBe(draft.id);expect(next.text).toBe('当前客户的新需求');expect(next.attachmentIds).toEqual(['kept-file']);expect(next.references).toHaveLength(2);
 });
 it('rejects forged snapshots with arbitrary strings and oversized inputs',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  expect(()=>validateReferences([{...ref,snapshot:{...ref.snapshot,visuals:{text:'private text'}}}],state,'personal')).toThrow();
  expect(()=>validateReferences([{...ref,note:'x'.repeat(1001)}],state,'personal')).toThrow();
 });
});

describe('explicit natural-language references',()=>{
 it('finds distinct UI and interaction sources by exact available title',()=>{
  const state=seed();const second={...state.works[0],id:'second',title:'另一展项'};
  const refs=referencesFromPrompt('交互参考「参考展项」，UI参考「另一展项」，内容采用当前客户资料',{...state,works:[...state.works,second]},'personal',[]);
  expect(refs.map(r=>[r.sourceId,r.dimension])).toEqual([['ref-source','interaction'],['second','ui']]);
  expect(referenceContext(refs)[0].dimension).toBe('interaction');
  expect(referenceContext(refs)[0].referenceId).toBe(refs[0].id);
 });
 it('asks for selection when a named source is ambiguous and rejects unavailable names',()=>{
  const state=seed();
  expect(()=>referencesFromPrompt('UI参考「参考展项」',{...state,works:[...state.works,{...state.works[0],id:'duplicate'}]},'personal',[])).toThrow(/同名/);
  expect(()=>referencesFromPrompt('交互参考「不存在的展项」',state,'personal',[])).toThrow(/未找到/);
 });
 it('does not resolve ordinary descriptive text or silently drop existing references',()=>{
  const state=seed(),existing=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  expect(referencesFromPrompt('制作一个科技风时间轴',state,'personal',[existing])).toEqual([existing]);
 });
 it('rejects a public template carrying an unavailable private dependency',()=>{
  const state=seed(),privateWork={...state.works[0],pages:state.works[0].pages.map(p=>({...p,backgroundAssetId:'private-asset',backgroundImage:'idb:private'}))};
  const guarded={...state,templates:[{id:'guarded',title:'公开模板',type:privateWork.type,author:'作者',tags:[],likes:0,uses:0,work:privateWork}]};
  expect(()=>createExhibitReference(guarded,'personal',{sourceKind:'template',sourceId:'guarded',dimension:'ui'})).toThrow(/依赖/);
 });
});

describe('reference validity and lifecycle boundaries',()=>{
 it('keeps approved evidence distinct from candidates and rejects unsupported stored payloads',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'effect'});
  expect(validateReferences(undefined,state,'personal')).toEqual([]);
  expect(()=>validateReferences([{...ref,status:'adopted'}],state,'personal')).toThrow(/记录/);
  expect(validateReferences([{...ref,status:'adopted',adoptionEvidence:'实际采用淡入动效'}],state,'personal')[0].adoptionEvidence).toBe('实际采用淡入动效');
  expect(()=>validateReferences([ref,ref],state,'personal')).toThrow(/重复/);
  expect(()=>validateReferences([{...ref,scope:'unknown'}],state,'personal')).toThrow(/范围/);
  expect(()=>validateReferences([{...ref,snapshot:{...ref.snapshot,layout:[{type:'text',x:2,y:0,w:1,h:1}]}}],state,'personal')).toThrow(/布局/);
  expect(()=>validateReferences([{...ref,snapshot:{...ref.snapshot,motion:['bad script()']}}],state,'personal')).toThrow(/动效/);
 });
 it('bounds the reference list and accepts a published safe template',()=>{
  const state=seed(),work=state.works[0],template={id:'safe',title:'方法模板',type:work.type,author:'作者',tags:[],likes:0,uses:0,work};
  const current={...state,templates:[template]};
  const ref=createExhibitReference(current,'personal',{sourceKind:'template',sourceId:'safe',dimension:'content',scope:'page:source-page'});
  expect(referenceContext([ref])[0].patterns).toHaveProperty('itemGroupSizes');
  expect(referenceContext()).toEqual([]);
  const full=Array.from({length:12},(_,i)=>({...ref,id:`different-${i}`,sourceId:`different-${i}`}));
  expect(()=>mergeReferences(full,ref)).toThrow(/12/);
  expect(()=>validateReferences([...full,ref],current,'personal')).toThrow(/数量/);
  expect(()=>createExhibitReference(current,'personal',{sourceKind:'template',sourceId:'safe',dimension:'ui',note:'x'.repeat(1001)})).toThrow(/过长/);
 });
 it('preserves disabled source permissions and initializes a new empty draft when needed',()=>{
  const state=seed();
  useStudio.setState({...state,drafts:[],activeDraftId:'missing'});
  const added=appendReferenceToDraft('work','ref-source');
  expect(added.references).toHaveLength(1);expect(added.text).toContain('参考展项');
  const changed={...state,works:state.works.map(w=>w.id==='ref-source'?{...w,workspaceId:'xintai'}:w),workspaceActors:{...state.workspaceActors,xintai:'viewer'},workspaceMembers:{...state.workspaceMembers,xintai:[{id:'viewer',name:'只读',account:'viewer',role:'viewer' as const,status:'member' as const}]}};
  expect(()=>createExhibitReference(changed,'xintai',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'})).toThrow(/只读/);
 });
 it('resolves a trailing dimension and retains separately scoped existing references',()=>{
  const state=seed(),existing=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui',scope:'node:source-page:source-node'});
  const refs=referencesFromPrompt('参考「参考展项」的交互',state,'personal',[existing]);
  expect(refs.map(r=>r.dimension)).toEqual(['ui','interaction']);
 });
});

describe('native story and shot references',()=>{
 it('extracts only the selected story node branching shape without plot or choice labels',()=>{
  const state=seed(),work={...state.works[0],id:'story',kind:'story' as const,pages:[],storyNodes:[{id:'n1',type:'scene',x:0,y:0,title:'第一个',text:'客户秘密剧情'},{id:'n2',type:'scene',x:200,y:0,title:'第二个',text:'另一个剧情'}],storyEdges:[{id:'edge',source:'n1',target:'n2',label:'未公开故事选项'}]};
  const ref=createExhibitReference({...state,works:[work]},'personal',{sourceKind:'work',sourceId:'story',dimension:'interaction',scope:'story:n1'});
  expect(ref.snapshot.pageCount).toBe(1);expect(ref.snapshot.interactions).toHaveLength(1);
  expect(JSON.stringify(referenceContext([ref]))).not.toContain('未公开故事选项');expect(JSON.stringify(ref.snapshot)).not.toContain('客户秘密剧情');
 });
 it('extracts selected video shot structure without media or narration',()=>{
  const state=seed(),work={...state.works[0],id:'video',kind:'video' as const,pages:[],shots:[{id:'s1',title:'第一段',narration:'私人讲述',duration:10,src:'https://private.invalid/video.mp4'},{id:'s2',title:'第二段',narration:'另一讲述',duration:20,src:'https://private.invalid/video2.mp4'}]};
  const ref=createExhibitReference({...state,works:[work]},'personal',{sourceKind:'work',sourceId:'video',dimension:'content',scope:'shot:s1'});
  expect(ref.snapshot.pageCount).toBe(1);expect(ref.snapshot.nodeTypes).toContain('video');expect(JSON.stringify(ref.snapshot)).not.toContain('private.invalid');
 });
});

describe('visual extraction through generation application',()=>{
 it('uses the largest visible heading instead of shrinking all text to an eyebrow label',()=>{
  const state=seed(),base=state.works[0],node=base.pages[0].nodes[0];
  const work={...base,pages:[{...base.pages[0],nodes:[{...node,id:'eyebrow',fontSize:22,color:'#999999'},{...node,id:'heading',fontSize:66,color:'#202020'},{...node,id:'body',fontSize:27},{...node,id:'accent',type:'button' as const,background:'transparent',color:'#bada55'}]}]};
  const ref=createExhibitReference({...state,works:[work]},'personal',{sourceKind:'work',sourceId:work.id,dimension:'ui'});
  expect(ref.snapshot.visuals.fontSize).toBe(66);expect(ref.snapshot.visuals.text).toBe('#202020');expect(ref.snapshot.visuals.accent).toBe('#bada55');
  const output=applyCreationReferences(work,[ref]);
  expect(output.pages[0].nodes.find(n=>n.id==='body')?.fontSize).toBe(27);
  expect(output.pages[0].nodes.find(n=>n.id==='heading')?.fontSize).toBe(66);
  expect(output.pages[0].nodes.find(n=>n.id==='accent')?.color).toBe('#bada55');
 });
});

describe('reference scope and priority guidance',()=>{
 it('keeps freeform local, exclusion and priority notes out of automatic whole-work application',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  expect(referenceHasScopeConstraint(ref)).toBe(false);
  for(const note of ['仅应用到主内容区','不要修改标题','UI 以另一展项为主','保留现有品牌色','local area only']){
   const limited={...ref,note};
   expect(referenceHasScopeConstraint(limited)).toBe(true);
   expect(referenceConflicts([limited]).join('')).toContain('不自动整项套用');
  }
  expect(referenceHasScopeConstraint({...ref,scope:'node:source-page:source-node'})).toBe(true);
 });
 it('does not present a text priority as resolved selection among competing references',()=>{
  const state=seed(),ref=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  const messages=referenceConflicts([ref,{...ref,id:'second',sourceId:'second',note:'以此为主'}]);
  expect(messages.join('')).toContain('不自动猜测主次');
  expect(messages.join('')).toContain('仅保留一项');
 });
});

describe('natural-language reference restrictions',()=>{
 it('keeps extra instructions on a named reference as note, preventing silent whole-work application',()=>{
  const state=seed();
  const refs=referencesFromPrompt('UI参考「参考展项」仅应用到主内容区',state,'personal',[]);
  expect(refs[0].note).toContain('仅应用到主内容区');
  expect(referenceHasScopeConstraint(refs[0])).toBe(true);
  const existing=createExhibitReference(state,'personal',{sourceKind:'work',sourceId:'ref-source',dimension:'ui'});
  expect(referencesFromPrompt('UI参考「参考展项」仅应用到主内容区',state,'personal',[existing])[0].note).toContain('仅应用到主内容区');
  expect(referencesFromPrompt('UI参考「参考展项」',state,'personal',[])[0].note).toBe('');
 });
});
