import {normalizePresentationVoice,voiceProfileKey,type PresentationVoiceSettings} from '../../domain/presentation-voice';
import type {Work,ScenePage} from '../../domain/types';
import {normalizePresentationKnowledge,type PresentationKnowledgeReference} from '../../domain/presentation-knowledge';
export type PresentationMode='pages'|'narration'|'questions';
export interface NarrationCue {id:string;nodeId:string;effect:'highlight'|'underline'|'circle'}
export interface NarrationSentence {id:string;text:string;pause:number;audioUrl?:string;audioText?:string;audioProfileKey?:string;duration?:number;cues:NarrationCue[]}
export interface PresentationHotspot {id:string;nodeId:string;label:string;action:'question'|'detail'|'page';value:string}
export interface PresentationPageStudio {sentences:NarrationSentence[];transition:'none'|'fade'|'slide';hotspots:PresentationHotspot[]}
export interface PresentationStudio {version:1;rate:number;voice?:PresentationVoiceSettings;pages:Record<string,PresentationPageStudio>;qa:{enabled:boolean;scope:'work'|'page';includeReferences:boolean;knowledge?:PresentationKnowledgeReference;extraReference:string;suggestions:string[]}}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown,max=6000)=>typeof value==='string'?value.slice(0,max):'';
const bounded=(value:unknown,min:number,max:number,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
export const splitNarration=(notes:string)=>notes.match(/[^。！？!?\n]+[。！？!?]?/g)?.map(t=>t.trim()).filter(Boolean)||[];
function parseSentence(value:unknown,id:string):NarrationSentence{
 const raw=record(value),line=text(raw.text),audioUrl=text(raw.audioUrl),valid=/^\/api\/ai\/(?:speech|audio|media)\/[a-zA-Z0-9._-]+$/.test(audioUrl)&&raw.audioText===line;
 return {id:text(raw.id,120)||id,text:line,pause:bounded(raw.pause,0,10,.3),...(valid?{audioUrl,audioText:line,audioProfileKey:text(raw.audioProfileKey,200)||undefined,duration:bounded(raw.duration,.1,3600,0)||undefined}:{}),cues:Array.isArray(raw.cues)?raw.cues.slice(0,30).map((value,i)=>{const cue=record(value);return {id:text(cue.id,120)||`${id}-cue-${i}`,nodeId:text(cue.nodeId,120),effect:['highlight','underline','circle'].includes(String(cue.effect))?cue.effect as NarrationCue['effect']:'highlight'};}):[]};
}
function pageStudio(page:ScenePage,value:unknown):PresentationPageStudio{
 const raw=record(value),stored=Array.isArray(raw.sentences)?raw.sentences.slice(0,100).map((v,i)=>parseSentence(v,`${page.id}-sentence-${i}`)):[];
 const notes=page.notes||'',saved=stored.map(s=>s.text).join('');
 const available=[...stored];
 const sentences=saved===notes.replace(/\n/g,'')&&stored.length?stored:splitNarration(notes).map((line,index)=>{const found=available.findIndex(s=>s.text===line);if(found>=0)return available.splice(found,1)[0];return parseSentence({text:line},`${page.id}-sentence-${index}-${line.length}`);});
 const nodes=new Set(page.nodes.map(n=>n.id));
 return {sentences:sentences.map(s=>({...s,cues:s.cues.filter(c=>nodes.has(c.nodeId))})),transition:['fade','slide'].includes(String(raw.transition))?raw.transition as 'fade'|'slide':'none',hotspots:Array.isArray(raw.hotspots)?raw.hotspots.slice(0,50).map((v,i):PresentationHotspot=>{const h=record(v);return {id:text(h.id,120)||`${page.id}-hotspot-${i}`,nodeId:text(h.nodeId,120),label:text(h.label,100),action:['detail','page'].includes(String(h.action))?h.action as 'detail'|'page':'question',value:text(h.value,2000)};}).filter(h=>nodes.has(h.nodeId)):[]};
}
export function readPresentationStudio(work:Work):PresentationStudio{
 let raw:Record<string,unknown>={};try{raw=record(JSON.parse(work.creationPackage?.params.presentationStudio||'{}'));}catch{/* Legacy works have no studio settings. */}
 const pages=record(raw.pages),qa=record(raw.qa),voice=normalizePresentationVoice(raw.voice);
 return {version:1,rate:bounded(raw.rate,.5,2,1),voice,pages:Object.fromEntries(work.pages.map(p=>{const data=pageStudio(p,pages[p.id]);return [p.id,{...data,sentences:data.sentences.map(line=>(line.audioProfileKey||voiceProfileKey())===voiceProfileKey(voice)?line:{...line,audioUrl:undefined,audioText:undefined,audioProfileKey:undefined,duration:undefined})}]})),qa:{enabled:qa.enabled!==false,scope:qa.scope==='page'?'page':'work',includeReferences:qa.includeReferences===true,knowledge:normalizePresentationKnowledge(qa.knowledge),extraReference:text(qa.extraReference,12000),suggestions:Array.isArray(qa.suggestions)?qa.suggestions.map(v=>text(v,200)).filter(Boolean).slice(0,6):['这一页的核心观点是什么？','资料里有哪些具体成果？']}};
}
export function writePresentationStudio(work:Work,settings:PresentationStudio):Work{
 const pkg=work.creationPackage||{id:`presentation-${work.id}`,version:'1.0',prompt:'',files:[],skillIds:[],params:{},complete:true};
 return {...work,pages:work.pages.map(page=>settings.pages[page.id]?{...page,notes:settings.pages[page.id].sentences.map(s=>s.text).join('')}:page),creationPackage:{...pkg,params:{...pkg.params,presentationStudio:JSON.stringify(settings)}}};
}
export function changeSentence(settings:PresentationStudio,pageId:string,id:string,patch:Partial<NarrationSentence>):PresentationStudio{
 const page=settings.pages[pageId];if(!page)return settings;
 return {...settings,pages:{...settings.pages,[pageId]:{...page,sentences:page.sentences.map(s=>s.id!==id?s:{...s,...patch,...(patch.text!==undefined&&patch.text!==s.text?{audioUrl:undefined,audioText:undefined,audioProfileKey:undefined,duration:undefined}:{})})}}};
}
export function addSentence(settings:PresentationStudio,pageId:string):PresentationStudio{
 const p=settings.pages[pageId];if(!p)return settings;return {...settings,pages:{...settings.pages,[pageId]:{...p,sentences:[...p.sentences,{id:crypto.randomUUID(),text:'新的讲稿。',pause:.3,cues:[]}]}}};
}
export function deleteSentence(settings:PresentationStudio,pageId:string,id:string):PresentationStudio{
 const p=settings.pages[pageId];if(!p)return settings;return {...settings,pages:{...settings.pages,[pageId]:{...p,sentences:p.sentences.filter(s=>s.id!==id)}}};
}
export function narrationTimeline(sentences:NarrationSentence[],rate=1){let start=0;return sentences.map(s=>{const duration=(s.duration||Math.max(1,s.text.length/3.5))/rate,end=start+duration+s.pause;const result={...s,start,end,duration,estimated:!s.duration};start=end;return result;});}
export function questionWork(work:Work,settings:PresentationStudio,pageIndex:number):Work{
 const pkg=work.creationPackage||{id:`presentation-${work.id}`,version:'1.0',prompt:'',files:[],skillIds:[],params:{},complete:true};
 return {...work,pages:settings.qa.scope==='page'?work.pages.map((p,i)=>i===pageIndex?p:{...p,name:'不在本次问答范围',notes:'',nodes:[]}):work.pages,creationPackage:{...pkg,params:{...pkg.params,referenceText:[settings.qa.includeReferences?pkg.params.referenceText||'':'',settings.qa.extraReference].filter(Boolean).join('\n')}}};
}
