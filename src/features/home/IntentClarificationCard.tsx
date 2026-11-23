import {useEffect,useId,useRef,useState} from 'react';
import {motion} from 'motion/react';
import {ArrowRight,Check,Clapperboard,Layers3,Presentation,Sparkles,X} from 'lucide-react';
import {clarificationChoice,exhibitChoices,updateClarificationAnswer,type IntentClarification,type ExhibitChoice} from '../../domain/intent-clarification';
import './intent-clarification.css';

// Interaction reference: 21st Question Tool / Approval Card (inline options + free answer).
export function IntentClarificationCard({value,disabled,onChange,onCancel,onContinue}:{
 value:IntentClarification;disabled:boolean;onChange:(value:IntentClarification)=>void;
 onCancel:()=>void;onContinue:()=>void;
}){
 const titleId=useId(),heading=useRef<HTMLHeadingElement>(null);
 const [attempted,setAttempted]=useState(false);
 const choice=clarificationChoice(value),honors=/荣誉|资质|技术案例/.test(value.sourcePrompt);
 const options:ExhibitChoice[]=honors?['browse','present']:['browse','present','story'];
 const ready=!!choice&&(choice!=='present'||!!(value.audience?.trim()&&value.duration?.trim()));
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[value.sourcePrompt]);
 const update=(patch:Partial<IntentClarification>)=>{setAttempted(false);onChange({...value,...patch,confirmed:false});};
 if(value.confirmed&&choice)return <section className="intent-answer-summary" aria-label="已确认展示方式"><Check size={15}/><span>展示方式：{exhibitChoices[choice].name}</span><button disabled={disabled} onClick={()=>update({confirmed:false})}>修改</button></section>;
 return <motion.section className="intent-question" aria-labelledby={titleId} initial={{opacity:0,y:8,scale:0.99}} animate={{opacity:1,y:0,scale:1}} transition={{duration:0.22,ease:[0.22,1,0.36,1]}}>
  <header><span><Sparkles size={16}/>Agent</span><button type="button" aria-label="取消需求澄清" title="取消" disabled={disabled} onClick={onCancel}><X size={16}/></button></header>
  <p className="intent-reason">{honors?'这类资料通常更适合做成交互页面，方便分类浏览和查看详情。':'先确认访客怎样体验这些内容。'}</p>
  <h2 ref={heading} tabIndex={-1} id={titleId}>{honors?'你希望完整展示，还是精选重点用于讲解？':'你希望访客自由浏览、听讲解，还是参与故事？'}</h2>
  <fieldset disabled={disabled}><legend className="intent-sr-only">展示目的</legend>
   {options.map(key=>{
    const item=exhibitChoices[key],Icon=key==='browse'?Layers3:key==='present'?Presentation:Clapperboard;
    return <label className={`intent-option ${choice===key?'is-selected':''}`} key={key}>
     <input type="radio" name={titleId} value={key} checked={choice===key} onChange={()=>update({choice:key,choiceSource:'option'})}/>
     <Icon size={19}/><span><strong>{item.label}</strong><small>{item.description}</small></span>
     {honors&&key==='browse'&&<em>推荐</em>}
    </label>;
   })}
  </fieldset>
  <label className="intent-custom">其他想法<textarea aria-label="补充展示需求" value={value.answer||''} maxLength={2000} disabled={disabled} placeholder="也可以直接描述你希望的观看方式…" onChange={event=>update(updateClarificationAnswer(value,event.target.value))}/></label>
  {choice==='present'&&<div className="intent-presentation-context">
   <label>面向受众<select aria-label="讲解受众" disabled={disabled} value={value.audience||''} onChange={e=>update({audience:e.target.value})}>
    <option value="">请选择</option>{['客户与合作伙伴','领导接待','公众参观','内部交流','由 Agent 建议'].map(text=><option key={text}>{text}</option>)}
   </select></label>
   <label>讲解时长<select aria-label="讲解时长" disabled={disabled} value={value.duration||''} onChange={e=>update({duration:e.target.value})}>
    <option value="">请选择</option>{[...new Set(['3 分钟','5 分钟','10 分钟','15 分钟','由 Agent 建议',...(value.duration?[value.duration]:[])])].map(text=><option key={text}>{text}</option>)}
   </select></label>
  </div>}
  {choice&&<p className="intent-recommendation" role="status">将制作 <strong>{exhibitChoices[choice].name}</strong>{choice==='story'?'，通过情节和分支选择组织内容。':choice==='browse'?'，保留内容层次，按需展开。':honors?'，以代表案例与荣誉组织讲解主线。':'，精选重点并组织讲解主线。'}</p>}
  {attempted&&!ready&&<p className="intent-error" role="alert">{choice==='present'?'请选择讲解受众和时长，也可以交给 Agent 建议。':'请选择展示目的，或补充希望怎样浏览、讲解这些内容。'}</p>}
  <footer><button type="button" className="intent-continue" disabled={disabled} onClick={()=>{setAttempted(true);if(ready)onContinue();}}>确认并继续<ArrowRight size={15}/></button></footer>
 </motion.section>;
}
