import {describe,it,expect} from 'vitest';
import {layoutStory,storyKind,storyRoute} from '../src/domain/story-canvas';
import {validateStory} from '../src/features/studios/studioLogic';
import {storyPlanErrors} from '../src/domain/story-generation';
const nodes=['start','scene','photo','end'].map((type,i)=>({id:String(i),type,title:type,text:'',x:0,y:0}));
const edges=[['0','1'],['0','2'],['1','2'],['1','3'],['2','3']].map(([source,target],i)=>({id:String(i),source,target,label:'分支 '+i}));
describe('互动影片编辑',()=>{
 it('允许开始、普通与拍照节点分支',()=>expect(storyPlanErrors(nodes,edges)).toEqual([]));
 it('创建和运行均允许有出口的回访，拒绝无出口循环',()=>{
  const loop={id:'back',source:'2',target:'1',label:'返回上一幕'};
  for(const check of [storyPlanErrors,validateStory]){
   expect(check(nodes,[...edges,loop])).toEqual([]);
   expect(check(nodes,[...edges.filter(e=>e.target!=='3'),loop])).toEqual(expect.arrayContaining([expect.stringMatching(/无法抵达结局/)]));
  }
 });
 it('旧类型展示为普通节点和结束节点',()=>expect(['choice','scene','ending','photo'].map(storyKind)).toEqual(['scene','scene','end','photo']));
 it('汇合节点只占一个位置且位于最长路径之后',()=>{const placed=layoutStory(nodes,edges);expect(placed).toHaveLength(4);expect(placed.map(n=>n.x)).toEqual([...placed.map(n=>n.x)].sort((a,b)=>a-b));expect(new Set(placed.map(n=>n.x)).size).toBe(4);});
 it('事件只匹配当前来源和有效目标',()=>{const events=[{...edges[2],trigger:'videoEnd' as const},{...edges[3],trigger:'photoConfirm' as const}];expect(storyRoute(events,'1','videoEnd')?.target).toBe('2');expect(storyRoute(events,'2','videoEnd')).toBeUndefined();});
});

import {cloneWork,collectAssetSources} from '../src/domain/logic';
import {workDependencyError} from '../src/domain/resource-permissions';
import {createSceneWork} from '../src/domain/scenes';
it('复制影片保留控件事件关联并对叠加素材执行权限检查',()=>{
 const base=createSceneWork({title:'层级',kind:'story',type:'媒体叙事型',width:1280,height:720,styleId:'',blank:true});
 const layer={id:'bg',name:'私有图片',kind:'image' as const,text:'',x:0,y:0,width:100,height:100,src:'idb:missing',assetId:'missing'};
 const work={...base,storyNodes:[{...nodes[0],layers:[layer]}],storyEdges:[{...edges[0],layerId:layer.id,target:'',stay:true,trigger:'layerClick' as const,effects:[{id:'fx',kind:'hide' as const,layerId:layer.id}]}]};
 const copy=cloneWork(work),id=copy.storyNodes![0].layers![0].id;
 expect(id).not.toBe(layer.id);expect(copy.storyEdges![0]).toMatchObject({layerId:id,target:'',effects:[{kind:'hide',layerId:id}]});
 expect(collectAssetSources(copy)).toContain(layer.src);expect(workDependencyError([],copy,'personal')).toBeTruthy();
});
