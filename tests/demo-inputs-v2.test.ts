import {describe,it,expect} from 'vitest';
import {demoPresetData} from '../src/features/home/demo-preset-data';
describe('minimal real-production demonstration inputs',()=>{
 it('provides text and only a few supplied images for the timeline',()=>{
  const preset=demoPresetData.find(p=>p.id==='timeline')!;
  expect(preset.files.filter(f=>f.mime.startsWith('image/')).length).toBeGreaterThanOrEqual(2);
  expect(preset.files.filter(f=>f.mime.startsWith('image/')).length).toBeLessThanOrEqual(3);
  expect(preset.prompt).toContain('生成');
 });
 it('provides an outline and six prepared images for the presentation',()=>{
  const preset=demoPresetData.find(p=>p.id==='presentation')!;
  expect(preset.files).toHaveLength(7);
  expect(preset.files.filter(file=>file.mime.startsWith('image/'))).toHaveLength(6);
  expect(preset.prompt).toContain('第7、8页');
  expect(preset.prompt).toContain('素材库');
 });
 it('starts an interactive story from an idea, without a prepared media package',()=>{
  const preset=demoPresetData.find(p=>p.id==='story')!;
  expect(preset.files).toHaveLength(0);
  expect(preset.prompt).toContain('策划');
  expect(preset.prompt).toContain('视频');
 });
});
