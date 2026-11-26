import {describe,expect,it,vi,beforeEach} from 'vitest';
import type {Asset} from '../src/domain/types';
import {buildStoryWork,generateStoryPlan,parseStoryPlan,storyPlanErrors} from '../src/domain/story-generation';
import {aiChat} from '../src/domain/ai-client';
vi.mock('../src/domain/ai-client',()=>({aiChat:vi.fn()}));
const raw=()=>({nodes:[{id:'start',type:'start',title:'候云',text:'山门开启'},{id:'choose',type:'choice',title:'择路',text:'你想去哪里？',mediaAssetId:'cloud'},{id:'east',type:'end',title:'云海结局',text:'在云海留下记忆'},{id:'west',type:'end',title:'石刻结局',text:'读懂石刻的故事'}],edges:[{source:'start',target:'choose',label:'请君入山'},{source:'choose',target:'east',label:'寻找云海'},{source:'choose',target:'west',label:'探索石刻'}]});
const image:Asset={id:'cloud',name:'择路云海.png',kind:'image',src:'/media/cloud.png',description:'',tags:[],author:'纪鸣',source:'uploaded',createdAt:'2026-11-16',workspaceId:'personal'};
const doc:Asset={...image,id:'script',name:'泰山寻碑.docx',kind:'document',src:'idb:script'};
beforeEach(()=>vi.clearAllMocks());
describe('script-driven story plan',()=>{
 it('preserves real branching structure and binds only supplied media',()=>{
  const plan=parseStoryPlan(JSON.stringify(raw()),[image]);
  expect(plan.nodes.map(n=>n.title)).toEqual(['候云','择路','云海结局','石刻结局']);expect(plan.nodes[1].media).toBe(image.src);expect(plan.edges[2].target).toBe('west');expect(storyPlanErrors(plan.nodes,plan.edges)).toEqual([]);
 });
 it('retains scripted photo confirmation and skip events, rejects a photo event on a different node',()=>{
  const data=raw();data.nodes[1].type='photo';
  const typed={...data,edges:data.edges.map((edge,i)=>({...edge,...(i===1?{trigger:'photoConfirm'}:i===2?{trigger:'photoSkip'}:{})}))};
  expect(parseStoryPlan(JSON.stringify(typed),[image]).edges.map(e=>e.trigger)).toEqual([undefined,'photoConfirm','photoSkip']);
  typed.nodes[1].type='scene';expect(()=>parseStoryPlan(JSON.stringify(typed),[image])).toThrow(/拍照节点/);
 });
 it('accepts a concise suggested title, keeps old plans compatible and does not replace an authored work title',()=>{
  const suggested=parseStoryPlan(JSON.stringify({...raw(),title:'泰山寻碑'}),[image]);expect(suggested.title).toBe('泰山寻碑');expect(parseStoryPlan(JSON.stringify(raw()),[image]).title).toBeUndefined();
  const work=buildStoryWork({title:'用户指定的作品名',flow:'按脚本生成',files:[],assets:[image],plan:suggested,width:1920,height:1080,workspaceId:'personal',model:'deepseek-flash'});expect(work.title).toBe('用户指定的作品名');
 });
 it('rejects arbitrary media URLs and unavailable asset ids',()=>{
  const input=raw();input.nodes[1].mediaAssetId='missing';expect(()=>parseStoryPlan(JSON.stringify(input),[image])).toThrow(/素材/);
  const plan=parseStoryPlan(JSON.stringify({...raw(),nodes:raw().nodes.map(n=>({...n,mediaAssetId:undefined,media:'https://invented.invalid/image.jpg'}))}));expect(plan.nodes.every(n=>!n.media)).toBe(true);
 });
 it('requires one start and an ending',()=>{
  const input=raw();input.nodes[0].type='scene';expect(()=>parseStoryPlan(JSON.stringify(input),[image])).toThrow(/开始/);
  const other=raw();other.nodes.filter(n=>n.type==='end').forEach(n=>n.type='scene');expect(()=>parseStoryPlan(JSON.stringify(other),[image])).toThrow(/结局/);
 });
 it('rejects duplicate ids, broken edges and disconnected scenes',()=>{
  const duplicate=raw();duplicate.nodes[3].id='east';expect(()=>parseStoryPlan(JSON.stringify(duplicate),[image])).toThrow(/编号/);
  const broken=raw();broken.edges[1].target='absent';expect(()=>parseStoryPlan(JSON.stringify(broken),[image])).toThrow(/失效/);
  const detached=raw();detached.nodes.push({id:'orphan',type:'end',title:'未连接',text:''});expect(()=>parseStoryPlan(JSON.stringify(detached),[image])).toThrow(/未连接/);
 });
 it('rejects cycles and a choice whose edges have the same destination',()=>{
  const cycle=raw();cycle.edges.push({source:'east',target:'start',label:'回去'});expect(()=>parseStoryPlan(JSON.stringify(cycle),[image])).toThrow(/结局|循环/);
  const duplicate=raw();duplicate.edges[2].target='east';expect(()=>parseStoryPlan(JSON.stringify(duplicate),[image])).toThrow(/不同/);
 });
 it('requires branches to use visible unique option text, and permits branches on ordinary scenes',()=>{
  const input=raw();input.edges[2].label=input.edges[1].label;expect(()=>parseStoryPlan(JSON.stringify(input),[image])).toThrow(/选项/);
  const scene=raw();scene.nodes[1].type='scene';expect(parseStoryPlan(JSON.stringify(scene),[image]).edges).toHaveLength(3);
 });
 it('rejects unsupported node types and overlong story instead of silently truncating',()=>{
  const input=raw();input.nodes[1].type='camera';expect(()=>parseStoryPlan(JSON.stringify(input),[image])).toThrow(/类型/);
  expect(()=>parseStoryPlan(JSON.stringify({nodes:Array.from({length:41},(_,i)=>({...raw().nodes[0],id:String(i)})),edges:[]}))).toThrow(/40/);
 });
 it('includes parsed script, exact asset manifest, selected style and skill in the actual model request',async()=>{
  vi.mocked(aiChat).mockResolvedValue({model:'deepseek-flash',content:JSON.stringify(raw())});
  await generateStoryPlan({title:'泰山寻碑',flow:'两条路线，两个结局',files:[{asset:doc,text:'节点择路：素材为择路云海.png。向东寻找云海，向西探索石刻。',status:'已解析'}],assets:[image],model:'deepseek-flash',styleId:'culture',skills:[{name:'叙事编排',input:'脚本',steps:['保留分支选择'],instructions:'不得合并结局'}]});
  const args=vi.mocked(aiChat).mock.calls[0];expect(args[0]).toBe('deepseek-flash');const text=JSON.stringify(args[1]);expect(text).toContain('向东寻找云海');expect(text).toContain('择路云海.png');expect(text).toContain('cloud');expect(text).toContain('culture');expect(text).toContain('不得合并结局');
 });
 it('keeps requests within the provider per-message limit',async()=>{
  vi.mocked(aiChat).mockResolvedValue({model:'deepseek-flash',content:JSON.stringify(raw())});
  await generateStoryPlan({title:'稿件',flow:'说明'.repeat(4000),files:[{asset:doc,text:'参考正文'.repeat(9000),status:'已解析'}],assets:[image],model:'deepseek-flash'});
  expect(vi.mocked(aiChat).mock.calls[0][1].every(message=>message.content.length<=12000)).toBe(true);
 });
 it('builds an independent editable project with adopted media and source text',()=>{
  const plan=parseStoryPlan(JSON.stringify(raw()),[image]);const original=structuredClone(plan);const adopted={...image,id:'cloud-shared',workspaceId:'xintai'};
  const work=buildStoryWork({title:'泰山寻碑',flow:'双路线体验',files:[{asset:doc,text:'上传脚本正文',status:'已解析'}],assets:[adopted,doc],assetIdMap:new Map([['cloud',adopted]]),plan,width:1920,height:1080,workspaceId:'xintai',model:'deepseek-flash',styleId:'culture',skillIds:['skill-story']});
  expect(work.kind).toBe('story');expect(work.storyNodes).toHaveLength(4);expect(work.storyNodes![1].mediaAssetId).toBe('cloud-shared');expect(work.storyEdges).toHaveLength(3);expect(work.workspaceId).toBe('xintai');expect(work.creationPackage?.params.scriptText).toBe('上传脚本正文');expect(work.creationPackage?.skillIds).toEqual(['skill-story']);expect(plan).toEqual(original);
 });
 it('still allows a genuinely empty manually authored story',()=>{
  const work=buildStoryWork({title:'空白故事',flow:'',files:[],assets:[],plan:{nodes:[],edges:[]},width:1920,height:1080,workspaceId:'personal',model:'deepseek-flash',blank:true});expect(work.storyNodes).toEqual([]);expect(work.storyEdges).toEqual([]);
 });
});
