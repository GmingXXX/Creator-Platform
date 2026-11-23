import {describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {contentPurposes,getAssetCategory,getProjectCategory,getWorkPurposes,isLibraryAsset,projectCategories,resolveAssetProject} from '../src/domain/project-taxonomy';

describe('project and planning taxonomy',()=>{
 it('keeps four editors under exactly three project categories',()=>{
  const works=createInitialData().works;
  expect(projectCategories.map(item=>item.label)).toEqual(['交互页面','智能演示','互动影片']);
  expect(works.filter(work=>!work.workspaceId||work.workspaceId==='personal').map(getProjectCategory)).toEqual(['interactive','interactive','interactive','presentation-video','presentation-video','interactive-film']);
 });
 it('keeps purpose independent of display form and accepts explicit empty classification',()=>{
  const work=createInitialData().works[0];
  expect(contentPurposes).toHaveLength(12);
  expect(getWorkPurposes({...work,title:'全球案例与业务布局',type:'卡片浏览型'})).toEqual(['cases','locations']);
  expect(getWorkPurposes({...work,contentPurposes:[]})).toEqual([]);
  expect(getWorkPurposes({...work,contentPurposes:['cases','cases','unknown']})).toEqual(['cases']);
 });
 it('groups unknown legacy HTML as embedded component and excludes editable project aliases',()=>{
  const state=createInitialData(),asset=state.assets[0],work=state.works[3];
  expect(getAssetCategory({...asset,kind:'html'})).toBe('component');
  expect(getAssetCategory({...asset,kind:'presentation'})).toBe('document');
  expect(isLibraryAsset({...asset,sourceWorkId:work.id})).toBe(false);
  expect(isLibraryAsset({...asset,presentationRole:'project-source'})).toBe(false);
  expect(resolveAssetProject({...asset,public:false,sourceWorkId:work.id},state.works)).toEqual(work);
  expect(resolveAssetProject({...asset,sourceWorkId:work.id},state.works)).toBeUndefined();
  expect(isLibraryAsset({...asset,kind:'video'})).toBe(true);
 });
});
