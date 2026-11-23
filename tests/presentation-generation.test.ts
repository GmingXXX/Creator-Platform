import {describe,it,expect} from 'vitest';
import {systems} from '../src/domain/scenes';
import {parsePresentationPlan,buildPresentationWork,presentationQuestionMessages,parsePresentationAnswer} from '../src/domain/presentation-generation';
const raw=JSON.stringify({title:'星澜智造',sections:[{title:'绿色产线',narration:'2024 年完成绿色产线升级。',bullets:['产能提升 18%','能耗降低 12%'],layout:'split',imageAssetId:'img'}]});
const options={prompt:'根据上传资料生成',model:'deepseek-flash',styleId:'technology',workspaceId:'personal',width:1920,height:1080,referenceText:'原始资料：能耗降低 12%。',assets:[{id:'img',name:'产线照片',kind:'image',src:'/media/demo.png'}] as any};
describe('real presentation planning',()=>{
 it('uses the selected custom design and resolves descriptive font rules',()=>{
 const design={...systems[0],id:'custom-style',background:'#123456',text:'#eeeeee',accent:'#abcdef',font:'宋体与现代黑体'};
 const work=buildPresentationWork(parsePresentationPlan(raw),{...options,styleId:design.id,designSystem:design});
 expect(work.pages[0].background).toBe(design.background);expect(work.pages[0].nodes.find(n=>n.name==='主标题')).toMatchObject({color:design.text,fontFamily:'"Songti SC", SimSun, serif'});
 });
 it('parses bounded actual body and rejects empty/invalid sections',()=>{expect(parsePresentationPlan(raw).sections[0].bullets).toEqual(['产能提升 18%','能耗降低 12%']);for(const value of ['null','{}','{"sections":[]}','{"sections":[{"title":"x","bullets":[]}]}'])expect(()=>parsePresentationPlan(value)).toThrow();});
 it('creates one actual page per confirmed section with body, asset and narration',()=>{const plan=parsePresentationPlan(raw),snapshot=JSON.stringify(plan),work=buildPresentationWork(plan,options);expect(work.pages).toHaveLength(1);expect(work.pages[0].notes).toBe(plan.sections[0].narration);expect(work.pages[0].nodes.some(n=>n.content.includes('能耗降低 12%'))).toBe(true);expect(work.pages[0].nodes.find(n=>n.type==='image')?.assetId).toBe('img');expect(JSON.stringify(work)).not.toContain('理解需求');expect(work.creationPackage?.params.referenceText).toContain('原始资料');expect(JSON.stringify(plan)).toBe(snapshot);});
 it('rejects unresolved media rather than silently losing confirmed assets',()=>expect(()=>buildPresentationWork(parsePresentationPlan(raw),{...options,assets:[]})).toThrow('配图'));
 it('grounds questions in all slides and actual source with bounded messages',()=>{const work=buildPresentationWork(parsePresentationPlan(raw),options),messages=presentationQuestionMessages(work,'能耗降低多少？',0);expect(messages.some(m=>m.content.includes('原始资料'))).toBe(true);expect(messages.some(m=>m.content.includes('能耗降低 12%'))).toBe(true);expect(messages.every(m=>m.content.length<=12000)).toBe(true);expect(()=>presentationQuestionMessages(work,' ',0)).toThrow();});
 it('validates grounded model answers and drops out-of-range page citations',()=>{expect(parsePresentationAnswer('{"answer":"降低 12%。","sourcePages":[1,999]}',1)).toEqual({answer:'降低 12%。',sourcePages:[1]});expect(()=>parsePresentationAnswer('{"answer":""}',2)).toThrow();});
});
