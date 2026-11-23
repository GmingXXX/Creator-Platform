import type {Template} from '../../domain/types';
export function rankTemplates(items:Template[]):Template[]{
 const rank=(field:'likes'|'uses',item:Template)=>items.filter(other=>other[field]>item[field]).length;
 return [...items].sort((a,b)=>(rank('likes',a)+rank('uses',a))-(rank('likes',b)+rank('uses',b))||b.uses-a.uses||a.id.localeCompare(b.id));
}
export function applyPrompt(current:string,prompt:string){return current.trim()?`${current}\n\n${prompt}`:prompt;}
export function joinDictation(current:string,transcript:string){return transcript.trim()?[current,transcript.trim()].filter(Boolean).join('\n'):current;}
export interface Recognition {
 lang:string;continuous:boolean;interimResults:boolean;
 onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onend:(()=>void)|null;onerror:((event:{error:string})=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
}
const errors:Record<string,string>={'not-allowed':'未获得麦克风权限，请允许访问后重试。','service-not-allowed':'当前浏览器的语音服务不可用，请使用文字输入。','audio-capture':'无法使用麦克风，请检查设备。','network':'语音识别网络连接失败，请重试。','no-speech':'没有识别到语音，请重试。'};
export class VoiceSession {
 private active=false;private send=false;private transcript='';
 constructor(private recognition:Recognition,private callbacks:{done:(text:string,send:boolean)=>void;error:(message:string)=>void;update:(text:string)=>void}){}
 start(){
  this.active=true;this.recognition.lang='zh-CN';this.recognition.continuous=true;this.recognition.interimResults=true;
  this.recognition.onresult=event=>{if(!this.active)return;this.transcript=Array.from(event.results).map(result=>result[0]?.transcript||'').join('');this.callbacks.update(this.transcript);};
  this.recognition.onerror=event=>{if(!this.active)return;this.active=false;this.callbacks.error(errors[event.error]||'语音识别失败，请重试或输入文字。');};
  this.recognition.onend=()=>{if(!this.active)return;this.active=false;if(this.transcript.trim())this.callbacks.done(this.transcript,this.send);else this.callbacks.error('没有识别到语音，请重试。');};
  try{this.recognition.start();}catch{this.active=false;this.callbacks.error('无法启动语音输入，请检查麦克风权限。');}
 }
 stop(send:boolean){if(!this.active)return;this.send=send;try{this.recognition.stop();}catch{this.cancel();this.callbacks.error('语音输入未完成，请重试。');}}
 cancel(){this.active=false;try{this.recognition.abort();}catch{/* Already ended. */}}
}
