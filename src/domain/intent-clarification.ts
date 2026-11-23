import type {ComposerDraft} from './types';

export type ExhibitChoice = 'browse' | 'present' | 'story';
export interface IntentClarification {
 sourcePrompt: string;
 choice?: ExhibitChoice;
 choiceSource?: 'option' | 'answer';
 answer?: string;
 audience?: string;
 duration?: string;
 confirmed?: boolean;
}
export const exhibitChoices = {
 browse: {label:'完整展示，按需浏览',kind:'exhibit',name:'交互页面',description:'分类筛选、卡片浏览，点击查看详情。'},
 present: {label:'精选重点，限时讲解',kind:'presentation',name:'智能演示',description:'精选重点，组织有顺序的讲解主线。'},
 story: {label:'情境体验，参与故事',kind:'story',name:'互动影片',description:'通过场景和分支选择推进故事。'},
} as const;

// Prototype guidance is deliberately conservative: venue alone cannot select a medium.
const affirmativeText=(text:string)=>text.replace(/(?:不想|不要|不需要|不用|不做|无需)[^，。；\n]*/g,'');
function answerChoices(text:string):ExhibitChoice[] {
 const choices:ExhibitChoice[]=[];
 if(/交互页面|交互界面|完整(?:展示|浏览)|全部(?:展示|内容|浏览)|筛选|点击详情|自主(?:浏览|探索)|自由(?:浏览|探索)/.test(text))choices.push('browse');
 if(/智能演示|幻灯片|ppt|精选|限时讲解|按主线讲解|按顺序讲解|讲解.{0,8}分钟/i.test(text))choices.push('present');
 if(/互动影片|互动故事|故事分支|不同结局|选择.{0,8}(?:情节|剧情|路径)|情境体验/.test(text))choices.push('story');
 return choices;
}
export function interpretExhibitAnswer(answer:string):ExhibitChoice|undefined {
 const choices=answerChoices(affirmativeText(answer));
 return choices.length===1?choices[0]:undefined;
}
export function updateClarificationAnswer(previous:IntentClarification,answer:string):IntentClarification {
 const text=affirmativeText(answer),choices=answerChoices(text);
 const retain=previous.choiceSource!=='answer'&&choices.length===0&&answerChoices(answer).length===0;
 const choice=choices.length===1?choices[0]:retain?previous.choice:undefined;
 const audience=/客户|合作伙伴/.test(text)?'客户与合作伙伴':/领导/.test(text)?'领导接待':/公众|大众/.test(text)?'公众参观':/内部|同事/.test(text)?'内部交流':undefined;
 const minutes=text.match(/(\d{1,3}|三|五|十|十五|二十)\s*分钟/)?.[1];
 const number=minutes?({'三':3,'五':5,'十':10,'十五':15,'二十':20}[minutes]||Number(minutes)):undefined;
 return {...previous,answer,choice,choiceSource:choice?(retain?'option':'answer'):undefined,confirmed:false,
  audience:audience||previous.audience,duration:number&&number>0&&number<=120?`${number} 分钟`:previous.duration};
}
export function clarificationNeeded(prompt:string):boolean {
 if(!/荣誉|资质|技术案例|展项|展厅展示|展示(?:内容|方案|作品)|介绍.{0,12}(?:客户|访客|领导)/.test(prompt))return false;
 const text=affirmativeText(prompt);
 // “可演示” describes capability, not an explicit presentation format.
 return !/交互页面|交互界面|智能演示|幻灯片|ppt|互动影片|互动故事|分支故事|时间轴|卡片(?:浏览|流|墙)|海报|证书图片|组件|短片|视频|分镜|地图|关系图|图谱|流程图|数据看板/i.test(text);
}
export function clarificationChoice(value:IntentClarification):ExhibitChoice|undefined {
 return value.choice&&Object.hasOwn(exhibitChoices,value.choice)?value.choice:interpretExhibitAnswer(value.answer||'');
}
export function confirmedIntent(draft:Pick<ComposerDraft,'text'|'intentClarification'>) {
 const decision=draft.intentClarification;
 if(!decision?.confirmed||decision.sourcePrompt!==draft.text)return;
 const choice=clarificationChoice(decision);
 if(!choice)return;
 if(choice==='present'&&(!decision.audience?.trim()||!decision.duration?.trim()))return;
 return exhibitChoices[choice].kind;
}
export function creationPrompt(draft:Pick<ComposerDraft,'text'|'intentClarification'>):string {
 const decision=draft.intentClarification;
 if(!decision||!confirmedIntent(draft))return draft.text.trim();
 const choice=clarificationChoice(decision)!;
 const context=[`用户确认制作：${exhibitChoices[choice].name}。${exhibitChoices[choice].description}`,
  decision.answer?.trim()?`补充需求：${decision.answer.trim()}`:'',
  choice==='present'?`面向受众：${decision.audience}；讲解时长：${decision.duration}。`:''];
 return `${draft.text.trim()}\n\n${context.filter(Boolean).join('\n')}`;
}
