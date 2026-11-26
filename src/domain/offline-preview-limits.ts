import type {Work} from './types';
export function offlinePreviewLimits(work:Work):string[]{
 const nodes=work.pages.flatMap(p=>p.nodes);
 const rules=nodes.flatMap(n=>n.interactions||[]);
 return [
  work.pages.some(p=>p.interactions?.length)&&'页面进入、无操作或访问进度规则',
  rules.some(r=>!['click','videoStart'].includes(r.event)||r.conditionId||r.requiredVisitedIds?.length||r.steps?.length)&&'带条件、多动作或媒体暂停、结束的交互',
  nodes.some(n=>n.motion?.sequences?.length)&&'多轨关键帧、跨对象动效与转场',
  nodes.length>0&&'组件自带的默认语音指令',
  nodes.some(n=>n.variant)&&'新增组件样式与内置行为',
 ].filter((v):v is string=>typeof v==='string');
}
