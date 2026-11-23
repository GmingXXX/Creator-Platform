import {getSkillMetadata} from './skill-metadata';
import type {SkillAccessState} from './skill-access';
import type {Run,Skill} from './types';
import {skillAvailableInSpace} from './resource-sharing';
import {skillIsValid} from './skill-publication';

type AvailableSkill=Skill&{enabled?:boolean};
export interface SkillSelection {id:string;name:string;reason:string;mode:'explicit'|'automatic'}
export interface TaskSkillInput {skills:AvailableSkill[];prompt:string;outputKind:Run['outputKind'];workspaceId?:string;explicitSkillIds?:string[];stage?:'planning'|'image';limit?:number;accessState?:SkillAccessState}
const topics={
 timeline:{label:'时间轴编排',terms:['鱼骨','时间轴','大事记','发展历程','企业事件','时间线']},
 presentation:{label:'智能演示与讲稿',terms:['智能演示','幻灯片','ppt','讲解演示','演示大纲','讲稿','演示编排']},
 story:{label:'互动故事',terms:['互动故事','互动影片','分支故事','故事节点','节点编排','剧情','故事脚本','分支剧情']},
 cards:{label:'卡片内容',terms:['卡片','案例墙','荣誉墙','成果展示']},
 graph:{label:'关系图谱',terms:['关系图谱','知识图谱','技术树','树状关系','关系网络']},
 image:{label:'图片与背景',terms:['背景','生图','图片生成','图像生成','图片风格']},
 video:{label:'视频分镜',terms:['视频分镜','分镜','视频制作','视频创作']},
 bubble:{label:'语音交互组件',terms:['语音气泡','声波','语音组件','语音聊天']},
 component:{label:'组件制作',terms:['组件制作','组件生成','交互组件']},
} as const;
type Topic=keyof typeof topics;
const normalize=(value:string)=>value.toLowerCase().replace(/\s/g,'');
function requestedTopics(input:TaskSkillInput):Topic[]{
 if(input.stage==='image'||input.outputKind==='image')return ['image'];
 if(input.outputKind==='presentation')return ['presentation'];
 if(input.outputKind==='story')return ['story'];
 if(input.outputKind==='video')return ['video'];
 const prompt=normalize(input.prompt),found=(Object.keys(topics) as Topic[]).filter(key=>topics[key].terms.some(term=>prompt.includes(term)));
 if(input.outputKind==='component'||input.outputKind==='html')return found.filter(key=>['cards','bubble','component'].includes(key));
 return found.filter(key=>key!=='image'||found.length===1);
}
export function skillEligibleForMatching(skill:AvailableSkill,workspaceId='personal',accessState?:SkillAccessState):boolean{
 return Boolean(skill.personal)&&!skill.public&&skill.enabled!==false&&skillAvailableInSpace(skill,workspaceId,accessState)&&skillIsValid(skill);
}
function rank(skill:Skill,requested:Topic[]){
 const name=normalize(skill.name),description=normalize(`${skill.description} ${skill.category}`);
 const metadata=getSkillMetadata(skill);
 const details=normalize(`${metadata.tags.join(' ')} ${metadata.purpose} ${metadata.scenarios} ${metadata.output} ${skill.input} ${skill.steps.join(' ')} ${skill.sourcePackage?.instructions?.slice(0,6000)||''}`);
 const matches=requested.map(topic=>({topic,score:topics[topic].terms.some(term=>name.includes(term))?10:topics[topic].terms.some(term=>description.includes(term))?8:topics[topic].terms.some(term=>details.includes(term))?6:0}));
 const relevant=matches.filter(item=>item.score>0);
 return {score:relevant.reduce((sum,item)=>sum+item.score,0),reason:`按需求与技能说明匹配：${relevant.map(item=>topics[item.topic].label).join('、')}`};
}
const family=(skill:Skill)=>skill.origin?.skillId||skill.sourceSkillId||skill.id;

/** Deterministic capability retrieval, not an extra model/tool execution. Only selected instructions enter the model context. */
export function selectTaskSkills(input:TaskSkillInput):{skillIds:string[];selections:SkillSelection[]}{
 const workspace=input.workspaceId||'personal',eligible=input.skills.filter(skill=>skillEligibleForMatching(skill,workspace,input.accessState));
 const explicit=[...new Set(input.explicitSkillIds||[])].map(id=>{
  const skill=input.skills.find(item=>item.id===id&&item.enabled!==false&&skillAvailableInSpace(item,workspace,input.accessState)&&skillIsValid(item));if(!skill)throw new Error('指定技能已停用、不可用或不属于当前空间，请重新选择。');return skill;
 });
 const selections:SkillSelection[]=explicit.map(skill=>({id:skill.id,name:skill.name,reason:'用户指定的制作方法',mode:'explicit'}));
 const usedFamilies=new Set(explicit.map(family)),requested=requestedTopics(input),limit=Math.max(0,Math.min(5,input.limit??3));
 const ranked=eligible.filter(skill=>!explicit.some(item=>item.id===skill.id)).map(skill=>({skill,...rank(skill,requested)})).filter(item=>item.score>=6)
  .sort((a,b)=>b.score-a.score||Number(b.skill.workspaceId===workspace)-Number(a.skill.workspaceId===workspace)||a.skill.id.localeCompare(b.skill.id));
 for(const item of ranked){
  if(selections.length>=Math.max(limit,explicit.length))break;
  const key=family(item.skill);if(usedFamilies.has(key))continue;usedFamilies.add(key);
  selections.push({id:item.skill.id,name:item.skill.name,reason:item.reason,mode:'automatic'});
 }
 return {skillIds:selections.map(item=>item.id),selections};
}
