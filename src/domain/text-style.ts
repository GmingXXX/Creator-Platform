import type {CSSProperties} from 'react';
import type {SceneNode,TextAppearance} from './types';
/** Local font stacks work without remote font services; availability follows the device. */
export const fontOptions=[
 {label:'系统默认',value:''},
 {label:'无衬线（黑体）',value:'sans-serif'},
 {label:'衬线（宋体）',value:'serif'},
 {label:'等宽字体',value:'monospace'},
 {label:'Arial',value:'Arial, sans-serif'},
];
export function resolveFontFamily(font?:string):string|undefined {
 if(!font)return undefined;
 const descriptive:Record<string,string>={
  '现代无衬线':'"PingFang SC", "Microsoft YaHei", sans-serif',
  '几何无衬线':'Arial, "PingFang SC", sans-serif',
  '端正黑体':'"PingFang SC", "Microsoft YaHei", sans-serif',
  '宋体与现代黑体':'"Songti SC", SimSun, serif',
  '优雅衬线与无衬线':'Georgia, "Songti SC", serif',
 };
 return descriptive[font]||font;
}
function appearanceStyle(style:TextAppearance):CSSProperties {
 return {
  ...(style.fontFamily?{fontFamily:resolveFontFamily(style.fontFamily)}:{}),
  ...(Number.isFinite(style.fontSize)&&style.fontSize!>0?{fontSize:style.fontSize}:{}),
  ...(Number.isFinite(style.fontWeight)&&style.fontWeight!>=100&&style.fontWeight!<=900?{fontWeight:style.fontWeight}:{}),
  ...(['left','center','right','justify'].includes(style.textAlign||'')?{textAlign:style.textAlign}:{}),
  ...(Number.isFinite(style.lineHeight)&&style.lineHeight!>0?{lineHeight:style.lineHeight}:{}),
  ...(style.color?{color:style.color}:{}),
 };
}
export function nodeTypographyStyle(node:SceneNode):CSSProperties {
 return appearanceStyle({fontFamily:node.fontFamily,fontWeight:node.fontWeight,textAlign:node.textAlign,lineHeight:node.lineHeight});
}
export function textRoleStyle(node:SceneNode,role:'title'|'body'):CSSProperties {
 return {...nodeTypographyStyle(node),...appearanceStyle(node[role==='title'?'titleStyle':'bodyStyle']||{})};
}

/** Changing the whole compound element's size/color applies to both visible text roles. */
export function wholeTextPatch(node:SceneNode,patch:Partial<SceneNode>):Partial<SceneNode> {
 const rolePatch={...(patch.fontSize!==undefined?{fontSize:patch.fontSize}:{}),...(patch.color!==undefined?{color:patch.color}:{})};
 if(!['card','gallery','timeline','graph','map','flow','chart','bubble'].includes(node.type)||!Object.keys(rolePatch).length)return patch;
 return {...patch,titleStyle:{...node.titleStyle,...rolePatch},bodyStyle:{...node.bodyStyle,...rolePatch}};
}
