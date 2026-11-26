import {describe,it,expect} from 'vitest';
import {createStoryLayer,storyFontPixels,storyFontRatio,fitStoryLayer,reorderStoryLayer,copyStoryLayer,storyShowsCaption} from '../src/domain/story-layer-editing';
describe('影片画面控件',()=>{
 it('网格吸附和边缘限制均适用于拖动与缩放',()=>{
  expect(fitStoryLayer({x:96,y:-5,width:25,height:12},true)).toEqual({x:74,y:0,width:26,height:12});
  expect(fitStoryLayer({x:10.3,y:4.1,width:0,height:120},false)).toEqual({x:10.3,y:0,width:2,height:100});
 });
 it('新按钮位于中部，画布尺寸变化时字号以设计稿像素换算',()=>{
  const button=createStoryLayer('button');
  expect(button.y+button.height).toBeLessThan(65);
  expect(storyFontPixels(2.5,1920)).toBe(48);
  expect(storyFontRatio(24,960)).toBe(2.5);
  expect(storyFontRatio(0,1080)).toBeGreaterThan(0);
 });
 it('提供有独立属性的控件及拍摄结果绑定',()=>{
  expect(createStoryLayer('mask')).toMatchObject({variant:'mask',opacity:.55});
  expect(createStoryLayer('photo')).toMatchObject({kind:'image',resultSource:'photo'});
  expect(createStoryLayer('qr')).toMatchObject({variant:'qr',qrText:''});
 });
 it('保持已锁定图层顺序，可复制一个独立的可编辑副本',()=>{
  const a=createStoryLayer('button'),b={...createStoryLayer('text'),locked:true};
  expect(reorderStoryLayer([a,b],b.id,-1)).toEqual([a,b]);
  expect(reorderStoryLayer([a,b],a.id,1)).toEqual([b,a]);
  const c=copyStoryLayer(b);expect(c.id).not.toEqual(b.id);expect(c.locked).toBe(false);
  expect(b.locked).toBe(true);
 });
 it('按作品设置展示文案，并保留历史节点的显示效果',()=>{
  expect(storyShowsCaption({})).toBe(true);expect(storyShowsCaption({showCaption:false})).toBe(false);
 });
});
