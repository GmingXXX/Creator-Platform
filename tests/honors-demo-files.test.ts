import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import JSZip from 'jszip';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {demoPresetData} from '../src/features/home/demo-preset-data';
import {demoKnowledgePresets,matchDemoKnowledgePreset} from '../src/domain/demo-knowledge-catalog';
import {parseSkillPackage} from '../src/domain/skill-package';
import {extractDocumentText} from '../src/domain/document-intake';
import {prepareDemoKnowledge} from '../src/domain/demo-knowledge';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
const io=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}));
vi.mock('../src/domain/upload',()=>({importFile:io.load}));
vi.mock('../src/domain/attachment-intake',()=>({describeAttachment:vi.fn(async()=>({status:'已解析正文'}))}));
vi.mock('idb-keyval',()=>({set:io.save}));
const prompt='帮我把公司的荣誉资质和技术案例做成一个可演示的展项，内容从当前绑定的知识本地场获取。';
const readPublic=(url:string)=>readFile(resolve('public',url.replace(/^\//,'')));
beforeEach(()=>{
 vi.clearAllMocks();useStudio.setState(createInitialData());io.save.mockResolvedValue(undefined);
 let count=0;
 io.load.mockImplementation(async(file:File)=>({id:`honors-input-${++count}`,name:file.name,src:`idb:honors-${count}`,preview:'',kind:'document',tags:[],author:'纪鸣',createdAt:'now',source:'uploaded'}));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(new Uint8Array(await readPublic(decodeURIComponent(url))))));
});
afterEach(()=>vi.unstubAllGlobals());
describe('荣誉与案例演示输入',()=>{
 it('adds an ambiguous fifth prompt and preserves the first four preset ids',()=>{
  expect(demoPresetData.map(p=>p.id)).toEqual(['timeline','presentation','story','component','honors']);
  const preset=demoPresetData.find(p=>p.title==='荣誉与案例展示');
  expect(preset?.prompt).toBe(prompt);
  expect(preset?.files).toHaveLength(2);
 });
 it.each(['','\n已确认：制作智能演示，采用讲解形式。','\n已确认：制作PPT。','\n已确认：采用可点击卡片交互页面。'])('keeps honors sources after clarification %s',suffix=>{
  const preset=matchDemoKnowledgePreset(prompt+suffix);
  expect(preset?.id).toBe('honors');
  expect(preset?.files.map(f=>f.name)).toEqual(['星澜智造_荣誉资质.md','星澜智造_技术案例.md']);
  expect(preset?.files.some(f=>f.name.includes('智能演示大纲'))).toBe(false);
  expect(matchDemoKnowledgePreset('制作企业智能演示')?.id).toBe('presentation');
 });
 it('ships parseable fictional sources and a valid output-neutral Skill ZIP',async()=>{
  const preset=demoKnowledgePresets.find(p=>p.id==='honors');expect(preset).toBeDefined();
  for(const [index,file] of preset!.files.entries()){
   const bytes=await readPublic(file.url);
   const text=await extractDocumentText(new File([bytes],file.name,{type:file.mime}));
   expect(text).toContain('全部为虚构演示');
   expect(text).toContain('不代表真实认证');
   expect(text.match(index===0?/^## H\d{3}/gm:/^## C\d{3}/gm)).toHaveLength(6);
  }
  const bytes=await readPublic(preset!.skill.url);
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  expect(Object.keys(zip.files)).toEqual(['SKILL.md']);
  const skill=await parseSkillPackage(bytes,preset!.skill.name);
  expect(skill.sourcePackage.hasScripts).toBe(false);
  expect(skill.sourcePackage.instructions).toContain('交互展项或智能演示');
  expect(skill.sourcePackage.instructions).toContain('不预设输出类型');
 });
 it('retrieves these same two sources through the bound demo field after choosing presentation',async()=>{
  const state=useStudio.getState();
  state.bindWorkspaceKnowledge('xintai',{fieldId:'demo-honors',fieldName:'荣誉案例模拟知识场',demoCatalogId:'zhichuang-20261116'});
  state.newDraft({workspaceId:'xintai',text:prompt+'\n已确认：制作智能演示。'});
  const draftId=useStudio.getState().activeDraftId;
  await expect(prepareDemoKnowledge(draftId)).resolves.toEqual({presetId:'honors',fileCount:2});
  const current=useStudio.getState(),draft=current.drafts.find(d=>d.id===draftId)!;
  expect(draft.attachmentIds).toHaveLength(2);
  const assets=current.assets.filter(a=>draft.attachmentIds.includes(a.id));
  expect(assets.map(a=>a.name)).toEqual(['星澜智造_荣誉资质.md','星澜智造_技术案例.md']);
  expect(assets.every(a=>a.package?.params.knowledgeFieldId==='demo-honors'&&a.package.params.knowledgeCase==='honors')).toBe(true);
 });
 it('does not retrieve fictional sources for a normal real-world binding',async()=>{
  const state=useStudio.getState();
  state.bindWorkspaceKnowledge('xintai',{fieldId:'real-honors',fieldName:'实际资料场'});
  state.newDraft({workspaceId:'xintai',text:prompt});
  expect(await prepareDemoKnowledge(useStudio.getState().activeDraftId)).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
 });
});
