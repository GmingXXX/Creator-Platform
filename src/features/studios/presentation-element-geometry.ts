import type {SceneNode} from '../../domain/types';
type Box=Pick<SceneNode,'x'|'y'|'w'|'h'|'rotation'>;
export type ResizeCorner='nw'|'ne'|'sw'|'se';
const round=(value:number)=>Math.round(value*10)/10;
export const movePresentationElement=(box:Box,dx:number,dy:number,scale:number)=>({x:round(box.x+dx/scale),y:round(box.y+dy/scale)});
export function resizePresentationElement(box:Box,corner:ResizeCorner,dx:number,dy:number,scale:number,keepRatio:boolean){
 const angle=box.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
 const localX=(dx*cos+dy*sin)/scale,localY=(-dx*sin+dy*cos)/scale;
 const sx=corner.endsWith('e')?1:-1,sy=corner.startsWith('s')?1:-1;
 let w=Math.max(20,box.w+sx*localX),h=Math.max(20,box.h+sy*localY);
 if(keepRatio){const ratio=box.w/box.h;const factor=Math.abs(localX/box.w)>=Math.abs(localY/box.h)?(box.w+sx*localX)/box.w:(box.h+sy*localY)/box.h;w=Math.max(20,20*ratio,box.w*factor);h=w/ratio;}
 const shiftX=sx*(w-box.w)/2,shiftY=sy*(h-box.h)/2;
 return {x:round(box.x+(box.w-w)/2+shiftX*cos-shiftY*sin),y:round(box.y+(box.h-h)/2+shiftX*sin+shiftY*cos),w:round(w),h:round(h)};
}
