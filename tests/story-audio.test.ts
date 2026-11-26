import {describe,expect,it} from 'vitest';
import {collectStoryAudio,effectiveStoryMusic,trackVolume} from '../src/domain/story-audio';
import type {Work} from '../src/domain/types';
import {createInitialData} from '../src/domain/fixtures';
import {workDependencyError} from '../src/domain/resource-permissions';

const theme={src:'/theme.mp3',assetId:'theme',volume:.3};
const city={src:'/city.mp3',assetId:'city',volume:.6};
const intro={src:'/intro.mp3',assetId:'intro',volume:1};
describe('互动影片声音',()=>{
 it('未配置的旧作品静音，有项目音乐时节点可继承、覆盖或静音',()=>{
  expect(effectiveStoryMusic()).toBeUndefined();
  expect(effectiveStoryMusic(theme,{})).toEqual(theme);
  expect(effectiveStoryMusic(theme,{musicMode:'inherit',music:city})).toEqual(theme);
  expect(effectiveStoryMusic(theme,{inheritedVolume:.5})?.volume).toBe(.15);
  expect(effectiveStoryMusic(theme,{musicMode:'own',music:city})).toEqual(city);
  expect(effectiveStoryMusic(theme,{musicMode:'off',music:city})).toBeUndefined();
  expect(effectiveStoryMusic(theme,{musicMode:'own'})).toBeUndefined();
 });
 it('浏览器音量只接收 0 到 1 的有限值，尊重静音',()=>{
  expect([undefined,NaN,-2,0,.3,2].map(v=>trackVolume(v,.8))).toEqual([.8,.8,0,0,.3,1]);
 });
 it('作品素材检查包括项目配乐、节点配乐和旁白',()=>{
  const state=createInitialData();
  const work:Work={...state.works[0],storyMusic:theme,storyNodes:[{id:'s',x:0,y:0,type:'start',title:'候云',text:'',sound:{music:city,narration:intro}}]};
  expect(collectStoryAudio(work)).toEqual([theme,city,intro]);
  expect(workDependencyError([],work,'personal','manual')).toBeTruthy();
 });
});
