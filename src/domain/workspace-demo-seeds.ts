import {createNode,systems} from './scenes';
import type {Asset,ContentItem,ExhibitType,ScenePage,Skill,StudioData,Work} from './types';

type DemoTheme={id:string;name:string;style:string;subject:string;topics:[string,string,string];skill:string;steps:string[];form:ExhibitType;second:'presentation'|'story'};
const themes:readonly DemoTheme[]=[
 {id:'xintai',name:'信泰',style:'industrial',subject:'企业成长与智造',topics:['初创探索','技术升级','绿色智造'],skill:'企业成长时间轴编排',steps:['从客户资料提取年份、事件与出处，缺失信息保持待确认','将事件编排为鱼骨时间轴，匹配项目素材并保留详情入口','检查文字长度和时间顺序，不补造真实业绩或荣誉'],form:'时间演进型',second:'presentation'},
 {id:'dongguan',name:'东莞博物馆',style:'culture',subject:'城市记忆与器物故事',topics:['水乡生活','手艺记忆','城市新生'],skill:'器物故事分支策划',steps:['整理器物说明、历史背景与资料出处，区分史实和创作设定','围绕受众设计开场、探索选择与两个结局，并匹配场景素材','检查节点连通性，所有虚构情节明确标注为创作演绎'],form:'卡片浏览型',second:'story'},
 {id:'aitown',name:'AI小镇',style:'technology',subject:'产业协作与智慧生活',topics:['创新研发','场景应用','生态协作'],skill:'产业主题讲解组织',steps:['按受众与接待目标整理产业资料和可引用证据','组织主题、章节、页面和讲稿，区分产业联系与推测关系','使用项目素材配图，检查知识来源与未提供的数据'],form:'关系图谱型',second:'presentation'},
];
const stamp='2026-11-17T00:00:00.000Z';
const disclaimer='模拟演示内容，不代表客户真实事实；正式使用请替换为经确认的资料。';
const path=(id:string,suffix:string)=>`/workspace-demos/${id}-${suffix}`;
const stable=(id:string,name:string)=>`workspace-demo-${id}-${name}`;

function themeAssets(theme:DemoTheme):Asset[]{
 return [['cover.svg','主题视觉示意','image'],['detail.svg','场景插图示意','image'],['brief.md','项目背景资料','document']].map(([file,label,kind],index)=>({
  id:stable(theme.id,`asset-${index+1}`),workspaceId:theme.id,name:`${theme.name} · ${label}（演示）${kind==='document'?'.md':'.svg'}`,kind:kind as Asset['kind'],
  src:path(theme.id,file),preview:path(theme.id,index===1?'detail.svg':'cover.svg'),description:`${theme.subject}的${label}。${disclaimer}`,
  tags:['模拟演示',theme.subject],author:'智创演示团队',createdAt:stamp,source:'builtin',public:false,
  metadata:{analysis:{status:'ready',summary:disclaimer,tags:['模拟演示'],basis:'demo'},business:{note:disclaimer,subject:theme.subject,confirmed:false,usage:'project',allowAi:true}},
 }));
}
function themeSkill(theme:DemoTheme):Skill{
 return {id:stable(theme.id,'skill'),workspaceId:theme.id,personal:true,public:false,enabled:true,source:'builtin',revision:1,
  name:`${theme.skill}（演示）`,description:`用于${theme.name}项目的共享示例方法，可由 Agent 按任务选用。${disclaimer}`,category:theme.second==='story'?'互动影片':'内容策划',
  styleId:theme.style,previewType:theme.second==='story'?'flow':theme.form==='时间演进型'?'timeline':'graph',author:'智创演示团队',version:'1.0',
  input:'已确认的客户资料、展示受众、目标屏幕尺寸与制作要求',steps:theme.steps};
}
function items(theme:DemoTheme,assets:Asset[]):ContentItem[]{
 return theme.topics.map((title,index)=>({id:stable(theme.id,`item-${index}`),title,description:`${title}：演示如何围绕同一主题组织背景、内容和案例。${disclaimer}`,
  ...(theme.form==='时间演进型'?{year:['2000','2012','2026'][index]}:{}),category:theme.subject,image:assets[index%2].src,assetId:assets[index%2].id,
  ...(theme.form==='关系图谱型'&&index>0?{parentId:stable(theme.id,'item-0')}:{}),
 }));
}
function page(theme:DemoTheme,assets:Asset[],title:string,index:number,presentation=false):ScenePage{
 const palette=systems.find(system=>system.id===theme.style)!,prefix=stable(theme.id,`page-${presentation?'deck':'exhibit'}-${index}`);
 const main=presentation?'gallery':theme.form==='时间演进型'?'timeline':theme.form==='关系图谱型'?'graph':'gallery';
 return {id:prefix,name:title,background:palette.background,backgroundImage:assets[0].src,backgroundAssetId:assets[0].id,
  notes:`本页为${theme.name}的模拟演示，介绍${title}。围绕${theme.topics.join('、')}组织讲解，实际事实应以客户确认的资料为准。`,
  nodes:[
   createNode('text',{id:`${prefix}-label`,name:'演示标识',x:90,y:55,w:1000,h:40,content:`${theme.name} / 模拟演示`,color:palette.accent,fontSize:22}),
   createNode('text',{id:`${prefix}-title`,name:'主标题',x:90,y:125,w:1720,h:110,content:title,color:palette.text,fontSize:66}),
   createNode('text',{id:`${prefix}-intro`,name:'内容说明',x:90,y:260,w:1650,h:80,content:disclaimer,color:palette.text,fontSize:25}),
   createNode(main,{id:`${prefix}-content`,x:90,y:370,w:1740,h:570,items:items(theme,assets),color:palette.text,fontSize:28,columns:3,background:'transparent',
    ...(main==='timeline'?{timelineLayout:'fishbone'}:{}),interactions:[{id:`${prefix}-detail`,event:'click',action:'detail'}]}),
  ]};
}
function themeWorks(theme:DemoTheme,assets:Asset[],skill:Skill):Work[]{
 const titles=[`${theme.name} · ${theme.subject}（演示）`,`${theme.name} · ${theme.second==='story'?'寻找城市记忆':'接待主题讲解'}（演示）`];
 return titles.map((title,index)=>{
  const id=stable(theme.id,`work-${index+1}`),kind=index===0?'exhibit':theme.second;
  const work:Work={id,workspaceId:theme.id,projectId:`project-${id}`,title,kind,type:index===0?theme.form:'媒体叙事型',displayForm:index===0?theme.form:null,
   width:1920,height:1080,styleId:theme.style,cover:assets[0].src,coverAssetId:assets[0].id,createdAt:stamp,updatedAt:stamp,revision:1,
   contentPurposes:[theme.id==='dongguan'?'knowledge':theme.id==='xintai'?'history':'ecosystem'],
   pages:kind==='presentation'?[title,...theme.topics.slice(0,2)].map((heading,pageIndex)=>page(theme,assets,heading,pageIndex,true)):[page(theme,assets,title,0)],
   creationPackage:{id:`package-${id}`,version:'1.0',prompt:`根据${theme.name}模拟资料，组织${theme.subject}的${kind==='story'?'互动故事':kind==='presentation'?'智能演示':'交互页面'}。${disclaimer}`,
    files:assets.map(asset=>({name:asset.name,type:asset.kind,src:asset.src})),skillIds:[skill.id],skillSnapshots:[structuredClone(skill)],params:{resolution:'1920 × 1080',source:'内置模拟演示'},styleId:theme.style,complete:true},
  };
  if(kind!=='story')return work;
  return {...work,storyNodes:[
   {id:'start',type:'start',x:40,y:200,title:'寻找城市记忆',text:`一封虚构的来信邀请你探索城市。${disclaimer}`},
   {id:'scene',type:'scene',x:350,y:200,title:'走进记忆展厅',text:'在器物与图像之间，选择一条你感兴趣的故事线。',media:assets[0].src,mediaAssetId:assets[0].id},
   {id:'choice',type:'choice',x:670,y:200,title:'选择探索方向',text:'你希望先寻找水乡生活的线索，还是听一段手艺人的故事？'},
   {id:'water',type:'ending',x:1010,y:80,title:'水乡生活',text:'你完成了水乡生活主题的模拟探索。真实史料可在正式项目中补充引用。',media:assets[1].src,mediaAssetId:assets[1].id},
   {id:'craft',type:'ending',x:1010,y:350,title:'手艺记忆',text:'你完成了手艺记忆主题的模拟探索。欢迎返回选择另一条路径。',media:assets[1].src,mediaAssetId:assets[1].id},
  ],storyEdges:[{id:'e1',source:'start',target:'scene',label:'开始探索'},{id:'e2',source:'scene',target:'choice',label:'继续'},{id:'e3',source:'choice',target:'water',label:'水乡生活'},{id:'e4',source:'choice',target:'craft',label:'手艺记忆'}]};
 });
}
/** One-time additive demo upgrade. The marker prevents deleted examples from returning. */
export function migrateWorkspaceDemos<T extends StudioData>(data:T):T{
 if(data.workspaceDemoVersion===1)return data;
 const additions=themes.filter(theme=>data.workspaces.some(space=>space.id===theme.id&&!space.deletedAt&&!space.purgedAt&&!space.archivedAt)).map(theme=>{
  const assets=themeAssets(theme),skill=themeSkill(theme);return {assets,skills:[skill],works:themeWorks(theme,assets,skill)};
 });
 const append=<I extends {id:string}>(existing:I[],added:I[])=>[...existing,...added.filter(item=>!existing.some(old=>old.id===item.id))];
 return {...data,workspaceDemoVersion:1,works:append(data.works,additions.flatMap(group=>group.works)),assets:append(data.assets,additions.flatMap(group=>group.assets)),skills:append(data.skills,additions.flatMap(group=>group.skills))};
}
