import {useEffect,useRef,useState} from 'react';
import {requestPresentationSpeech} from '../../domain/presentation-audio';
import {voiceProfileKey,type PresentationVoiceSettings} from '../../domain/presentation-voice';
/** Separate audio preserves the paused narration element and its exact playback position. */
export function useAnswerSpeech(voice:PresentationVoiceSettings|undefined,rate:number,muted:boolean){
 const [playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const element=useRef<HTMLAudioElement|null>(null),request=useRef<AbortController|null>(null),alive=useRef(true);
 const stop=()=>{request.current?.abort();request.current=null;element.current?.pause();setPlaying(false);setLoading(false);};
 const profile=voiceProfileKey(voice);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();element.current?.pause();};},[]);
 useEffect(()=>{stop();setError('');},[profile]);
 useEffect(()=>{if(element.current){element.current.muted=muted;element.current.playbackRate=rate;}},[muted,rate]);
 const speak=async(text:string)=>{
  stop();setError('');setLoading(true);const controller=new AbortController();request.current=controller;
  try{
   const url=await requestPresentationSpeech(text,controller.signal,false,voice);if(controller.signal.aborted||!alive.current)return;
   const audio=new Audio(url);element.current=audio;audio.muted=muted;audio.playbackRate=rate;
   audio.onended=()=>{if(alive.current&&element.current===audio)setPlaying(false);};
   audio.onerror=()=>{if(alive.current&&!controller.signal.aborted&&element.current===audio){setPlaying(false);setError('回答音频加载失败，可重新播报或继续讲解。');}};
   await audio.play();if(!controller.signal.aborted&&alive.current)setPlaying(true);else audio.pause();
  }catch(reason){if(!controller.signal.aborted&&alive.current)setError(reason instanceof Error?reason.message:'回答播报失败，可点击播报回答重试。');}
  finally{if(!controller.signal.aborted&&alive.current)setLoading(false);}
 };
 return {playing,loading,error,speak,stop};
}
