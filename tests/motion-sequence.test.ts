import {describe,it,expect} from 'vitest';
import type {SceneNode} from '../src/domain/types';
import {focusCamera,fromLegacy,readSequences,storeSequences,lengthOf,sampleStyle,presetGroups,makeClip,stamp,resizeClip,moveClip,tidyJoins,sample,canJoin} from '../src/domain/motion-sequence';

describe('动效录制与片段编排',()=>{
 it('中途首次打点补起点，独立保存属性和后续帧',()=>{
  const a=makeClip('photo','无动效',4);
  const b=stamp(stamp(a,'x',2,30),'opacity',3,.4);
  expect(b.keys.x?.map(k=>[k.t,k.v])).toEqual([[0,0],[2,30]]);
  expect(b.keys.opacity?.map(k=>k.t)).toEqual([0,3]);
  expect(sample(b,2).x).toBe(30);
  expect(a.keys.x).toBeUndefined();
 });
 it('缩短保护中间帧，右缘只移动末端帧',()=>{
  const c=stamp(stamp(makeClip('photo','无动效',10),'scale',4,1.3),'scale',10,1);
  expect(resizeClip(c,12).keys.scale?.map(k=>k.t)).toEqual([0,4,12]);
  expect(resizeClip(c,2).duration).toBeGreaterThan(4);
 });
 it('换轨仍阻止同对象重叠，移开即清除接缝',()=>{
  const a=makeClip('a','淡入',2), b={...makeClip('a','淡出',2),start:2};
  expect(moveClip([a,b],b.id,1,2)).toEqual([a,b]);
  expect(canJoin(a,b)).toBe(true);
  expect(tidyJoins(moveClip([a,b],b.id,3,0),[{left:a.id,right:b.id,preset:'交叉淡化'}])).toEqual([]);
 });
});
describe('作品旧数据、预设、逐帧取值',()=>{
 it('打开旧视频运镜仍使用整页并可保存多个独立触发，不改原动效',()=>{
  const node={id:'v',type:'video',motion:{preset:'页面推进',delay:1,duration:10,easing:'linear',hold:true,keyframes:[{time:2,x:45,opacity:.8}]}} as SceneNode;
  const seq=fromLegacy(node);expect(seq.clips[0].target).toBe('@page');expect(seq.binding).toBe('videoStart');expect(seq.mediaAuto).toBe(true);expect(lengthOf(seq)).toBe(11);
  const next=storeSequences(node.motion,[seq,{...seq,binding:'go'}]);expect(readSequences({...node,motion:next})).toHaveLength(2);expect(node.motion?.sequences).toBeUndefined();
  expect(readSequences({id:'t',type:'text'} as SceneNode)[0].binding).toBe('click');expect(storeSequences(undefined,[]).sequences).toEqual([]);
 });
 it('所有18个预设能在起点、终点正确取值，揭示类限制显示区域',()=>{
  const presets=Object.values(presetGroups).flat();expect(presets).toHaveLength(18);
  for(const preset of presets){const c=makeClip('p',preset,2);for(const time of [-.1,0,1,2,4]){const style=sampleStyle(c,time);expect(style.transform).not.toContain('NaN');expect(Number(style.opacity)).toBeGreaterThanOrEqual(0)}}
  expect(sampleStyle(makeClip('p','方向擦除',2),0).clipPath).toContain('100%');expect(sampleStyle(makeClip('p','圆形揭示',2),0).clipPath).toContain('0%');
 });
 it('独立宽高、插值及保持在按比例缩放外工作',()=>{
  let c=makeClip('p','无动效',2);c=stamp(stamp(c,'width',2,50),'height',2,40);expect(sampleStyle(c,2)).toMatchObject({width:'calc(100% + 50px)',height:'calc(100% + 40px)'});
  for(const [ease,w] of [['linear',25],['easeIn',12.5],['easeOut',37.5],['hold',0]] as const){const n=stamp(c,'width',0,0,ease);expect(sample(n,1).width).toBe(w);expect(sample(n,2).width).toBe(50)}
  expect(moveClip([c],'missing',2,0)).toEqual([c]);expect(moveClip([c],c.id,-2,1)[0]).toMatchObject({track:1,start:0});
 });
});

it('十秒镜头向视频区域推进、停留并复位，不移动视频自身',()=>{
 const clip=focusCamera(makeClip('@page','镜头推进',10),{x:1500,y:600,w:200,h:120},{width:1920,height:1080});
 expect(clip.keys.scale?.map(k=>k.t)).toEqual([0,2,8,10]);
 expect(sample(clip,3).x).toBeLessThan(0);expect(sample(clip,3).y).toBeLessThan(0);
 expect(sample(clip,6)).toEqual(sample(clip,2));expect(sample(clip,10)).toMatchObject({scale:1,x:0,y:0});
});
