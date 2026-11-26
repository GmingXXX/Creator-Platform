import type {Interaction,NodeKind,SceneNode,VoiceCommand} from '../../domain/types';
type Family={name:string;type:NodeKind;variants:string[]};
const group=(name:string,type:NodeKind,...variants:string[]):Family=>({name,type,variants});
export const componentCatalog=[
 {title:'基础组件',families:[group('文本','text'),group('图片','image'),group('视频','video'),group('音频','audio'),group('交互控件','button','文字按钮','图标按钮','返回按钮','开关','选项组','分页导航'),group('AI 语音控件','bubble','AI 语音流式气泡','半身数字人','全身数字人','语音波形图标','麦克风图标')]},
 {title:'复合组件',families:[group('卡片','card','图文卡片','人物卡片'),group('弹窗','card','详情弹窗','图片弹窗'),group('时间轴','timeline','横向时间轴','鱼骨时间轴'),group('轨道图','timeline','单轨轨道图','双轨轨道图'),group('树状关系图','graph','组织树','层级关系树'),group('照片流','gallery','网格照片流','错落照片流'),group('热点图','map','地图热点','场景热点'),group('流程架构图','flow','步骤流程','分组架构'),group('数据看板','chart','指标看板','对比看板')]},
 {title:'装饰组件',families:[group('形状','shape','矩形','圆形','三角形'),group('图标','shape','方向箭头','星形标记'),group('蒙版','shape','渐变蒙版','圆形蒙版'),group('边框','shape','细线边框','虚线边框'),group('其他','shape','分隔线','点阵纹理')]}
];
export function applyPreset(node:SceneNode,variant?:string):SceneNode {
 if(!variant||!componentCatalog.some(g=>g.families.some(f=>f.type===node.type&&f.variants.includes(variant))))return node;
 const graph=node.type==='graph'&&node.items?.length?{items:node.items.map((v,i)=>({...v,parentId:i?(variant==='组织树'?node.items![0]:node.items![i-1]).id:undefined}))}:{};
 return {...node,...graph,variant,name:variant,content:node.type==='button'?variant==='开关'?'开启':variant==='图标按钮'?'→':'探索更多':node.content,...(variant==='鱼骨时间轴'?{timelineLayout:'fishbone' as const}:{}),...(variant==='错落照片流'?{columns:2}:{}),...(node.type==='shape'?{w:220,h:variant==='分隔线'?6:220,radius:0,background:'transparent'}:{})};
}
export const eventNames:Record<Interaction['event'],string>={click:'访客点击',videoStart:'开始播放',videoPause:'暂停播放',videoEnd:'播放结束',pageEnter:'进入页面',idle:'连续无操作',allVisited:'指定卡片已全部点开'};
export function eventsFor(type:NodeKind|'page'):Interaction['event'][]{
 if(type==='page')return ['pageEnter','idle','allVisited'];
 return type==='video'||type==='audio'?['click','videoStart','videoPause','videoEnd']:['click'];
}
export const actionNames:Record<Interaction['action'],string>={detail:'打开详情',navigate:'跳转页面',show:'显示组件',hide:'隐藏组件',toggle:'切换显隐',state:'切换状态 / 播放动效',play:'播放 / 暂停',resume:'播放',pause:'暂停',stop:'停止',restart:'从头播放'};
export function availableCommands(node:SceneNode):VoiceCommand[]{
 const media=node.type==='video'?'视频':node.type==='audio'?'音频':'';
 const actions:Interaction['action'][]=media?['resume','pause','stop','restart']:node.variant?.endsWith('弹窗')?['show','hide']:node.type==='shape'?['show','hide']:['detail'];
 const defaults=actions.map(action=>({id:node.id+'-default-'+action,phrase:(action==='restart'?'重新播放':actionNames[action])+(media||node.name),aliases:'',enabled:true,scope:'page' as const,action,targetId:node.id}));
 return [...defaults.map(c=>node.commands?.find(x=>x.id===c.id)||c),...(node.commands||[]).filter(c=>!defaults.some(d=>d.id===c.id))];
}
export function ruleWarnings(rule:Interaction,page:{id:string;nodes:SceneNode[]},work:{pages:{id:string}[]},node?:SceneNode):string[]{
 const steps=[rule,...rule.steps||[]],messages:string[]=[];
 for(const [i,step] of steps.entries()){
  const target=step.targetId||node?.id;
  if(step.action==='navigate'?!work.pages.some(p=>p.id===step.targetId):!page.nodes.some(n=>n.id===target))messages.push('第 '+(i+1)+' 个动作需要有效的目标');
  if(step.additionalTargetIds?.some(id=>!page.nodes.some(n=>n.id===id)))messages.push('附加目标已删除，请重新选择');
  if(['resume','pause','stop','restart','play'].includes(step.action)&&!page.nodes.some(n=>n.id===target&&(n.type==='video'||n.type==='audio')))messages.push('请选择视频或音频作为播放目标');
  if(step.action==='navigate'&&i<steps.length-1)messages.push('请把跳转页面放在最后');
  if(rule.event==='pageEnter'&&step.action==='navigate'&&step.targetId===page.id)messages.push('进入页面时不能再次跳转到本页');
  if(steps.slice(0,i).some(s=>(s.targetId||node?.id)===target&&((step.action==='show'&&s.action==='hide')||(step.action==='hide'&&s.action==='show'))))messages.push('同一目标同时配置了显示与隐藏');
 }
 return messages;
}
