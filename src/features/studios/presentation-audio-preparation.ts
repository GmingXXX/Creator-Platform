import type {Work} from '../../domain/types';
import {requestPresentationSpeech} from '../../domain/presentation-audio';
import {voiceProfileKey} from '../../domain/presentation-voice';
import {readPresentationStudio,writePresentationStudio} from './presentation-studio';

type Options={
 signal?:AbortSignal;
 maxRequests?:number;
 speech?:typeof requestPresentationSpeech;
 beforeRequest?:()=>void;
 onPrepared?:(work:Work)=>void;
 onProgress?:(prepared:number,total:number)=>void;
};
type AudioPreparation={work:Work;pending:number;status:'complete'|'pending'|'failed'|'paused';message:string};

/** Warm only a few lines. Full narration is generated on demand by the viewer. */
export async function preparePresentationAudio(work:Work,options:Options={}):Promise<AudioPreparation>{
 let settings=readPresentationStudio(work),attempts=0;
 const profile=voiceProfileKey(settings.voice),speech=options.speech||requestPresentationSpeech;
 const budget=Math.max(0,Math.min(8,Math.floor(options.maxRequests??4)));
 const total=Object.values(settings.pages).reduce((sum,page)=>sum+page.sentences.length,0);
 let status:AudioPreparation['status']='pending';
 outer:for(const page of work.pages){
  for(const sentence of settings.pages[page.id].sentences){
   if(sentence.audioUrl&&sentence.audioText===sentence.text)continue;
   if(options.signal?.aborted){status='paused';break outer;}
   if(attempts>=budget)break outer;
   options.beforeRequest?.();
   attempts++;
   let audioUrl:string;
   try{audioUrl=await speech(sentence.text,options.signal,false,settings.voice);}
   catch{status=options.signal?.aborted?'paused':'failed';break outer;}
   const studio=settings.pages[page.id];
   settings={...settings,pages:{...settings.pages,[page.id]:{...studio,sentences:studio.sentences.map(line=>line.id===sentence.id?{...line,audioUrl,audioText:line.text,audioProfileKey:profile}:line)}}};
   const prepared=writePresentationStudio(work,settings);
   options.onPrepared?.(prepared);
   options.onProgress?.(Object.values(settings.pages).reduce((sum,p)=>sum+p.sentences.filter(line=>line.audioUrl).length,0),total);
  }
 }
 const pending=Object.values(settings.pages).reduce((sum,page)=>sum+page.sentences.filter(line=>!line.audioUrl).length,0);
 if(!pending)status='complete';
 const message=status==='complete'?'讲解音频已准备完成':status==='failed'
  ?`作品已保存，${pending} 句讲解音频暂未生成；请稍后在讲解编排中重试，或演示时按需生成。`
  :status==='paused'?`作品已保存，配音已暂停；剩余 ${pending} 句可在讲解编排或演示时继续生成。`
  :`作品已保存，已预备 ${total-pending} 句讲解音频；剩余 ${pending} 句将在演示时按需生成。`;
 return {work:writePresentationStudio(work,settings),pending,status,message};
}
