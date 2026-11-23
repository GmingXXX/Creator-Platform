import {beforeEach,describe,expect,it,vi} from 'vitest';
import {aiChat} from '../src/domain/ai-client';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {createSceneWork} from '../src/domain/scenes';
import {buildPresentationWork,generatePresentationPlan} from '../src/domain/presentation-generation';
import {buildStoryWork,generateStoryPlan,parseStoryPlan} from '../src/domain/story-generation';
import type {ExhibitReference} from '../src/domain/exhibit-references';

vi.mock('../src/domain/ai-client',()=>({aiChat:vi.fn()}));
const source=createSceneWork({title:'参考展项',type:'卡片浏览型',width:1920,height:1080,styleId:'',blank:true});
const refs=():ExhibitReference[]=>[
 {id:'ref-interaction',sourceKind:'template',sourceId:'template-ref',sourceTitle:'参考展项',sourceRevision:source.revision,dimension:'interaction',scope:'work',scopeLabel:'整个作品',note:'保留分类浏览',status:'reference',snapshot:{kind:'exhibit',pageCount:1,nodeTypes:['card'],itemGroupSizes:[3],interactions:[{event:'click',action:'detail',targetType:'card'}],visuals:{},layout:[],motion:[]}},
 {id:'ref-ui',sourceKind:'template',sourceId:'template-ui',sourceTitle:'视觉参考展项',sourceRevision:source.revision,dimension:'ui',scope:'work',scopeLabel:'整个作品',note:'借鉴卡片外观',status:'reference',snapshot:{kind:'exhibit',pageCount:1,nodeTypes:['card'],itemGroupSizes:[],interactions:[],visuals:{background:'#ffffff',accent:'#123456'},layout:[{type:'card',x:0.1,y:0.2,w:0.4,h:0.5}],motion:[]}},
];
const presentation={title:'当前客户介绍',sections:[{title:'业务',narration:'当前客户资料',bullets:['当前客户的成果'],layout:'bullets' as const}]};
const storyRaw=JSON.stringify({title:'当前客户故事',nodes:[{id:'start',type:'start',title:'开始',text:'当前内容'},{id:'end',type:'end',title:'结束',text:'结束'}],edges:[{source:'start',target:'end',label:'继续'}]});
const dimensions={width:1920,height:1080,workspaceId:'personal',model:'deepseek-flash'};
beforeEach(()=>{
 vi.clearAllMocks();useStudio.setState({...createInitialData(),activeWorkspaceId:'personal',templates:[{id:'template-ref',title:'参考展项',type:'卡片浏览型',author:'作者',tags:[],likes:0,uses:0,work:source},{id:'template-ui',title:'视觉参考展项',type:'卡片浏览型',author:'作者',tags:[],likes:0,uses:0,work:structuredClone(source)}]});
});

describe('studio multi-reference generation',()=>{
 it('passes separate interaction and visual contexts into presentation planning without calling them adopted',async()=>{
  vi.mocked(aiChat).mockResolvedValue({model:'deepseek-flash',content:JSON.stringify(presentation)});
  await generatePresentationPlan({topic:'制作当前客户演示',audience:'参观者',kind:'presentation',quantity:3,images:[],files:[],...dimensions,references:refs()});
  const messages=vi.mocked(aiChat).mock.calls[0][1],text=JSON.stringify(messages);
  expect(text).toContain('交互方式');expect(text).toContain('UI 风格');expect(text).toContain('分类浏览');expect(text).toContain('#123456');
  expect(messages.every(message=>message.content.length<=12000)).toBe(true);
 });
 it('rejects an unavailable reference before making a presentation model call',async()=>{
  useStudio.setState({templates:[]});
  await expect(generatePresentationPlan({topic:'介绍',audience:'参观者',kind:'presentation',quantity:3,images:[],files:[],...dimensions,references:refs()})).rejects.toThrow();
  expect(aiChat).not.toHaveBeenCalled();
 });
 it('does not accept a returned presentation plan if source access disappears while waiting',async()=>{
  vi.mocked(aiChat).mockImplementation(async()=>{useStudio.setState({templates:[]});return {model:'deepseek-flash',content:JSON.stringify(presentation)};});
  await expect(generatePresentationPlan({topic:'介绍',audience:'参观者',kind:'presentation',quantity:3,images:[],files:[],...dimensions,references:refs()})).rejects.toThrow();
 });
 it('blocks oversized context and unavailable destination before calling the model',async()=>{
  await expect(generatePresentationPlan({topic:'说明'.repeat(7000),audience:'参观者',kind:'presentation',quantity:3,images:[],files:[],...dimensions,references:refs()})).rejects.toThrow('参考信息过多');
  await expect(generatePresentationPlan({topic:'介绍',audience:'参观者',kind:'presentation',quantity:3,images:[],files:[],...dimensions,workspaceId:'missing',references:refs()})).rejects.toThrow();
  expect(aiChat).not.toHaveBeenCalled();
 });
 it('does not accept a late model response after cancellation',async()=>{
  const controller=new AbortController();
  vi.mocked(aiChat).mockImplementation(async()=>{controller.abort();return {model:'deepseek-flash',content:JSON.stringify(presentation)};});
  await expect(generatePresentationPlan({topic:'介绍',audience:'参观者',kind:'video',duration:30,quantity:3,images:[],files:[],...dimensions,references:refs()},controller.signal)).rejects.toThrow('停止');
 });
 it('preserves independent reference provenance on a generated presentation and its package',()=>{
  const references=refs().map(ref=>ref.dimension==='ui'?{...ref,note:''}:ref);const work=buildPresentationWork(presentation,{prompt:'当前内容',styleId:'',referenceText:'当前资料',assets:[],...dimensions,references});
  expect(work.references?.map(reference=>reference.id)).toEqual(references.map(reference=>reference.id));expect(work.creationPackage?.references).toEqual(work.references);
  expect(work.references).not.toBe(references);expect(work.references?.[0].status).toBe('reference');expect(work.references?.[1].status).toBe('adopted');expect(work.references?.[1].adoptionEvidence).toContain('页面背景');expect(work.pages[0].background).toBe('#ffffff');expect(references.every(reference=>reference.status==='reference')).toBe(true);
 });
 it('preserves an explicitly chosen project palette instead of claiming the reference colors were applied',()=>{
  const work=buildPresentationWork(presentation,{prompt:'当前内容',styleId:'technology',referenceText:'当前资料',assets:[],...dimensions,references:refs()});
  expect(work.pages[0].background).not.toBe('#ffffff');expect(work.references?.[1].status).toBe('reference');
 });
 it('passes multi-reference context to the story model and rechecks availability afterwards',async()=>{
  vi.mocked(aiChat).mockResolvedValue({model:'deepseek-flash',content:storyRaw});
  await generateStoryPlan({title:'故事',flow:'开始到结束',files:[],assets:[],...dimensions,references:refs()});
  expect(JSON.stringify(vi.mocked(aiChat).mock.calls[0][1])).toContain('UI 风格');
  vi.mocked(aiChat).mockImplementation(async()=>{useStudio.setState({templates:[]});return {model:'deepseek-flash',content:storyRaw};});
  await expect(generateStoryPlan({title:'故事',flow:'开始到结束',files:[],assets:[],...dimensions,references:refs()})).rejects.toThrow();
 });
 it('rejects a missing story reference before calling the model and cancelled output afterwards',async()=>{
  const missing=refs().map(reference=>({...reference,sourceId:'missing'}));
  await expect(generateStoryPlan({title:'故事',flow:'开始到结束',files:[],assets:[],...dimensions,references:missing})).rejects.toThrow();
  expect(aiChat).not.toHaveBeenCalled();
  const controller=new AbortController();
  vi.mocked(aiChat).mockImplementation(async()=>{controller.abort();return {model:'deepseek-flash',content:storyRaw};});
  await expect(generateStoryPlan({title:'故事',flow:'开始到结束',files:[],assets:[],...dimensions,references:refs()},controller.signal)).rejects.toThrow('停止');
 });
 it('keeps references on a story work including a manually started blank story',()=>{
  const references=refs();const work=buildStoryWork({title:'故事',flow:'开始到结束',files:[],assets:[],plan:parseStoryPlan(storyRaw),...dimensions,references});
  expect(work.references).toEqual(references);expect(work.creationPackage?.references).toEqual(references);
  const blank=buildStoryWork({title:'手动作品',flow:'',files:[],assets:[],plan:{nodes:[],edges:[]},blank:true,...dimensions,references});
  expect(blank.storyNodes).toEqual([]);expect(blank.references).toEqual(references);
 });
});
