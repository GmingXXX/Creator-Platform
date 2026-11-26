import {describe,it,expect} from 'vitest';
import {createNode} from '../src/features/editor/editor-domain';
import {eventsFor,availableCommands,applyPreset,componentCatalog} from '../src/features/editor/editor-capabilities';
describe('组件目录和行为能力',()=>{
 it('保留稳定目标并生成四个不同视频动作',()=>{const n=createNode('video');const commands=availableCommands(n);expect(commands.map(c=>c.action)).toEqual(['resume','pause','stop','restart']);expect(commands.every(c=>c.targetId===n.id)).toBe(true)});
 it('触发条件随来源改变',()=>{expect(eventsFor('image')).toEqual(['click']);expect(eventsFor('video')).toContain('videoEnd');expect(eventsFor('page')).toContain('allVisited')});
 it('目录叶子创建可辨识的具体样式',()=>{const n=applyPreset(createNode('shape'),'三角形');expect(n.variant).toBe('三角形');expect(componentCatalog.flatMap(g=>g.families.map(f=>f.name))).toContain('蒙版')});
});
