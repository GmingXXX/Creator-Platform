import {describe,expect,it} from 'vitest';
import {findComposerShortcut,removeComposerShortcut,composerShortcutChoices} from '../src/features/home/composer-shortcuts';
import type {Asset,ComposerDraft,Skill} from '../src/domain/types';
const draft:ComposerDraft={id:'draft',text:'',model:'demo',styleId:'',skillIds:[],attachmentIds:[],updatedAt:''};
const skill=(id:string,patch:Partial<Skill>={}):Skill=>({id,name:id,description:'时间轴制作方法',input:'资料',steps:['整理资料'],category:'方法',styleId:'',previewType:'text',author:'纪鸣',version:'1',personal:true,...patch});
const asset=(id:string,patch:Partial<Asset>={}):Asset=>({id,name:id,description:'企业资料',kind:'image',src:'/image.png',preview:'/image.png',tags:[],author:'纪鸣',createdAt:'',source:'uploaded',...patch});
const access={workspaces:[],workspaceMembers:{},workspaceActors:{},activeWorkspaceId:'personal'};
describe('composer contextual shortcuts',()=>{
 it('detects tokens at the cursor and preserves the surrounding prompt',()=>{
  const text='制作 /时间轴 并保留原文',token=findComposerShortcut(text,7)!;
  expect(token).toEqual({kind:'skill',start:3,end:7,query:'时间轴'});
  expect(removeComposerShortcut(text,token)).toEqual({text:'制作  并保留原文',caret:3});
  expect(findComposerShortcut('@',1)?.kind).toBe('asset');
 });
 it('does not interpret URLs, emails, selected text, or invalid caret positions as commands',()=>{
  for(const text of ['https://example.com','mail@example.com','//folder','/技能 后续'])expect(findComposerShortcut(text,text.length)).toBeUndefined();
  expect(findComposerShortcut('/技能',3,1)).toBeUndefined();
  expect(findComposerShortcut('/',-1)).toBeUndefined();
 });
 it('filters private skill access, retains disabled reasons, and never modifies input data',()=>{
  const skills=[skill('mine'),skill('off',{enabled:false}),skill('invalid',{steps:[]}),skill('foreign',{metadata:{ownerAccount:'other'}}),skill('shared',{public:true,personal:false})];
  const before=structuredClone(skills),choices=composerShortcutChoices({skills,assets:[],access,draft},'skill','');
  expect(choices.map(item=>item.id)).toEqual(['mine','off','invalid','shared']);
  expect(choices.find(item=>item.id==='off')?.disabledReason).toBe('已停用');
  expect(choices.find(item=>item.id==='invalid')?.disabledReason).toBe('技能信息不完整');
  expect(skills).toEqual(before);
 });
 it('limits materials to visible active resources and validates AI consent and dependencies',()=>{
  const assets=[asset('mine'),asset('foreign',{workspaceId:'other'}),asset('archived',{archived:true}),asset('deleted',{deletedAt:'today'}),asset('denied',{metadata:{business:{note:'',subject:'',confirmed:true,usage:'reference',allowAi:false}}}),asset('work',{sourceWorkId:'work'}),asset('shared',{public:true,workspaceId:'other'})];
  const choices=composerShortcutChoices({skills:[],assets,access,draft},'asset','');
  expect(choices.map(item=>item.id)).toEqual(['mine','denied','shared','browse-references']);
  expect(choices.find(item=>item.id==='denied')?.disabledReason).toBeTruthy();
  const pack=asset('dependent',{package:{files:[{name:'private',type:'image',src:'/private.png'}]} as Asset['package']});
  expect(composerShortcutChoices({skills:[],assets:[pack,asset('private',{src:'/private.png',workspaceId:'other'})],access,draft},'asset','dependent')[0].disabledReason).toBeTruthy();
 });
 it('searches names and descriptions and prevents duplicate selection',()=>{
  expect(composerShortcutChoices({skills:[skill('one')],assets:[],access,draft},'skill','无匹配')).toEqual([]);
  expect(composerShortcutChoices({skills:[skill('one')],assets:[],access,draft:{...draft,skillIds:['one']}},'skill','时间轴')[0].disabledReason).toBe('已添加');
  expect(composerShortcutChoices({skills:[],assets:[asset('one')],access,draft:{...draft,attachmentIds:['one']}},'asset','企业')[0].disabledReason).toBe('已添加');
 });
});
