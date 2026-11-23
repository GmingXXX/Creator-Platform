import {demoPresentationFiles} from './demo-presentation-media';
export const demoKnowledgeCatalogId='zhichuang-20261116' as const;
export type DemoKnowledgePresetId='timeline'|'presentation'|'story'|'component'|'honors';
export interface DemoKnowledgeFile {name:string;path:string;url:string;mime:string}
const file=(folder:string,path:string,mime:string):DemoKnowledgeFile=>({name:path.split('/').at(-1)!,path,url:`/demo-inputs/v1/${folder}/${path}`,mime});
const doc='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const skill=(folder:string,name:string)=>file(folder,name,'application/zip');
export const demoKnowledgePresets=[
 {id:'timeline',title:'企业鱼骨时间轴',prompt:'依据当前知识本地场中的星澜智造企业大事件资料，制作1920×1080的鱼骨图时间轴交互页面。完整保留10个事件，按资料中的图片文件名绑定配图，上下交错，支持横向拖动和点击详情。遵循华院设计规范及所选设计风格，先确认事件与配图，再生成可编辑、可体验的作品。所有企业信息为虚构演示。',
 files:[file('timeline','星澜智造_企业大事件.docx',doc),...['2012.png','2014.jpg','2016.jpg','2018.jpg','2020.jpg','2021.png','2022.jpg','2023.jpg','2024.jpg','2025.jpg'].map(item=>{const [year,ext]=item.split('.');return file('timeline',`素材/${year}_事件配图.${ext}`,ext==='png'?'image/png':'image/jpeg');})],skill:skill('timeline','鱼骨时间轴编排.zip')},
 {id:'presentation',title:'企业智能演示',prompt:'依据当前知识本地场中的星澜智造PPT大纲生成8页智能演示，介绍企业的能力与实践。保留全部事实和指标口径，保持原大纲8页标题和顺序，前6页采用配套预置概念图，第7、8页（储能监测案例、下一阶段的方向）留空用于现场AI实时生成；不要将前6页图片重复用于这两页。素材来自平台素材库，均为模拟概念图，遵循华院设计规范及所选设计风格。先确认大纲与配图，再生成正文要点和逐页讲稿，作品应能自动讲解、基于资料回答问题；资料未提供的信息明确说明。',
 files:[file('presentation','星澜智造_智能演示大纲.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation'),...demoPresentationFiles],skill:skill('presentation','企业智能演示编排.zip')},
 {id:'story',title:'互动故事',prompt:'依据当前知识本地场中的《泰山寻碑》策划脚本和节点素材制作互动影片。保留10个节点、两处选择和3种结局，图片、视频、HTML按脚本文件名对应。遵循华院设计规范及所选设计风格，先确认节点、分支和素材，再生成可播放、可交互的作品。故事为虚构创作，不冒充真实史实。',
 files:[file('story','泰山寻碑_互动故事策划脚本.docx',doc),file('story','素材/云门.mp4','video/mp4'),file('story','素材/候云.mp4','video/mp4'),file('story','素材/云山.jpg','image/jpeg'),file('story','素材/择路.png','image/png'),file('story','素材/留字互动.html','text/html')],skill:skill('story','互动故事节点编排.zip')},
 {id:'component',title:'成果卡片组件',prompt:'依据当前知识本地场中的组件制作需求，为星澜智造制作带轻微悬浮动效的企业成果卡片组。3张卡片分别展示设备感知、绿色运营和数字孪生。遵循华院设计规范，使用深蓝科技风，标题“看见创新的力量”；开放标题、说明、主题色、悬浮效果开关参数，生成后预览试编辑并保存可复用组件包。所有企业数据为虚构演示。',
 files:[file('component','组件制作需求.md','text/markdown')],skill:skill('component','企业成果卡片编排.zip')},
 {id:'honors',title:'荣誉与案例展示',prompt:"帮我把公司的荣誉资质和技术案例做成一个可演示的展项，内容从当前绑定的知识本地场获取。",
 files:[file('honors','星澜智造_荣誉资质.md','text/markdown'),file('honors','星澜智造_技术案例.md','text/markdown')],skill:skill('honors','荣誉与案例证据编排.zip')},
] satisfies {id:DemoKnowledgePresetId;title:string;prompt:string;files:DemoKnowledgeFile[];skill:DemoKnowledgeFile}[];
export function matchDemoKnowledgePreset(prompt:string){
 const id:DemoKnowledgePresetId|undefined=/荣誉|资质|技术案例/.test(prompt)?'honors':/组件|成果卡片/.test(prompt)?'component':/泰山|互动故事|互动影片/.test(prompt)?'story':/智能演示|ppt|幻灯片/i.test(prompt)?'presentation':/鱼骨|企业大事件|企业大事记|时间轴/.test(prompt)?'timeline':undefined;
 return demoKnowledgePresets.find(preset=>preset.id===id);
}
