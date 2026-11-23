import {describe,it,expect} from 'vitest';
import {buildPresentationWork} from '../src/domain/presentation-generation';
import {applyPresentationTemplate,presentationTemplates} from '../src/features/studios/presentation-templates';
import {generationAssetLabel,materialRequestId} from '../src/features/creation/material-review-logic';
const work=()=>buildPresentationWork({title:'企业介绍',sections:[{title:'核心能力',narration:'介绍三项能力',bullets:['感知','协同'],layout:'split'}]},{width:1920,height:1080,prompt:'介绍',model:'demo',styleId:'',workspaceId:'personal',assets:[],referenceText:''});
describe('演示模板实际编排',()=>{
 it('无模板保留原作品',()=>{const w=work();expect(applyPresentationTemplate(w,'')).toBe(w)});
 it('模板更改实际布局并保留用户内容与讲稿',()=>{const w=work(),next=applyPresentationTemplate(w,presentationTemplates[0].id);expect(next.pages[0].nodes.find(n=>n.name==='主标题')?.x).not.toBe(w.pages[0].nodes.find(n=>n.name==='主标题')?.x);expect(next.pages[0].notes).toBe(w.pages[0].notes);expect(next.pages[0].nodes.filter(n=>n.type==='text').map(n=>n.content)).toEqual(w.pages[0].nodes.filter(n=>n.type==='text').map(n=>n.content));expect(w.creationPackage?.params.templateId).toBeUndefined();expect(next.creationPackage?.params.templateId).toBe(presentationTemplates[0].id)});
 it('不同模板确实提供不同布局',()=>{const w=work();expect(applyPresentationTemplate(w,presentationTemplates[0].id).pages).not.toEqual(applyPresentationTemplate(w,presentationTemplates[1].id).pages)});
 it('未知模板拒绝静默应用',()=>expect(()=>applyPresentationTemplate(work(),'missing')).toThrow());
});
describe('素材来源与重复任务',()=>{
 it('标示实际来源',()=>{expect(generationAssetLabel({source:'generated'})).toBe('AI 生成');expect(generationAssetLabel({source:'uploaded'})).toBe('客户上传');expect(generationAssetLabel({source:'builtin'})).toBe('素材库')});
 it('同一任务版本使用稳定幂等键，不同版本分离',()=>{expect(materialRequestId('run-1:event-2',1)).toBe(materialRequestId('run-1:event-2',1));expect(materialRequestId('run-1:event-2',1)).not.toBe(materialRequestId('run-1:event-2',2))});
});
