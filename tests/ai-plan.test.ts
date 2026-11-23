import {describe,it,expect} from 'vitest';
import {parseAIPlan,buildAIWork} from '../src/domain/ai-plan';
import {createDraft} from '../src/domain/fixtures';
describe('AI content contract',()=>{
 it('rejects malformed and unknown output instead of claiming success',()=>{expect(()=>parseAIPlan('{oops')).toThrow();expect(()=>parseAIPlan(JSON.stringify({mode:'create',title:'x',type:'evil',sections:[]}))).toThrow()});
 it('preserves planning options without creating a project',()=>{const p=parseAIPlan(JSON.stringify({mode:'discuss',answer:'比较方案',options:[{title:'时间轴',description:'按年份探索',prompt:'制作企业时间轴'}]}));expect(p.mode).toBe('discuss');expect(p.options?.[0].prompt).toContain('时间轴')});
 it('creates native content with model-written text and isolated workspace',()=>{const p=parseAIPlan(JSON.stringify({mode:'create',title:'钢铁之路',type:'时间演进型',answer:'完成编排',sections:[{title:'初创',body:'首条生产线投产',year:'1998'},{title:'创新',body:'创新中心启用',year:'2025'}]}));const draft=createDraft();const w=buildAIWork(p,{...draft,id:'r',prompt:'企业历史',status:'running',step:0,outputKind:'exhibit',createdAt:new Date().toISOString(),workspaceId:'xintai',model:'deepseek-flash'});expect(w.title).toBe('钢铁之路');expect(w.workspaceId).toBe('xintai');expect(w.pages.flatMap(x=>x.nodes).some(n=>n.items?.some(i=>i.title==='初创'))).toBe(true);expect(w.aiModel).toBe('deepseek-flash')});
});

describe('AI plan validation and project families',()=>{
 it.each(['null','{}','{"mode":"unknown"}',JSON.stringify({mode:'discuss',answer:' '}),JSON.stringify({mode:'discuss',answer:'x'.repeat(6001)})])('rejects invalid plan %s',raw=>{expect(()=>parseAIPlan(raw)).toThrow()});
 it('accepts fenced JSON and discussion without actionable options',()=>{expect(parseAIPlan('```json\n{"mode":"discuss","answer":"请补充客户资料"}\n```')).toEqual({mode:'discuss',answer:'请补充客户资料',options:[]})});
 it('rejects incomplete options and caps valid options',()=>{expect(()=>parseAIPlan(JSON.stringify({mode:'discuss',answer:'比较',options:[{title:'时间轴'}]}))).toThrow();const result=parseAIPlan(JSON.stringify({mode:'discuss',answer:'比较',options:Array.from({length:8},(_,i)=>({title:`方案${i}`,prompt:'制作',description:'布局'}))}));expect(result.options).toHaveLength(4)});
 it.each([{title:''},{type:'unknown'},{sections:[]},{sections:[{title:'',body:'x'}]},{sections:'invalid'}])('rejects incomplete creation structure %j',patch=>{expect(()=>parseAIPlan(JSON.stringify({mode:'create',answer:'生成',title:'标题',type:'时间演进型',sections:[{title:'第一部分',body:'正文'}],...patch}))).toThrow()});
 it('caps sections and safely drops non-text or overlong optional fields',()=>{const plan=parseAIPlan(JSON.stringify({mode:'create',answer:'生成',title:'标题',type:'卡片浏览型',sections:Array.from({length:20},()=>({title:'章节',body:123,year:9})),imagePrompt:'x'.repeat(1600)}));expect(plan.sections).toHaveLength(12);expect(plan.sections?.[0]).toMatchObject({body:'',year:''});expect(plan.imagePrompt).toBe('')});
 it('requires a creation plan before building a project',()=>{expect(()=>buildAIWork({mode:'discuss',answer:'先讨论'},{} as any)).toThrow(/选择/)});
 it.each(['presentation','video','story'] as const)('maps model content to the %s editor structure',outputKind=>{const draft=createDraft();const work=buildAIWork({mode:'create',answer:'生成',title:'模型标题',type:'媒体叙事型',sections:[{title:'模型章节',body:'模型讲解'}]},{...draft,id:'run-family',prompt:'创建内容',model:'deepseek-flash',status:'running',step:0,outputKind,createdAt:new Date().toISOString(),styleId:'',workspaceId:undefined});expect(work.kind).toBe(outputKind);expect(work.workspaceId).toBe('personal');expect(work.creationPackage?.params.model).toBe('deepseek-flash');if(outputKind==='presentation')expect(work.pages[0].name).toBe('模型章节');if(outputKind==='video')expect(work.shots?.[0].narration).toBe('模型讲解');if(outputKind==='story')expect(work.storyNodes?.[0].text).toBe('模型讲解')});
});

it('keeps planning instructions outside the exhibit subtitle',()=>{
 const draft=createDraft();const plan={mode:'create' as const,answer:'使用渐变和动效编排的长篇制作说明',title:'创新之路',type:'时间演进型' as const,sections:[{title:'启程',body:'企业成立'},{title:'突破',body:'技术创新'}]};
 const work=buildAIWork(plan,{...draft,id:'subtitle-test',prompt:'历史',model:'deepseek-flash',status:'running',step:0,outputKind:'exhibit',createdAt:new Date().toISOString()});
 expect(work.pages[0].nodes.find(n=>n.name==='展项简介')?.content).toBe('启程 · 突破');
});
