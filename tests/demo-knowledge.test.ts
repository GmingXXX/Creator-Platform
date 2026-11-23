import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {StudioStore,Asset,Skill} from '../src/domain/types';
import {normalizeWorkspaceState} from '../src/domain/workspace-management';
import {createDraft} from '../src/domain/fixtures';
const mock=vi.hoisted(()=>({state:{} as StudioStore,fetch:vi.fn(),import:vi.fn(),describe:vi.fn(),parse:vi.fn(),put:vi.fn()}));
vi.mock('../src/domain/store',()=>({useStudio:{getState:()=>mock.state,setState:(update:Partial<StudioStore>|((state:StudioStore)=>Partial<StudioStore>))=>{mock.state={...mock.state,...(typeof update==='function'?update(mock.state):update)};}}}));
vi.mock('../src/domain/upload',()=>({importFile:(file:File)=>mock.import(file)}));
vi.mock('../src/domain/attachment-intake',()=>({describeAttachment:(file:File)=>mock.describe(file)}));
vi.mock('../src/domain/skill-package',()=>({parseSkillPackage:(data:Uint8Array,name:string)=>mock.parse(data,name)}));
vi.mock('idb-keyval',()=>({set:(...args:unknown[])=>mock.put(...args)}));
vi.mock('../src/domain/skill-store',()=>({prepareSkillSave:(_state:StudioStore,skill:Skill)=>skill}));
import {demoKnowledgePresets,matchDemoKnowledgePreset,prepareDemoKnowledge} from '../src/domain/demo-knowledge';
let serial=0;
const binding={provider:'acp' as const,fieldId:'demo-xintai',fieldName:'模拟知识',demoCatalogId:'zhichuang-20261116' as const,revision:1,updatedAt:'2026-11-18T00:00:00Z',status:'configured' as const};
beforeEach(()=>{
 vi.clearAllMocks();serial=0;vi.stubGlobal('fetch',mock.fetch);
 const draft=createDraft({workspaceId:'xintai',text:'依据知识本地场制作鱼骨时间轴'});
 mock.state={...normalizeWorkspaceState({}),activeWorkspaceId:'xintai',activeDraftId:draft.id,drafts:[draft],assets:[],skills:[],workspaceKnowledge:{xintai:binding}} as unknown as StudioStore;
 mock.fetch.mockImplementation(async()=>new Response(new Blob(['demo']),{status:200}));
 mock.import.mockImplementation(async(file:File)=>({id:`input-${++serial}`,name:file.name,src:`idb:${serial}`,preview:'',kind:file.type.startsWith('image/')?'image':'document',author:'',description:'',tags:[],createdAt:'',source:'uploaded'} as Asset));
 mock.describe.mockResolvedValue({status:'readable'});
 mock.parse.mockImplementation(async(_data:Uint8Array,name:string)=>({id:'skill-demo',name,sourcePackage:{instructions:'example rules',filename:name,files:[],entry:'SKILL.md',hasScripts:false},personal:true,metadata:{ownerAccount:'jiming',visibility:'private'}} as unknown as Skill));
 mock.put.mockResolvedValue(undefined);
});
describe('模拟知识按任务检索',()=>{
 it.each([false,true])('个人空间独立检索并记录其知识归属（旧草稿缺省空间：%s）',async(legacy)=>{
  mock.state={...mock.state,activeWorkspaceId:'personal',drafts:[{...mock.state.drafts[0],workspaceId:legacy?undefined:'personal'}],workspaceKnowledge:{...mock.state.workspaceKnowledge,personal:{...binding,fieldId:'demo-personal'}}};
  expect(await prepareDemoKnowledge(mock.state.activeDraftId)).toEqual({presetId:'timeline',fileCount:11});
  expect(mock.state.assets.every(asset=>asset.workspaceId==='personal'&&asset.knowledgeTarget?.fieldId==='demo-personal'&&asset.knowledgeTarget.state==='not-connected')).toBe(true);
  expect(mock.state.workspaceKnowledge.xintai.fieldId).toBe('demo-xintai');
 });
 it('五类提示词无需上传，映射到各自输入',()=>{
  expect(demoKnowledgePresets).toHaveLength(5);expect(demoKnowledgePresets.every(p=>!p.prompt.includes('上传'))).toBe(true);
  expect(['鱼骨时间轴','智能演示','泰山互动影片','成果卡片组件'].map(matchDemoKnowledgePreset).map(p=>p?.id)).toEqual(['timeline','presentation','story','component']);
  expect(matchDemoKnowledgePreset('问候一下')).toBeUndefined();
 });
 it('普通绑定不检索，模拟绑定按需准备11份资料而不创建作品',async()=>{
  mock.state={...mock.state,workspaceKnowledge:{xintai:{...binding,demoCatalogId:undefined}}};expect(await prepareDemoKnowledge(mock.state.activeDraftId)).toBeUndefined();expect(mock.fetch).not.toHaveBeenCalled();
  mock.state={...mock.state,workspaceKnowledge:{xintai:binding}};
  expect(await prepareDemoKnowledge(mock.state.activeDraftId)).toEqual({presetId:'timeline',fileCount:11});
  expect(mock.state.assets).toHaveLength(11);expect(mock.state.drafts[0].attachmentIds).toHaveLength(11);expect(mock.state.assets.every(a=>a.source==='builtin'&&a.package?.params.knowledgeFieldId==='demo-xintai')).toBe(true);
  expect(mock.state.skills[0].enabled).toBe(true);expect(mock.state.drafts[0].skillIds).toEqual([]);
 });
 it.each([['智能演示','presentation',7],['互动故事泰山','story',6],['成果卡片组件','component',1]])('检索%s对应素材',async(text,id,count)=>{
  mock.state={...mock.state,drafts:[{...mock.state.drafts[0],text:String(text)}]};expect(await prepareDemoKnowledge(mock.state.activeDraftId)).toEqual({presetId:id,fileCount:count});
 });
 it('并发同草稿去重，已有资料复用，保留用户附件',async()=>{
  mock.state={...mock.state,drafts:[{...mock.state.drafts[0],attachmentIds:['user-file']}]};
  const first=prepareDemoKnowledge(mock.state.activeDraftId),second=prepareDemoKnowledge(mock.state.activeDraftId);expect(first).toBe(second);await first;
  expect(mock.state.drafts[0].attachmentIds).toContain('user-file');const count=mock.import.mock.calls.length;await prepareDemoKnowledge(mock.state.activeDraftId);expect(mock.import).toHaveBeenCalledTimes(count);expect(mock.state.skills).toHaveLength(1);
 });
 it('禁用AI的缓存不能重新导入绕过',async()=>{
  await prepareDemoKnowledge(mock.state.activeDraftId);mock.state={...mock.state,assets:mock.state.assets.map((a,i)=>i? a:{...a,metadata:{...a.metadata,business:{note:'',subject:'',confirmed:false,usage:'reference',allowAi:false}}})};
  await expect(prepareDemoKnowledge(mock.state.activeDraftId)).rejects.toThrow('不可用');expect(mock.import).toHaveBeenCalledTimes(11);
 });
 it.each(['workspace','draft','binding','text','role','actor'])('异步期间%s变化不能提交到新状态',async(change)=>{
  let resume!:()=>void;mock.fetch.mockImplementationOnce(()=>new Promise<Response>(resolve=>{resume=()=>resolve(new Response('skill'));}));
  const original=mock.state,pending=prepareDemoKnowledge(mock.state.activeDraftId);
  if(change==='workspace')mock.state={...mock.state,activeWorkspaceId:'dongguan'};
  if(change==='draft')mock.state={...mock.state,activeDraftId:'other'};
  if(change==='binding')mock.state={...mock.state,workspaceKnowledge:{xintai:{...binding,revision:2}}};
  if(change==='text')mock.state={...mock.state,drafts:[{...mock.state.drafts[0],text:'更换需求'}]};
  if(change==='role')mock.state={...mock.state,workspaces:mock.state.workspaces.map(s=>s.id==='xintai'?{...s,archivedAt:'2026-11-18'}:s)};
  if(change==='actor')mock.state={...mock.state,workspaceActors:{...mock.state.workspaceActors,xintai:'other'}};
  resume();await expect(pending).rejects.toThrow();expect(mock.state.assets).toEqual(original.assets);expect(mock.state.skills).toEqual([]);
 });
 it('下载失败不留下部分资料或悄悄继续',async()=>{
  mock.fetch.mockResolvedValueOnce(new Response('skill')).mockResolvedValueOnce(new Response('unavailable',{status:404}));
  await expect(prepareDemoKnowledge(mock.state.activeDraftId)).rejects.toThrow('无法读取');expect(mock.state.assets).toHaveLength(0);
 });
 it('改绑和切换案例清理旧模拟附件但不清理用户输入或资产历史',async()=>{
  await prepareDemoKnowledge(mock.state.activeDraftId);mock.state={...mock.state,workspaceKnowledge:{xintai:{...binding,fieldId:'other',revision:2}},drafts:[{...mock.state.drafts[0],text:'智能演示',attachmentIds:[...mock.state.drafts[0].attachmentIds,'user-file']}]};
  await prepareDemoKnowledge(mock.state.activeDraftId);expect(mock.state.drafts[0].attachmentIds).toHaveLength(8);expect(mock.state.assets).toHaveLength(18);
  mock.state={...mock.state,workspaceKnowledge:{}};await prepareDemoKnowledge(mock.state.activeDraftId);expect(mock.state.drafts[0].attachmentIds).toEqual(['user-file']);
 });
 it('用户停用的配套Skill不自动重新启用',async()=>{
  await prepareDemoKnowledge(mock.state.activeDraftId);mock.state={...mock.state,skills:mock.state.skills.map(skill=>({...skill,enabled:false}))};
  await expect(prepareDemoKnowledge(mock.state.activeDraftId)).rejects.toThrow('已停用');expect(mock.state.skills[0].enabled).toBe(false);
 });
 it('空文件失败不提交，已关闭草稿立即拒绝',async()=>{
  mock.fetch.mockResolvedValueOnce(new Response(''));
  await expect(prepareDemoKnowledge(mock.state.activeDraftId)).rejects.toThrow('为空');expect(mock.state.assets).toHaveLength(0);
  await expect(prepareDemoKnowledge('missing')).rejects.toThrow('草稿已关闭');
 });

});
