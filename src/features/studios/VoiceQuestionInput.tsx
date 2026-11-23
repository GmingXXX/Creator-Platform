import {useEffect,useRef,useState} from 'react';
import {Mic,Square,X,Send} from 'lucide-react';
import {VoiceSession,type Recognition} from '../home/home-logic';
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
/** Speech is always reviewed before submission; partial and late transcripts never trigger a question. */
export function VoiceQuestionInput({sessionKey,disabled,question,onChange,onQuestion,onListen}:{sessionKey:string;disabled:boolean;question:string;onChange:(text:string)=>void;onQuestion:(text:string)=>void;onListen:()=>void}){
 const [phase,setPhase]=useState<'idle'|'recording'|'processing'|'review'>('idle'),[transcript,setTranscript]=useState(''),[error,setError]=useState(''),[typed,setTyped]=useState(false);
 const session=useRef<VoiceSession|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true);
 const clearTimer=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
 const cancel=()=>{session.current?.cancel();session.current=null;clearTimer();setPhase('idle');setTranscript('');};
 useEffect(()=>{if(disabled)cancel();},[disabled]);
 useEffect(()=>{alive.current=true;setPhase('idle');setTranscript('');return()=>{alive.current=false;session.current?.cancel();clearTimer();}},[sessionKey]);
 const fail=(message:string)=>{if(!alive.current)return;session.current?.cancel();session.current=null;clearTimer();setPhase('idle');setError(message);setTyped(true);};
 const start=()=>{
  onListen();setError('');setTranscript('');const Constructor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  if(!Constructor){fail('当前浏览器不支持语音识别，可使用下方文字辅助提问。');return;}
  cancel();setPhase('recording');
  session.current=new VoiceSession(new Constructor(),{update:value=>{if(alive.current)setTranscript(value);},error:fail,done:value=>{if(!alive.current)return;clearTimer();if(value.trim().length>2000){fail('识别的问题超过 2000 字，请缩短后重试或使用文字辅助。');return;}setTranscript(value.trim());setPhase('review');}});session.current.start();
 };
 const stop=()=>{setPhase('processing');timer.current=setTimeout(()=>{session.current?.cancel();fail('语音转写超时，请重新录音或使用文字辅助。');},12000);session.current?.stop(false);};
 return <section className="voice-question-input" aria-label="语音提问">
  {phase==='idle'?<button className="voice-question-primary" disabled={disabled} onClick={start}><Mic size={22}/><span>开始语音提问</span></button>:phase==='review'?<div className="voice-question-review"><label>识别到的问题<textarea aria-label="识别问题" maxLength={2000} rows={3} value={transcript} onChange={event=>setTranscript(event.target.value)}/></label><div><button onClick={start} disabled={disabled}>重新录音</button><button className="voice-question-confirm" disabled={disabled||!transcript.trim()} onClick={()=>{onChange(transcript.trim());onQuestion(transcript.trim());setPhase('idle');}}>确认提问<Send size={15}/></button></div></div>:<div className="voice-question-recording"><p role="status">{phase==='processing'?'正在转写…':transcript||'正在聆听，请说出你的问题…'}</p><div><button onClick={cancel} aria-label="取消录音"><X size={16}/>取消</button><button onClick={stop} disabled={phase==='processing'} aria-label="结束录音"><Square size={16}/>结束录音</button></div></div>}
  {phase==='idle'&&!error&&<small>说完后结束录音，核对识别内容再提问。</small>}
  {error&&<p className="voice-question-error" role="alert">{error}</p>}
  <details open={typed} onToggle={event=>setTyped(event.currentTarget.open)}><summary>文字辅助输入</summary><form onSubmit={event=>{event.preventDefault();cancel();onQuestion(question);}}><input aria-label="演示追问" placeholder="输入你想了解的问题…" value={question} maxLength={2000} onChange={event=>onChange(event.target.value)}/><button aria-label="发送问题" disabled={disabled||!question.trim()}><Send size={16}/></button></form></details>
 </section>;
}
