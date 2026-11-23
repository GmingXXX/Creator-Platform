import {describe,it,expect} from 'vitest';
import {confirmExhibitPlan} from '../src/domain/exhibit-review';
import {visualGenerationPrompt} from '../src/domain/visual-guidelines';
import type {Asset} from '../src/domain/types';
import type {AIPlan} from '../src/domain/ai-plan';
const plan:AIPlan={mode:'create',answer:'按年代编排',title:'企业历程',type:'时间演进型',sections:[{title:'初创',body:'企业成立',year:'2000',imageAssetId:'new'}]};
const image:Asset={id:'new',workspaceId:'personal',name:'概念图',kind:'image',src:'/new.png',preview:'/new.png',source:'generated',author:'test',createdAt:'2026-11-16',description:'概念图',tags:[]};
describe('确认事件配图',()=>{
 it('将库选与生成图片加入附件且保留既有资料，不修改输入',()=>{const original=structuredClone(plan);const result=confirmExhibitPlan(plan,['document'],[image],'personal');expect(result.attachmentIds).toEqual(['document','new']);expect(result.aiPlan.sections?.[0].imageAssetId).toBe('new');expect(plan).toEqual(original)});
 it('删除配图后不恢复原图，也不会重复附件',()=>{const result=confirmExhibitPlan({...plan,sections:plan.sections?.map(s=>({...s,imageAssetId:undefined}))},['document','new'],[image],'personal');expect(result.attachmentIds).toEqual(['document','new']);expect(result.aiPlan.sections?.[0].imageAssetId).toBeUndefined()});
 it.each([{deletedAt:'today'},{archived:true},{workspaceId:'other'},{kind:'video'},{metadata:{business:{allowAi:false}}},{metadata:{business:{usage:'reference'}}}])('拒绝不可使用的配图 %j',patch=>{expect(()=>confirmExhibitPlan(plan,[],[{...image,...patch} as Asset],'project')).toThrow(/配图/)});
 it('已被移除的图片不会生成缺图作品',()=>expect(()=>confirmExhibitPlan(plan,[],[],'personal')).toThrow(/配图/));
 it('用户输入的无效计划不能确认',()=>expect(()=>confirmExhibitPlan({...plan,title:''},[],[image],'personal')).toThrow());
});
describe('视觉生成约定',()=>{
 it('修改生成版本时不重复追加规范',()=>{const prompt=visualGenerationPrompt('城市概念');expect(visualGenerationPrompt(prompt)).toBe(prompt)});
 it.each(['','x'.repeat(1501)])('拒绝空白或过长的描述',value=>expect(()=>visualGenerationPrompt(value)).toThrow(/1500/));
 it('保留需求并使文字标识独立排版，避免伪造客户事实',()=>{const prompt=visualGenerationPrompt('生成绿色工厂插画');expect(prompt).toContain('生成绿色工厂插画');expect(prompt).toContain('不生成文字');expect(prompt).toContain('概念');expect(prompt).toContain('留白')});
 it('使用选择的风格参数且不伪称正式VI认证',()=>{const prompt=visualGenerationPrompt('城市', {id:'x',name:'科技',accent:'#123456',colors:['#123456'],background:'#ffffff',text:'#000000',font:'sans',motion:'轻',tags:[],subtitle:'',description:'清爽'});expect(prompt).toContain('#123456');expect(prompt).toContain('科技');expect(prompt).not.toContain('官方认证')});
});
