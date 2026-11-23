import {describe,it,expect} from 'vitest';
import {editorImageAsset,editorImageSize,imageDraftStorageKey} from '../src/features/editor/editor-image-generation';
const id='a'.repeat(32);
describe('editor image candidates',()=>{
 it('pins server image and generation prompt without applying it to the page',()=>{
  const asset=editorImageAsset({id,status:'succeeded',url:`/api/ai/media/${id}.png`},'工业展厅，无文字',{workspaceId:'project-x',styleId:'industrial'});
  expect(asset.workspaceId).toBe('project-x');expect(asset.package?.prompt).toBe('工业展厅，无文字');expect(asset.public).toBe(false);expect(asset.kind).toBe('image');
 });
 it.each(['javascript:alert(1)','https://example.org/a.png','/api/ai/media/other.png'])('rejects an unexpected generated URL %s',url=>{
  expect(()=>editorImageAsset({id,status:'succeeded',url},'背景',{})).toThrow('地址无效');
 });
 it('does not make a placeholder asset for a pending or failed job',()=>{
  for(const status of ['pending','failed'] as const)expect(()=>editorImageAsset({id,status},'背景',{})).toThrow('尚未完成');
 });
 it('generates for the selected image aspect and normalizes unsupported custom ratios',()=>{
  expect(editorImageSize({width:1920,height:1080},{w:300,h:600})).toBe('960*1696');
  expect(editorImageSize({width:9000,height:500})).toBe('2560*640');
  expect(editorImageSize({width:1080,height:1080})).toBe('1280*1280');
 });
 it('separates pending jobs by work, page and selected image',()=>{
  expect(new Set([imageDraftStorageKey('a','p'),imageDraftStorageKey('a','q'),imageDraftStorageKey('b','p'),imageDraftStorageKey('a','p','n')]).size).toBe(4);
 });
});
