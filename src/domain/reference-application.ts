import {referenceHasScopeConstraint,type ExhibitReference} from './exhibit-references';
import type {ExhibitType,NodeKind,Work} from './types';
const nativeTypes:Partial<Record<NodeKind,ExhibitType>>={timeline:'时间演进型',gallery:'卡片浏览型',card:'卡片浏览型',map:'空间分布型',graph:'关系图谱型',flow:'流程架构型',chart:'数据总览型'};

// Freeform local/exclusion requirements cannot safely become a whole-work override.
const promptHasScopeConstraint=(prompt:string)=>/仅|局部|只(?:参考|借鉴|应用|采用|修改)|保留|不要|不改变|不修改|不应用|except|only|preserve/i.test(prompt);

/** Explicit requirements take precedence; unsupported or competing patterns remain references. */
export function referenceExhibitType(prompt:string,references:ExhibitReference[],fallback:ExhibitType):{type:ExhibitType;referenceId?:string}{
 if(/时间轴|鱼骨|时间演进|卡片|案例墙|荣誉墙|地图|空间分布|图谱|流程图|看板|数据总览/.test(prompt))return {type:fallback};
 if(promptHasScopeConstraint(prompt))return {type:fallback};
 const candidates=references.filter(ref=>ref.dimension==='interaction');
 if(candidates.length!==1||referenceHasScopeConstraint(candidates[0]))return {type:fallback};
 const patterns=[...new Set(candidates[0].snapshot.nodeTypes.map(type=>nativeTypes[type]).filter((type):type is ExhibitType=>Boolean(type)))];
 return patterns.length===1?{type:patterns[0],referenceId:candidates[0].id}:{type:fallback};
}

/** Apply only supported properties. Reference content, media and arbitrary events are never copied. */
export function applyCreationReferences(work:Work,references:ExhibitReference[],options:{preserveColors?:boolean;interactionId?:string;prompt?:string}={}):Work{
 const visualRefs=references.filter(ref=>ref.dimension==='ui');
 const visual=visualRefs.length===1&&!referenceHasScopeConstraint(visualRefs[0])&&!promptHasScopeConstraint(options.prompt||'')?visualRefs[0]:undefined;
 const tokens=visual?.snapshot.visuals;
 const validColor=(value:unknown):value is string=>typeof value==='string'&&/^(#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i.test(value);
 const radius=typeof tokens?.radius==='number'&&Number.isFinite(tokens.radius)?Math.max(0,Math.min(200,tokens.radius)):undefined;
 const textColor=!options.preserveColors&&validColor(tokens?.text)?tokens.text:undefined;
 const background=!options.preserveColors&&validColor(tokens?.background)?tokens.background:undefined;
 const accent=!options.preserveColors&&validColor(tokens?.accent)?tokens.accent:undefined;
 const eligibleNodes=work.pages.flatMap(page=>page.nodes).filter(node=>!node.locked);
 const fontSize=typeof tokens?.fontSize==='number'&&Number.isFinite(tokens.fontSize)?Math.max(8,Math.min(250,tokens.fontSize)):undefined;
 const currentHeading=Math.max(0,...eligibleNodes.filter(node=>node.type==='text').map(node=>node.fontSize));
 const hasTypography=fontSize!==undefined&&currentHeading>0;
 const hasRadius=radius!==undefined&&eligibleNodes.some(node=>['card','gallery','button','shape'].includes(node.type));
 const hasText=Boolean(textColor)&&eligibleNodes.some(node=>node.type==='text');
 const hasAccent=Boolean(accent)&&eligibleNodes.some(node=>['timeline','flow','graph','chart','button'].includes(node.type));
 const applied=Boolean(background&&work.pages.length||hasRadius||hasText||hasAccent||hasTypography);
 const pages=!applied?work.pages:work.pages.map(page=>({...page,...(background?{background}:{}),nodes:page.nodes.map(node=>node.locked?node:{...node,
  ...(hasText&&node.type==='text'?{color:textColor}:{}),
  ...(hasTypography&&node.type==='text'?{fontSize:Math.round(Math.max(8,Math.min(250,node.fontSize*fontSize!/currentHeading)))}:{}),
  ...(hasAccent&&['timeline','flow','graph','chart','button'].includes(node.type)?{color:accent}:{}),
  ...(hasRadius&&['card','gallery','button','shape'].includes(node.type)?{radius}:{}),
 })}));
 const adopted=references.map(ref=>{
  if(ref.id===visual?.id&&applied)return {...ref,status:'adopted' as const,adoptionEvidence:`已采用支持的样式属性：${[background?'页面背景':'',hasText?'文字色':'',hasAccent?'强调色':'',hasRadius?'圆角':'',hasTypography?'字号层级':''].filter(Boolean).join('、')}。${options.preserveColors?'保留当前作品配色。':''}布局和动效仍需核对。`};
  if(ref.id===options.interactionId&&!referenceHasScopeConstraint(ref)&&!promptHasScopeConstraint(options.prompt||''))return {...ref,status:'adopted' as const,adoptionEvidence:`按参考选择了${work.type}原生组件；只采用支持的浏览结构，未复制自定义交互。`};
  return {...ref,status:'reference' as const,adoptionEvidence:undefined};
 });
 return {...work,pages,references:structuredClone(adopted),...(work.creationPackage?{creationPackage:{...work.creationPackage,references:structuredClone(adopted)}}:{})};
}
