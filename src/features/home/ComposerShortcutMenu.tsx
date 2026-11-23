import {useEffect,useRef} from 'react';
import {ArrowUpRight,File,Layers,Zap} from 'lucide-react';
import type {ComposerShortcutChoice} from './composer-shortcuts';
import '../../styles/composer-shortcuts.css';

export function ComposerShortcutMenu({id,kind,choices,activeIndex,onActive,onSelect}:{id:string;kind:'skill'|'asset';choices:ComposerShortcutChoice[];activeIndex:number;onActive:(index:number)=>void;onSelect:(choice:ComposerShortcutChoice)=>void}) {
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[activeIndex]);
 return <div className="composer-shortcuts" ref={root} id={id} role="listbox" aria-label={kind==='skill'?'选择 Skill':'选择参考素材'} onMouseDown={event=>event.preventDefault()}>
  <div className="composer-shortcuts-heading">{kind==='skill'?'Skills':'参考素材'}</div>
  {!choices.length&&<p className="composer-shortcuts-empty" role="status">没有匹配的可用技能</p>}
  {kind==='asset'&&choices.length===1&&<p className="composer-shortcuts-empty" role="status">没有匹配的可用素材</p>}
  {choices.map((choice,index)=><button type="button" role="option" id={`${id}-${index}`} key={`${choice.kind}-${choice.id}`} tabIndex={-1} aria-selected={index===activeIndex} aria-disabled={Boolean(choice.disabledReason)} className={`composer-shortcut-option ${choice.kind==='references'?'composer-shortcut-browse':''}`} onMouseEnter={()=>onActive(index)} onClick={()=>{if(!choice.disabledReason)onSelect(choice);}}>
   {choice.kind==='skill'?<Zap size={16}/>:choice.kind==='references'?<Layers size={16}/>:<File size={16}/>}
   <span><strong>{choice.name}</strong><small>{choice.disabledReason||choice.description}</small></span>
   {choice.kind==='references'&&<ArrowUpRight size={14}/>}
  </button>)}
 </div>;
}
