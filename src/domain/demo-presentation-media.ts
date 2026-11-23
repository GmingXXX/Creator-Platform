import type {Asset} from './types';
import type {PresentationPlan,PresentationGenerationInput} from './presentation-generation';
import {assetAvailableForAI,assetAvailableForInsertion} from './asset-access';
import {getAssetMetadata} from './asset-metadata';

const preparedPages=[
 {title:'从感知到协同',filename:'01-enterprise.png',label:'企业数字协同'},
 {title:'企业发展历程',filename:'02-history.png',label:'企业成长历程'},
 {title:'三项核心能力',filename:'03-capabilities.png',label:'感知平台与数字孪生'},
 {title:'示范产线实践',filename:'04-production.png',label:'柔性装配产线'},
 {title:'绿色运营实践',filename:'05-energy.png',label:'绿色能源运营'},
 {title:'业务与服务布局',filename:'06-service.png',label:'研发与服务网络'},
] as const;
const liveTitles=['储能监测案例','下一阶段的方向'];
const titles=[...preparedPages.map(page=>page.title),...liveTitles];
export const demoPresentationFiles=preparedPages.map(page=>({
 name:`${page.title}_${page.label}_预置概念图.png`,path:page.filename,
 url:`/demo-inputs/v3/presentation/${page.filename}`,mime:'image/png',
}));
export function isDemoPresentationRequest(input:Pick<PresentationGenerationInput,'kind'|'quantity'|'files'|'workspaceId'>):boolean{
 const outline='星澜智造_智能演示大纲.pptx';
 return input.kind==='presentation'&&input.quantity===8&&input.files.some(({asset})=>{
  if(!assetAvailableForAI(asset,input.workspaceId))return false;
  const params=asset.package?.params;
  return params?.demoInputKey===`v1:presentation:${outline}`||
   (params?.knowledgeCatalogId==='zhichuang-20261116'&&params.knowledgeCase==='presentation'&&params.knowledgePath===outline);
 });
}
const normalize=(value:string)=>value.replace(/[\s\p{P}\p{S}]/gu,'');
const pageIndex=(title:string)=>titles.findIndex(expected=>normalize(title).includes(normalize(expected)));
function sourcePage(asset:Asset){
 const params=asset.package?.params;
 return preparedPages.findIndex(page=>params?.demoInputKey===`v3:presentation:${page.filename}`||
  (params?.knowledgeCatalogId==='zhichuang-20261116'&&params.knowledgeCase==='presentation'&&params.knowledgePath===page.filename));
}
function available(asset:Asset,workspaceId:string){
 return asset.kind==='image'&&assetAvailableForAI(asset,workspaceId)&&assetAvailableForInsertion(asset,workspaceId)&&getAssetMetadata(asset).business.usage!=='reference';
}
export function demoPresentationMediaContext(images:Asset[],workspaceId:string){
 const prepared=preparedPages.flatMap((page,index)=>{
  const asset=images.find(item=>sourcePage(item)===index&&available(item,workspaceId));
  return asset?[{title:page.title,imageAssetId:asset.id}]:[];
 });
 return prepared.length?{prepared,generate:liveTitles,note:'本案例保留原大纲8页标题，前6页按标题使用预置概念图；储能监测案例、下一阶段的方向不复用配图，留待实时生成。概念图不是客户实景。'}:undefined;
}
/** Applied only to the complete eight-section demo outline, before the user reviews or edits it. */
export function applyDemoPresentationMedia(plan:PresentationPlan,images:Asset[],workspaceId:string,knownDemoRequest=false):PresentationPlan{
 const indexes=plan.sections.map(section=>pageIndex(section.title));
 const completeTitles=indexes.every(index=>index>=0)&&new Set(indexes).size===8;
 if(plan.sections.length!==8||(!knownDemoRequest&&!completeTitles)||!images.some(asset=>sourcePage(asset)>=0))return plan;
 // The verified demo outline has a fixed order; model wording can vary.
 const targets=completeTitles?indexes:plan.sections.map((_,index)=>index);
 return {...plan,sections:plan.sections.map((section,index)=>{
  const target=targets[index],asset=target<preparedPages.length?images.find(item=>sourcePage(item)===target&&available(item,workspaceId)):undefined;
  const {imageAssetId:unused,...rest}=section;
  return asset?{...rest,imageAssetId:asset.id,layout:'split' as const}:rest;
 })};
}
