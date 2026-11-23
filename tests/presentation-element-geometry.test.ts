import {describe,expect,it} from 'vitest';
import {movePresentationElement,resizePresentationElement} from '../src/features/studios/presentation-element-geometry';
const box={x:100,y:80,w:400,h:200,rotation:0};
describe('presentation element gestures',()=>{
 it('converts pointer movement from zoomed pixels into scene coordinates',()=>{expect(movePresentationElement(box,30,-10,.5)).toEqual({x:160,y:60});expect(box.x).toBe(100)});
 it('resizes from a corner while anchoring the opposite corner',()=>{expect(resizePresentationElement(box,'nw',40,20,1,false)).toEqual({x:140,y:100,w:360,h:180})});
 it('keeps image ratio and clamps minimum size without flipping',()=>{expect(resizePresentationElement(box,'se',100,10,1,true)).toEqual({x:100,y:80,w:500,h:250});const small=resizePresentationElement(box,'nw',900,900,1,true);expect(small.w/small.h).toBe(2);expect(small.h).toBeGreaterThanOrEqual(20);expect(small.x+small.w).toBe(500)});
 it('uses the element local axes for rotated resizing',()=>{const result=resizePresentationElement({...box,rotation:90},'se',0,40,1,false);expect(result.w).toBe(440);expect(result.h).toBe(200);expect(result.x).toBe(80);expect(result.y).toBe(100)});
});
