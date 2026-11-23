import type {ContentItem, DesignSystem, ExhibitType, NodeKind, SceneNode, Work, WorkKind} from './types';
export const uid = (prefix='id') => `${prefix}-${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
export const exhibitTypes: ExhibitType[]=['时间演进型','关系图谱型','卡片浏览型','空间分布型','流程架构型','媒体叙事型','数据总览型'];
export const resolutions=[{label:'标准横屏 16:9',width:1920,height:1080},{label:'近方形 4:3',width:1440,height:1080},{label:'方形 1:1',width:1080,height:1080},{label:'宽银幕 21:9',width:2520,height:1080},{label:'全景屏 16:7',width:2560,height:1120},{label:'超宽屏 4:1',width:3840,height:960},{label:'竖屏 9:16',width:1080,height:1920}];
export const models=['GPT','Claude','Gemini','DeepSeek','通义千问','豆包'];
export const systems:DesignSystem[]=[
 {id:'industrial',name:'工业蓝',subtitle:'精密秩序，制造之美',description:'以工业材质、深蓝与清晰的信息结构，呈现制造业的长期积累与技术实力。',colors:['#0d1b2a','#214364','#75b9df','#d5e9f2','#ffffff'],background:'#0d1b2a',text:'#edf5fb',accent:'#74c0e8',font:'现代无衬线',motion:'稳重推进 · 600ms',tags:['工业风','制造业','发展历程']},
 {id:'technology',name:'科技风',subtitle:'探索未来的表达方式',description:'蓝青色的精细光线与空间层次，适用于 AI、数字技术和创新成果展示。',colors:['#071b2c','#0b4561','#35d9ed','#95f0ee','#ffffff'],background:'#071b2c',text:'#e9fbff',accent:'#35d9ed',font:'几何无衬线',motion:'轻盈浮现 · 450ms',tags:['科技风','数字化','AI']},
 {id:'government',name:'政务风',subtitle:'庄重而清晰，可信且有序',description:'以红金点缀、清晰网格和适度留白组织信息，适合公共服务与发展成果展。',colors:['#f6f2eb','#a53032','#b69b69','#37332e','#ffffff'],background:'#f6f2eb',text:'#37332e',accent:'#a53032',font:'端正黑体',motion:'克制淡入 · 500ms',tags:['政务风','公共服务','成果展示']},
 {id:'culture',name:'人文典藏',subtitle:'让时间与故事自然展开',description:'纸感暖白、深墨色文字与历史图像，让人物、文化和历史故事更有温度。',colors:['#eee8dc','#423b31','#8b7657','#c1b59a','#fffdf8'],background:'#eee8dc',text:'#423b31',accent:'#8b7657',font:'宋体与现代黑体',motion:'舒缓展开 · 800ms',tags:['人文风','历史','人物']},
 {id:'jewelry',name:'珠宝银',subtitle:'精致光感，静奢质地',description:'银白、柔光与深色对照突出产品材质，适合精品品牌、珠宝和高端产品。',colors:['#f0f1f4','#252634','#8b86a7','#c7cad6','#ffffff'],background:'#f0f1f4',text:'#252634',accent:'#8b86a7',font:'优雅衬线与无衬线',motion:'柔和显现 · 650ms',tags:['珠宝风','精品','品牌']},
 {id:'finance',name:'现代财经',subtitle:'理性信息，清晰洞察',description:'用专业的蓝白配色、严谨的网格和图表层级呈现趋势、指标与全球联系。',colors:['#ecf2f5','#173b5b','#427b98','#90b8c8','#ffffff'],background:'#ecf2f5',text:'#173b5b',accent:'#427b98',font:'现代无衬线',motion:'利落切换 · 350ms',tags:['财经风','金融','数据']}
];
export function createNode(type:NodeKind, overrides:Partial<SceneNode>={}):SceneNode {
 return {id:uid('node'),type,name:{text:'文本',image:'图片',video:'视频',audio:'音频',shape:'形状',card:'内容卡片',timeline:'发展时间轴',gallery:'照片墙',graph:'关系图谱',map:'分布地图',flow:'流程图',chart:'数据图表',bubble:'AI 语音气泡',button:'交互按钮',html:'HTML 交互程序'}[type],x:120,y:120,w:480,h:240,rotation:0,opacity:1,hidden:false,locked:false,content:type==='text'?'双击编辑文本':'',color:'#ffffff',background:'transparent',fontSize:32,radius:12,...overrides};
}
export const historyItems=():ContentItem[]=>[
 {id:uid('item'),title:'初创 · 蓄势',year:'1988',description:'第一条生产线投产，从一座工厂出发，开启制造新篇章。',image:'/media/industrial.svg',category:'发展历程'},
 {id:uid('item'),title:'跨越 · 成长',year:'2002',description:'全面推进技术升级，产品进入国际市场。',image:'/media/technology.svg',category:'技术突破'},
 {id:uid('item'),title:'创新 · 突破',year:'2012',description:'成立创新研究院，以材料技术连接产业未来。',image:'/media/industrial.svg',category:'技术突破'},
 {id:uid('item'),title:'智造 · 焕新',year:'2020',description:'数字化工厂正式投运，构建绿色智能制造体系。',image:'/media/technology.svg',category:'发展历程'},
 {id:uid('item'),title:'同行 · 未来',year:'2026',description:'以可持续创新，面向更广阔的全球产业协作。',image:'/media/finance.svg',category:'发展历程'}
];
const typeToNode:Record<ExhibitType,NodeKind>={'时间演进型':'timeline','关系图谱型':'graph','卡片浏览型':'gallery','空间分布型':'map','流程架构型':'flow','媒体叙事型':'gallery','数据总览型':'chart'};
export function createSceneWork(options:{title:string;type:ExhibitType;width:number;height:number;styleId?:string;kind?:WorkKind;blank?:boolean}):Work {
 const {title,type,width,height,styleId='industrial',kind='exhibit'}=options;
 const palette=systems.find(x=>x.id===styleId)||systems[0];
 const factor=Math.min(width/1920,height/1080),vertical=height>width;
 const itemList=historyItems();
 const items=type==='时间演进型'?itemList:itemList.map((x,i)=>({...x,title:type==='卡片浏览型'?['智慧工厂','绿色材料','创新研发','全球合作','质量荣誉'][i]:type==='流程架构型'?['原料准备','精密加工','智能检测','绿色交付','全程追溯'][i]:type==='数据总览型'?['创新项目','技术专利','合作伙伴','产业基地','人才团队'][i]:['核心技术','材料研发','智能制造','应用场景','生态合作'][i],value:[86,72,94,58,82][i],x:[18,40,62,78,48][i],y:[40,25,48,30,70][i],parentId:i===0?undefined:itemList[0].id}));
 const main=createNode(typeToNode[type],{x:80*factor,y:(vertical?420:360)*factor,w:(width-160*factor),h:Math.max(350*factor,height-(vertical?600:510)*factor),content:type==='时间演进型'?'一段持续向前的发展历程':'以清晰的信息结构，连接内容与体验',items,color:palette.text,background:'transparent',fontSize:32*factor,columns:vertical?2:3,gap:24});
 main.interactions=[{id:uid('rule'),event:'click',action:'detail'}];
 const nodes=options.blank?[]:[
  createNode('text',{name:'展项标识',x:80*factor,y:62*factor,w:650*factor,h:36*factor,content:'企业展厅 / 内容精选',fontSize:22*factor,color:palette.accent}),
  createNode('text',{name:'主标题',x:80*factor,y:126*factor,w:Math.min(width-160*factor,1500*factor),h:110*factor,content:title,fontSize:66*factor,color:palette.text}),
  createNode('text',{name:'展项简介',x:80*factor,y:252*factor,w:Math.min(width-160*factor,1450*factor),h:54*factor,content:type==='时间演进型'?'与时代同行，让每一次突破成为新的起点。':'探索内容背后的连接，触摸每一个值得被看见的故事。',fontSize:26*factor,color:palette.text,opacity:.68}),
  main,
  createNode('text',{name:'操作提示',x:80*factor,y:height-65*factor,w:1000*factor,h:30*factor,content:'点击内容，探索更多  /  示例展项内容',fontSize:19*factor,color:palette.text,opacity:.5})
 ];
 const work:Work={id:uid('work'),projectId:uid('project'),title,kind,type,width,height,styleId,pages:[{id:uid('page'),name:'主页面',background:palette.background,backgroundImage:`/media/${palette.id}.svg`,nodes}],createdAt:now(),updatedAt:now(),revision:1};
 if(kind==='presentation')work.pages=Array.from({length:8},(_,i)=>({id:uid('page'),name:['开场','企业介绍','发展历程','创新技术','核心业务','典型案例','未来展望','感谢聆听'][i],background:palette.background,backgroundImage:`/media/${palette.id}.svg`,notes:`本页讲解：${['欢迎来到企业创新展厅。今天，我们将一起了解一家企业的成长、技术与未来。','以长期主义践行价值，以技术创新推动产业升级。','从初创到数字化转型，每一步发展都承载着团队的努力。','围绕材料、制造与数字技术，构建持续创新的能力体系。','服务产业需求，提供从研发到交付的完整解决方案。','让技术走进实际场景，用案例展示价值与成果。','持续投入绿色技术，与合作伙伴共创可持续未来。','感谢您的聆听。欢迎进一步了解我们的技术和项目。'][i]}`,nodes:[createNode('text',{x:110,y:120,w:1600,h:120,content:i===0?title:['','企业介绍','发展历程','创新技术','核心业务','典型案例','未来展望','感谢聆听'][i],fontSize:76,color:palette.text}),createNode('text',{x:110,y:285,w:1450,h:100,content:'以创新连接今天与未来',fontSize:32,color:palette.accent}),createNode(i===2?'timeline':'gallery',{x:110,y:430,w:1680,h:470,items:historyItems().slice(0,3),color:palette.text,columns:3})]}));
 if(kind==='video')work.shots=['时代与产业','创新的力量','全球的连接','携手向未来'].map((title,i)=>({id:uid('shot'),title,narration:['世界正在改变，产业正在重塑。','以创新推动价值，以技术开拓可能。','在全球联系中，寻找共同发展的机会。','让每一次协作，成为向前的力量。'][i],duration:15,src:'/media/demo-loop.mp4'}));
 if(kind==='story'){
  work.storyNodes=[{id:'start',type:'start',x:40,y:200,title:'故事开始',text:'欢迎来到未来工厂。请选择你的探索路径。'},{id:'scene',type:'scene',x:350,y:200,title:'发现未来工厂',text:'智能生产线正在运行。你想先了解哪一种技术？',media:'/media/industrial.svg'},{id:'choice',type:'choice',x:670,y:200,title:'你的选择',text:'探索绿色材料，或深入数字制造。'},{id:'green',type:'ending',x:1010,y:80,title:'绿色未来',text:'你发现了循环材料的奥秘，获得绿色探索者徽章。',media:'/media/culture.svg'},{id:'digital',type:'ending',x:1010,y:350,title:'智造先锋',text:'你完成了数字化挑战，成为智造先锋。',media:'/media/technology.svg'}];
  work.storyEdges=[{id:'e1',source:'start',target:'scene',label:'开始探索'},{id:'e2',source:'scene',target:'choice',label:'继续'},{id:'e3',source:'choice',target:'green',label:'绿色材料'},{id:'e4',source:'choice',target:'digital',label:'数字制造'}];
 }
 return work;
}
