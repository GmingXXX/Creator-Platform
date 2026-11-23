import {describe,it,expect} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {presentationDraftSignature,findPresentationDraft} from '../src/features/studios/presentation-draft-recovery';
const input={title:'演示',topic:'需求',sections:[{title:'章节',bullets:['事实'],narration:'讲解',layout:'bullets' as const}],sources:[],styleId:'',model:'deepseek-flash',resolution:'1920×1080',width:1920,height:1080,audience:'参观者',usedSkills:[]};
const work=()=>({...createSceneWork({title:'演示',kind:'presentation',type:'媒体叙事型',styleId:'',width:1920,height:1080,blank:true}),workspaceId:'personal',creationPackage:{id:'pkg',version:'1',prompt:'',files:[],skillIds:[],complete:true,params:{presentationCreationRequestKey:'run',presentationDraftSignature:'sig'}}});
describe('presentation draft recovery',()=>{
 it('ignores review-only IDs but invalidates edited content, style and sources',()=>{
  const sig=presentationDraftSignature(input);
  expect(presentationDraftSignature({...input,sections:input.sections.map(s=>({...s,reviewId:'restored'}))})).toBe(sig);
  expect(presentationDraftSignature({...input,title:'新演示'})).not.toBe(sig);
  expect(presentationDraftSignature({...input,sections:input.sections.map(s=>({...s,narration:'变更'}))})).not.toBe(sig);
  expect(presentationDraftSignature({...input,styleId:'new'})).not.toBe(sig);
  expect(presentationDraftSignature({...input,sources:[{assetId:'new',text:'新资料',status:'已解析'}]})).not.toBe(sig);
 });
 it('reuses only the matching live editable work from the originating run and space',()=>{
  const draft=work(),checkpoint={draftWorkId:draft.id,draftSignature:'sig'};
  expect(findPresentationDraft(checkpoint,[draft],'personal','run','sig',true)).toBe(draft);
  for(const invalid of [{...draft,deletedAt:'today'},{...draft,archived:true},{...draft,workspaceId:'other'},{...draft,kind:'story' as const}])expect(findPresentationDraft(checkpoint,[invalid],'personal','run','sig',true)).toBeUndefined();
  expect(findPresentationDraft(checkpoint,[draft],'personal','different-run','sig',true)).toBeUndefined();
  expect(findPresentationDraft(checkpoint,[draft],'personal','run','changed',true)).toBeUndefined();
  expect(findPresentationDraft(checkpoint,[draft],'personal','run','sig',false)).toBeUndefined();
 });
});
