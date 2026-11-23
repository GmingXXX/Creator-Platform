import {describe,it,expect} from 'vitest';
import {referenceSourceChoices,visibleReferenceChoices,editorMaterialChoices} from '../src/features/conversation/reference-source-choices';
import type {Asset,Work,Template} from '../src/domain/types';
const work=(id:string,workspaceId='personal',deletedAt?:string)=>({id,title:id,kind:'exhibit',workspaceId,deletedAt,pages:[]}) as Work;
const asset=(id:string,extra:Partial<Asset>={})=>({id,name:id,kind:'image',src:'/image.png',source:'uploaded',tags:[],description:'',workspaceId:'space-a',...extra}) as Asset;
describe('reference and material browser',()=>{
 it('lists current-space works and live templates without deleted/private cross-space works',()=>{
  const choices=referenceSourceChoices([work('current','space-a'),work('other','space-b'),work('deleted','space-a','now')],[{id:'template',title:'社区模板',work:work('template-work')} as Template,{id:'gone',title:'gone',work:work('gone','personal','now')} as Template],'space-a');
  expect(choices.map(choice=>choice.value)).toEqual(['work:current','template:template']);
 });
 it('searches source and type labels while retaining the selected card',()=>{
  const choices=referenceSourceChoices([work('current')],[{id:'template',title:'鱼骨时间轴',work:work('template-work')} as Template],'personal');
  expect(visibleReferenceChoices(choices,'鱼骨','work:current').map(choice=>choice.value)).toEqual(['work:current','template:template']);
  expect(visibleReferenceChoices(choices,'社区','').map(choice=>choice.value)).toEqual(['template:template']);
 });
 it('includes scoped preset assets in current space but keeps global builtin assets in the full library',()=>{
  const list=[asset('upload'),asset('scoped',{source:'builtin'}),asset('global',{source:'builtin',workspaceId:undefined}),asset('other',{workspaceId:'space-b'}),asset('public',{public:true,workspaceId:'space-b'}),asset('deleted',{deletedAt:'now'}),asset('archived',{archived:true})];
  expect(editorMaterialChoices(list,'space-a','space','').map(item=>item.id)).toEqual(['upload','scoped']);
  expect(editorMaterialChoices(list,'space-a','community','').map(item=>item.id)).toEqual(['public']);
  expect(list).toHaveLength(7);
 });
});
