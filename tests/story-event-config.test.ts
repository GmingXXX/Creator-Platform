import {cloneWork} from '../src/domain/logic';
import {createSceneWork} from '../src/domain/scenes';
import {validateStory} from '../src/features/studios/studioLogic';
import {describe,expect,it} from 'vitest';
import {cloneStoryScene,eventSources,eventCaption,conditionAllows,visitCondition,readVisitCondition} from '../src/domain/story-events';
import type {StoryNode,StoryEdge} from '../src/domain/types';
const node:StoryNode={id:'scene',type:'scene',title:'旅程',text:'',x:1,y:2,layers:[{id:'movie',kind:'video',name:'引子',src:'clip.mp4',text:'',x:0,y:0,width:20,height:20}]};
const exit:StoryEdge={id:'edge',source:'scene',target:'end',trigger:'videoEnd',layerId:'movie',label:'继续',effects:[{id:'fx',kind:'hide',layerId:'movie'}]};
describe('基于当前影片配置事件',()=>{
 it('仅显示可触发该事件的实际来源，主媒体无视频时不提供伪视频源',()=>{
  expect(eventSources(node,'image','videoEnd')).toEqual([{id:'movie',name:'引子'}]);
  expect(eventSources(node,'html','htmlComplete')).toEqual([{id:'',name:'场景主素材'}]);
  expect(eventSources(node,'image','click')).toEqual([]);
  expect(eventCaption(exit,node)).toContain('引子');
 });
 it('条件来自本次已访问节点，兼容旧版探索倾向',()=>{
  const visited=visitCondition('visited','start'),unvisited=visitCondition('unvisited','end');
  expect(readVisitCondition(visited)).toEqual({mode:'visited',nodeId:'start'});
  expect(conditionAllows(visited,['start'],'green')).toBe(true);expect(conditionAllows(visited,[],'green')).toBe(false);
  expect(conditionAllows(unvisited,['start'],'green')).toBe(true);expect(conditionAllows(unvisited,['end'],'green')).toBe(false);
  expect(conditionAllows('technology',[],'technology')).toBe(true);
 });
 it('作品复制后，访问条件引用副本中的新节点',()=>{
  const base=createSceneWork({title:'旅程',type:'媒体叙事型',width:1920,height:1080,kind:'story'});
  const copy=cloneWork({...base,storyNodes:[node,{...node,id:'end',type:'end'}],storyEdges:[{...exit,label:'继续\n[条件] visited:scene'}]});
  expect(copy.storyEdges![0].label).toBe('继续\n[条件] visited:'+copy.storyNodes![0].id);
 });
 it('流程检查定位遗失的事件来源和剧情条件',()=>{
  const nodes=[{...node,id:'scene',type:'start',layers:[]},{...node,id:'end',type:'end'}];
  const problems=validateStory(nodes,[{...exit,label:'继续\n[条件] visited:deleted'}]);
  expect(problems.some(x=>x.includes('事件来源'))).toBe(true);
  expect(problems.some(x=>x.includes('生效条件'))).toBe(true);
 });
 it('复制分支时复制图层并重新绑定事件源和动作，保留原事件和目的地',()=>{
  const copy=cloneStoryScene(node,[exit]);
  expect(copy.node.id).not.toBe(node.id);expect(copy.node.layers![0].id).not.toBe('movie');
  expect(copy.edges[0]).toMatchObject({source:copy.node.id,target:'end',layerId:copy.node.layers![0].id});
  expect(copy.edges[0].effects![0].layerId).toBe(copy.node.layers![0].id);
  expect(exit.effects![0].layerId).toBe('movie');
  expect(cloneStoryScene({...node,type:'start'},[]).node.type).toBe('scene');
 });
});

describe('失去触发来源的分支',()=>{
 const source={...node,type:'start'},ending={...node,id:'end',type:'end'};
 const route=(trigger:StoryEdge['trigger'],layerId?:string):StoryEdge=>({id:'continue',source:source.id,target:ending.id,label:'继续',trigger,layerId});
 it.each(['videoEnd','htmlComplete'] as const)('%s 主素材被清除或改为图片时提示，匹配素材可用',trigger=>{
  for(const media of [undefined,'/photo.jpg']){
   expect(validateStory([{...source,media},ending],[route(trigger)]).join('')).toContain('主素材');
  }
  expect(validateStory([{...source,media:trigger==='videoEnd'?'/clip.mp4':'/page.html'},ending],[route(trigger)])).toEqual([]);
 });
 it('支持没有文件后缀的本地视频，当前素材类型优先',()=>{
  const video={id:'v',src:'idb:test',kind:'video'} as import('../src/domain/types').Asset;
  expect(validateStory([{...source,media:video.src,mediaAssetId:video.id},ending],[route('videoEnd')],[video])).toEqual([]);
  expect(validateStory([{...source,media:'/new.jpg',mediaAssetId:video.id},ending],[route('videoEnd')],[video]).join('')).toContain('主素材');
 });
 it.each(['photoConfirm','photoSkip'] as const)('%s 不能从普通节点触发',trigger=>{
   expect(validateStory([source,ending],[route(trigger)]).join('')).toContain('拍照节点');
 });
 it('隐藏控件需由同幕可触发的事件先显示，离开本幕或自行显示不能解锁',()=>{
  const hidden={...source,layers:source.layers!.map(l=>({...l,hidden:true}))};
  const onHidden=route('videoEnd','movie'),reveal:StoryEdge={...route('click'),id:'reveal',stay:true,target:'',effects:[{id:'fx',kind:'show',layerId:'movie'}]};
  expect(validateStory([hidden,ending],[onHidden]).join('')).toContain('初始隐藏');
  expect(validateStory([hidden,ending],[onHidden,reveal])).toEqual([]);
  expect(validateStory([hidden,ending],[onHidden,{...reveal,stay:false,target:'end'}]).join('')).toContain('初始隐藏');
  expect(validateStory([hidden,ending],[onHidden,{...reveal,trigger:'layerClick',layerId:'movie'}]).join('')).toContain('初始隐藏');
 });
 it('视频循环或缺少媒体时，不会把图层判断为可完成',()=>{
  for(const layer of [{...node.layers![0],loop:true},{...node.layers![0],src:undefined}]){
   expect(validateStory([{...source,layers:[layer]},ending],[route('videoEnd',layer.id)]).join('')).toContain('视频');
  }
 });
});
