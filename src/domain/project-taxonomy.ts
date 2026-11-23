import type {Asset,Work} from './types';
import {exhibitTypes} from './scenes';

/** null is an explicit unclassified choice; undefined preserves legacy classifications. */
export function getWorkDisplayForm(work:Pick<Work,'type'|'displayForm'>):Work['type']|null {
 const form=work.displayForm===undefined?work.type:work.displayForm;
 return form&&exhibitTypes.includes(form)?form:null;
}
export function publicationCategoryError(work:Work):string|undefined {
 if(work.kind==='exhibit'&&!getWorkDisplayForm(work)&&!getWorkPurposes(work).length)
  return '展示内容和展示形式至少填写一项，方便团队发现和复用模板。';
}


export type ProjectCategory='interactive'|'presentation-video'|'interactive-film';
export const projectCategories:{id:ProjectCategory;label:string}[]=[
 {id:'interactive',label:'交互页面'},
 {id:'presentation-video',label:'智能演示'},
 {id:'interactive-film',label:'互动影片'},
];
export const contentPurposes=[
 {id:'overview',label:'企业概览',description:'企业介绍、业务构成与总体实力'},
 {id:'history',label:'发展历程',description:'企业历史、大事记与阶段突破'},
 {id:'honors',label:'荣誉资质',description:'奖项、认证与资质证书'},
 {id:'products',label:'产品与服务',description:'产品系列、服务体系与解决方案'},
 {id:'innovation',label:'技术创新',description:'核心技术、研发能力与创新成果'},
 {id:'cases',label:'案例成果',description:'代表项目、客户案例与应用效果'},
 {id:'locations',label:'产业与业务布局',description:'基地、分支机构与国内外业务分布'},
 {id:'ecosystem',label:'产业链与合作生态',description:'上下游、供应链与伙伴关系'},
 {id:'process',label:'工艺与业务流程',description:'生产工序、实施步骤与服务流程'},
 {id:'data',label:'经营与发展数据',description:'规模、产能、增长与业务指标'},
 {id:'culture',label:'文化与人物',description:'企业文化、党建、创始人与专家团队'},
 {id:'knowledge',label:'文博与知识科普',description:'文物藏品、专题知识与原理介绍'},
];
export function getProjectCategory(work:Pick<Work,'kind'>):ProjectCategory {
 return work.kind==='story'?'interactive-film':work.kind==='presentation'||work.kind==='video'?'presentation-video':'interactive';
}
const purposeMatchers:Record<string,RegExp>={overview:/企业介绍|企业概览|公司简介|业务概况/,history:/历程|历史|大事记|成长史/,
 honors:/荣誉|资质|认证|证书/,products:/产品|服务体系|解决方案/,innovation:/技术|研发|创新|专利/,
 cases:/案例|标杆项目|代表项目/,locations:/布局|分布|基地|网点|业务版图/,ecosystem:/产业链|供应链|合作生态|合作伙伴/,
 process:/工艺|工序|流程/,data:/数据|经营|产能|指标|驾驶舱/,culture:/文化|人物|党建|创始人|专家|团队/,
 knowledge:/文博|文物|藏品|科普|博物馆|知识探索/};
export function getWorkPurposes(work:Pick<Work,'title'|'type'|'contentPurposes'|'displayForm'>):string[] {
 if(work.contentPurposes)return [...new Set(work.contentPurposes)].filter(id=>contentPurposes.some(item=>item.id===id));
 if(work.displayForm===null)return [];
 const matched=contentPurposes.filter(item=>purposeMatchers[item.id].test(work.title)).map(item=>item.id);
 if(matched.length)return matched;
 const fallback:Partial<Record<Work['type'],string>>={'时间演进型':'history','空间分布型':'locations','流程架构型':'process','数据总览型':'data'};
 return fallback[work.type]?[fallback[work.type]!]:[];
}
export type MaterialCategory='image'|'video'|'audio'|'component'|'document';
/** Legacy engineering indexes stay available for links and dependencies, not as library cards. */
export function isLibraryAsset(asset:Asset):boolean {
 return !asset.sourceWorkId&&!asset.workSnapshot&&asset.presentationRole!=='project-source';
}
export function getAssetCategory(asset:Asset):MaterialCategory|undefined {
 if(!isLibraryAsset(asset))return undefined;
 return asset.kind==='html'?'component':asset.kind==='presentation'?'document':asset.kind;
}
export function resolveAssetProject(asset:Asset,works:Work[]):Work|undefined {
 if(asset.public)return asset.workSnapshot;
 return (asset.sourceWorkId?works.find(work=>work.id===asset.sourceWorkId&&(work.workspaceId||'personal')===(asset.workspaceId||'personal')):undefined)||asset.workSnapshot;
}
