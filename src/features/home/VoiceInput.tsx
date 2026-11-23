import {useEffect,useRef,useState} from 'react';
import {ArrowUp,LoaderCircle,Mic,Square,X} from 'lucide-react';
import {toast} from '../../components/ui';
import {VoiceSession,type Recognition} from './home-logic';
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export function VoiceInput({sessionKey,disabled,onResult,onActiveChange}:{sessionKey:string;disabled:boolean;onResult:(text:string,send:boolean)=>void;onActiveChange:(active:boolean)=>void}){
 const [phase,setPhase]=useState<'idle'|'recording'|'processing'>('idle');const [text,setText]=useState('');
 const session=useRef<VoiceSession|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),callback=useRef(onResult),activeCallback=useRef(onActiveChange);callback.current=onResult;activeCallback.current=onActiveChange;
 const reset=()=>{clearTimeout(timer.current);setPhase('idle');activeCallback.current(false);};
 useEffect(()=>()=>{session.current?.cancel();clearTimeout(timer.current);activeCallback.current(false);},[sessionKey]);
 const start=()=>{
  const Constructor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  if(!Constructor){toast('当前浏览器不支持语音识别，请使用支持的浏览器或输入文字。',true);return;}
  setText('');setPhase('recording');activeCallback.current(true);
  session.current=new VoiceSession(new Constructor(),{update:setText,done:(value,send)=>{reset();callback.current(value,send);},error:message=>{reset();toast(message,true);}});session.current.start();
 };
 const stop=(send:boolean)=>{setPhase('processing');timer.current=setTimeout(()=>{session.current?.cancel();reset();toast('语音转写超时，请重试。',true);},12000);session.current?.stop(send);};
 if(phase==='idle')return <button className="composer-microphone" aria-label="语音输入" title="语音输入" disabled={disabled} onClick={start}><Mic size={19}/></button>;
 return <div className="voice-input-panel" role="region" aria-label="语音录入"><button aria-label="取消录音" onClick={()=>{session.current?.cancel();reset();}}><X size={20}/></button><div className="voice-input-body"><div className={`voice-wave ${phase==='processing'?'is-processing':''}`} aria-hidden="true">{Array.from({length:42},(_,i)=><i key={i} style={{animationDelay:`${i*.07}s`,height:`${4+(i%7)*3}px`}}/>)}</div><span role="status">{phase==='processing'?'正在转写…':text||'正在聆听…'}</span></div><button aria-label="停止录音并转写" title="停止后可编辑文字" disabled={phase==='processing'} onClick={()=>stop(false)}>{phase==='processing'?<LoaderCircle className="spinner" size={19}/>:<Square size={16} fill="currentColor"/>}</button><button className="voice-submit" aria-label="结束录音并发送" disabled={phase==='processing'} onClick={()=>stop(true)}><ArrowUp size={23}/></button></div>;
}
