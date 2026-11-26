import {describe,it,expect} from 'vitest';
import type {SceneNode,Work,DesignSystem} from '../src/domain/types';
import {resizeProject,applyProjectStyle} from '../src/features/editor/project-appearance-domain';
const text={id:'left',type:'text',name:'介绍',x:40,y:50,w:400,h:200,content:'文字',fontSize:32,color:'#111111',background:'transparent'} as SceneNode;
const photo={...text,type:'image',id:'right',x:550,w:400,h:200,src:'photo.jpg'} as SceneNode;
const project={width:1000,height:500,pages:[{id:'page',name:'首页',background:'#ffffff',backgroundImage:'upload.jpg',nodes:[text,photo]}],storyNodes:[{x:120,y:290,id:'node'}]} as Work;
describe('project appearance',()=>{
 it('reflows independent columns into portrait rows while preserving media ratio, identities and flow coordinates',()=>{
  const resized=resizeProject(project,500,1000),[a,b]=resized.pages[0].nodes;
  expect(b.y).toBeGreaterThanOrEqual(a.y+a.h); expect(b.w/b.h).toBeCloseTo(2,1);expect(b.id).toBe('right'); expect(resized.storyNodes).toEqual(project.storyNodes);expect(text.x).toBe(40);
 });
 it('keeps overlay buttons aligned with media when the screen orientation changes',()=>{
  const overlay={...text,id:'hotspot',x:750,y:150,w:20,h:20};
  const input={...project,pages:[{...project.pages[0],nodes:[text,photo,overlay]}]};
  const [,image,hotspot]=resizeProject(input,500,1000).pages[0].nodes;
  expect((hotspot.x-image.x)/image.w).toBeCloseTo(.5,1);expect((hotspot.y-image.y)/image.h).toBeCloseTo(.5,1);
 });
 it('retains authored color and uploaded background while inheriting theme defaults',()=>{
  const prior={id:'a',text:'#111111',background:'#ffffff',accent:'#ab4321',font:'Inter'} as DesignSystem;
  const next={...prior,id:'b',text:'#dddddd',background:'#000000'};
  const input={...project,pages:[{...project.pages[0],nodes:[text,{...text,color:'#f11515',id:'custom'}]}]};
  const changed=applyProjectStyle(input,next,prior);
  expect(changed.pages[0].backgroundImage).toBe('upload.jpg');expect(changed.pages[0].nodes.map(n=>n.color)).toEqual(['#dddddd','#f11515']);expect(input.pages[0].nodes[0].color).toBe('#111111');
 });
 it('rejects invalid sizes and retains geometry for same-size changes',()=>{
  expect(()=>resizeProject(project,0,1000)).toThrow();expect(resizeProject(project,1000,500)).toBe(project);
 });
});
it('sizes node content in the output frame and leaves the flow layout untouched',()=>{
 const input={...project,storyNodes:[{id:'scene',x:280,y:260,title:'节点',text:'',type:'scene',layers:[{id:'a',kind:'image' as const,name:'背景',text:'',x:0,y:0,width:100,height:100}]}]};
 expect(resizeProject(input,500,1000).storyNodes?.[0]).toMatchObject({x:280,y:260,layers:[{id:'a',width:100,height:100}]});
 expect(()=>resizeProject(input,80,120)).toThrow();
});

import {motionReviewItems} from '../src/features/editor/project-appearance-domain';
import {makeClip} from '../src/domain/motion-sequence';
const clip={...makeClip('right','无动效',2),keys:{x:[{t:1,v:400}],y:[{t:1,v:-160}],width:[{t:2,v:120}],height:[{t:2,v:60}],rotation:[{t:2,v:90}],scale:[{t:2,v:1.4}],opacity:[{t:2,v:.5}]}};
const animated={...project,width:1920,height:1080,pages:[{...project.pages[0],nodes:[{...text,motion:{preset:'向上移入',duration:2,hold:true,delay:1,easing:'linear',keyframes:[{time:1,x:400,opacity:.5}],sequences:[{binding:'click',when:'together' as const,hold:true,clips:[clip],joins:[]}]}},photo]}]};
it('maps legacy and multi-target motion pixel tracks to a half-size screen, leaving time, angle and opacity unchanged',()=>{
 const motion=resizeProject(animated,960,540).pages[0].nodes[0].motion!;
 expect(motion.keyframes).toEqual([{time:1,x:200,opacity:.5}]);
 const keys=motion.sequences![0].clips[0].keys;
 expect(Object.fromEntries(Object.entries(keys).map(([prop,frames])=>[prop,frames[0].v]))).toEqual({x:200,y:-80,width:60,height:30,rotation:90,scale:1.4,opacity:.5});
 expect(keys.width![0].t).toBe(2);expect(clip.keys.x[0].v).toBe(400);
});
it('names motion owners for review when changing orientation and omits them when scaling proportionally',()=>{
 expect(motionReviewItems(animated,1080,1920)).toEqual(['首页 · 介绍']);
 expect(motionReviewItems(animated,960,540)).toEqual([]);expect(motionReviewItems(project,500,1000)).toEqual([]);
});
