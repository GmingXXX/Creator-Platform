import {useId,useRef,useState,type RefObject,type KeyboardEvent} from 'react';
import {useStudio} from '../../domain/store';
import type {ComposerDraft} from '../../domain/types';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {toast} from '../../components/ui';
import {ComposerShortcutMenu} from './ComposerShortcutMenu';
import {composerShortcutChoices,findComposerShortcut,removeComposerShortcut,type ComposerShortcutChoice} from './composer-shortcuts';

export function useComposerShortcuts(draft:ComposerDraft|undefined,textarea:RefObject<HTMLTextAreaElement|null>,disabled:boolean,openReferences:()=>void) {
 const state=useStudio(),id=useId(),composing=useRef(false);
 const [cursor,setCursor]=useState<{draftId:string;text:string;start:number;end:number}>();
 const [activeIndex,setActiveIndex]=useState(0),[dismissed,setDismissed]=useState('');
 const key=cursor?`${cursor.draftId}:${cursor.text}:${cursor.start}:${cursor.end}`:'';
 const token=!disabled&&draft&&cursor?.draftId===draft.id&&cursor.text===draft.text&&key!==dismissed&&!composing.current?findComposerShortcut(cursor.text,cursor.start,cursor.end):undefined;
 const choices=draft&&token?composerShortcutChoices({skills:state.skills,assets:state.assets,access:state,draft},token.kind,token.query):[];
 const refresh=(input:HTMLTextAreaElement)=>{if(!draft)return;setCursor({draftId:draft.id,text:input.value,start:input.selectionStart,end:input.selectionEnd});setActiveIndex(0);};
 const select=(choice:ComposerShortcutChoice)=>{
  if(!draft||!token||disabled||choice.disabledReason)return;
  const latest=useStudio.getState(),current=latest.drafts.find(item=>item.id===latest.activeDraftId);
  if(!current||current.id!==draft.id||current.text!==draft.text||!workspaceCanEdit(latest,current.workspaceId||'personal'))return;
  const fresh=composerShortcutChoices({skills:latest.skills,assets:latest.assets,access:latest,draft:current},token.kind,token.query).find(item=>item.id===choice.id&&item.kind===choice.kind);
  if(!fresh||fresh.disabledReason){toast('该资源当前不可用，请重新选择',true);return;}
  const next=removeComposerShortcut(current.text,token);
  latest.updateDraft({text:next.text,...(choice.kind==='skill'?{skillIds:[...new Set([...current.skillIds,choice.id])]}:choice.kind==='asset'?{attachmentIds:[...new Set([...current.attachmentIds,choice.id])]}:{})});
  setCursor(undefined);
  if(choice.kind==='references'){openReferences();return;}
  requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.setSelectionRange(next.caret,next.caret);});
 };
 const onKeyDown=(event:KeyboardEvent<HTMLTextAreaElement>):boolean=>{
  if(composing.current||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return true;
  if(!token)return false;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDismissed(key);return true;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();const enabled=choices.map((choice,index)=>choice.disabledReason?-1:index).filter(index=>index>=0),position=enabled.indexOf(activeIndex);
   const next=event.key==='ArrowDown'?(position+1)%enabled.length:(position<=0?enabled.length-1:position-1);
   if(enabled.length)setActiveIndex(enabled[next]);return true;
  }
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(choices[activeIndex])select(choices[activeIndex]);return true;}
  return false;
 };
 return {
  onKeyDown,
  inputProps:{
   'aria-autocomplete':'list' as const,'aria-controls':token?id:undefined,'aria-activedescendant':token&&choices[activeIndex]?`${id}-${activeIndex}`:undefined,
   onChange:(event:React.ChangeEvent<HTMLTextAreaElement>)=>{state.updateDraft({text:event.target.value});setDismissed('');refresh(event.currentTarget);},
   onSelect:(event:React.SyntheticEvent<HTMLTextAreaElement>)=>{if(document.activeElement===event.currentTarget)refresh(event.currentTarget);},
   onBlur:()=>setCursor(undefined),
   onCompositionStart:()=>{composing.current=true;setCursor(undefined);},
   onCompositionEnd:(event:React.CompositionEvent<HTMLTextAreaElement>)=>{composing.current=false;refresh(event.currentTarget);},
  },
  menu:token?<ComposerShortcutMenu id={id} kind={token.kind} choices={choices} activeIndex={activeIndex} onActive={setActiveIndex} onSelect={select}/>:null,
 };
}
