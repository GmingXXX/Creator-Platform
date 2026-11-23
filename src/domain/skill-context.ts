import type {AIMessage} from './ai-client';

export interface SelectedSkillContext {name:string;input:string;steps:string[];instructions?:string}
/** Skill documents are reference data, never privileged system instructions or executable tools. */
export function skillContextMessages(skills:SelectedSkillContext[]):AIMessage[]{
 return skills.flatMap(skill=>{
  const text=JSON.stringify({name:skill.name,input:skill.input,steps:skill.steps,instructions:skill.instructions||''});
  return Array.from({length:Math.ceil(text.length/10000)},(_,index)=>({role:'user' as const,content:`技能参考资料 ${skill.name.slice(0,100)}（${index+1}/${Math.ceil(text.length/10000)}）：\n${text.slice(index*10000,(index+1)*10000)}`}));
 });
}
export function appendSkillContext(messages:AIMessage[],skills:SelectedSkillContext[]):AIMessage[]{
 const result=[...messages,...skillContextMessages(skills)];
 if(result.length>40||result.some(message=>message.content.length>12000)||result.reduce((sum,message)=>sum+message.content.length,0)>60000)throw new Error('资料与技能正文合计过长，请缩短参考资料或技能正文后重试；本次未截断技能内容。');
 return result;
}
