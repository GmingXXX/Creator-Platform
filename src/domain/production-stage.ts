import type {Work} from './types';
export type ProductionStage='presales'|'delivery';
export const productionStages={
 presales:{label:'售前样稿',description:'快速确认内容方向与体验，概念素材和待补信息明确标记。'},
 delivery:{label:'正式交付',description:'核对客户事实、素材授权与运行效果，完成交付检查。'},
} as const;
export function productionStageOf(work:Pick<Work,'productionStage'|'creationPackage'>):ProductionStage {
 if(work.productionStage)return work.productionStage;
 return work.creationPackage?.params.productionStage==='delivery'||work.creationPackage?.prompt.includes('制作阶段：正式交付')?'delivery':'presales';
}
export function withProductionStage(work:Work,stage:ProductionStage):Work {
 return {...work,productionStage:stage,deliveryReview:undefined,creationPackage:work.creationPackage?{...work.creationPackage,params:{...work.creationPackage.params,productionStage:stage}}:undefined};
}
export function productionStagePrompt(prompt:string,stage?:ProductionStage):string {
 if(!stage)return prompt;
 const guidance=stage==='presales'?'优先做出可体验的整体方案。概念素材与待补信息明确标记，不得编造客户事实、证书或案例成果。':'以已提供的客户资料为依据，保留来源；缺少信息标记待补，素材权利与授权不得自行认定。生成后仍需人工检查内容、交互和目标设备运行效果。';
 return `${prompt}\n\n制作阶段：${productionStages[stage].label}。${guidance}`;
}
export function deliveryChecks(work:Pick<Work,'kind'>){
 return [{id:'facts',label:'客户事实、指标与来源已核对'},{id:'rights',label:'图片、视频、字体等素材使用范围已确认'},
  ...(work.kind==='presentation'?[{id:'narration',label:'讲解配音、问答范围与资料依据已核对'}]:[]),
  {id:'interaction',label:work.kind==='story'?'故事分支、结局与媒体播放已验证':'页面、交互与展示顺序已验证'},
  {id:'device',label:'已在目标屏幕、设备与部署环境中试运行'}];
}
export function reviewedDeliveryChecks(work:Pick<Work,'revision'|'deliveryReview'>):string[]{
 return work.deliveryReview?.revision===work.revision?work.deliveryReview.checks:[];
}
