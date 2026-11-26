import {useEffect,useRef,useState} from 'react';
import {Redo2,Undo2} from 'lucide-react';
import {Button} from '../../components/ui';
import type {Work} from '../../domain/types';
export function EditorHistoryButtons({work,onRestore}:{work:Work;onRestore:(next:Work)=>void}){
 const last=useRef(work),restoring=useRef(false);
 const [history,setHistory]=useState<{past:Work[];future:Work[]}>({past:[],future:[]});
 useEffect(()=>{
  const previous=last.current;last.current=work;
  if(previous.id!==work.id){setHistory({past:[],future:[]});return;}
  if(restoring.current){restoring.current=false;return;}
  if(previous===work||JSON.stringify(previous)===JSON.stringify(work))return;
  setHistory(h=>({past:[...h.past.slice(-39),previous],future:[]}));
 },[work]);
 const restore=(undo:boolean)=>{
  const next=undo?history.past.at(-1):history.future[0];if(!next)return;
  restoring.current=true;setHistory(undo?{past:history.past.slice(0,-1),future:[work,...history.future]}:{past:[...history.past,work],future:history.future.slice(1)});
  onRestore({...next,revision:work.revision});
 };
 return <><Button size="sm" title="撤销" aria-label="撤销" disabled={!history.past.length} onClick={()=>restore(true)}><Undo2 size={15}/></Button><Button size="sm" title="重做" aria-label="重做" disabled={!history.future.length} onClick={()=>restore(false)}><Redo2 size={15}/></Button></>;
}
