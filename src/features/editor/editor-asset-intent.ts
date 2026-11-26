import {createContext} from 'react';
import {isWorkBackgroundRequest} from '../../domain/work-background-request';
export type AssetRequestKind='image'|'video'|'component';
export interface StandaloneAssetRequest {id:string;kind:AssetRequestKind;prompt:string;model:string;targetId?:string}
export const StandaloneAssetContext=createContext<((request:StandaloneAssetRequest)=>void)|undefined>(undefined);
export function assetRequestKind(text:string,hasBackground=false):AssetRequestKind|undefined{
 if(/替换|改成|换成|插入|添加到|换掉|修改/.test(text))return;
 if(isWorkBackgroundRequest(text,hasBackground))return 'image';
 const match=text.match(/(?:生成|制作|帮我做|画|设计|创作|做)(?:一[个张段幅款套])?[^。！？\n]{0,30}?(图片|插画|封面|海报|背景图|背景素材|视频|短片|组件|控件)/);
 if(!match)return;
 return /视频|短片/.test(match[1])?'video':/组件|控件/.test(match[1])?'component':'image';
}
