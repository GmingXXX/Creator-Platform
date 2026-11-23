import {describe,it,expect} from 'vitest';
import {appendSkillContext,skillContextMessages} from '../src/domain/skill-context';

describe('selected skill model context',()=>{
 it('passes every part of selected instructions without truncating long source text',()=>{
  const instructions='甲'.repeat(14000)+'结尾规则';
  const messages=skillContextMessages([{name:'编排',input:'资料',steps:['理解需求'],instructions}]);
  expect(messages.every(message=>message.content.length<=12000)).toBe(true);
  expect(messages.map(message=>message.content).join('')).toContain('结尾规则');
  expect(messages.map(message=>message.content).join('').match(/甲/g)?.length).toBe(14000);
  expect(messages.every(message=>message.role==='user')).toBe(true);
 });
 it('uses builtin input and steps even without packaged instructions',()=>{
  const messages=skillContextMessages([{name:'讲稿整理',input:'事实资料',steps:['按观众组织讲稿']}]);
  expect(messages[0].content).toContain('按观众组织讲稿');
  expect(skillContextMessages([])).toEqual([]);
 });
 it('rejects oversized complete context instead of silently losing skill instructions',()=>{
  expect(()=>appendSkillContext([{role:'system',content:'x'.repeat(59999)}],[{name:'a',input:'b',steps:['c']}])).toThrow('过长');
  expect(()=>appendSkillContext(Array.from({length:40},()=>({role:'user' as const,content:'a'})),[{name:'a',input:'b',steps:['c']}])).toThrow('过长');
 });
 it('appends immutable context after existing messages',()=>{
  const messages=[{role:'system' as const,content:'只返回合法格式'}];
  const result=appendSkillContext(messages,[{name:'a',input:'b',steps:['c']}]);
  expect(result).toHaveLength(2);expect(messages).toHaveLength(1);expect(result[0]).toEqual(messages[0]);
 });
});
