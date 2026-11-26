export interface PresentationVoiceSettings {
 speaker:string;
 style:'professional'|'warm'|'formal';
 pitch:0;
 cloneSample?:{assetId:string;name:string;status:'pending'|'demo-ready';selected?:boolean};
}
export const DEFAULT_VOICE:PresentationVoiceSettings={speaker:'zh_male_ruyayichen_uranus_bigtts',style:'professional',pitch:0};
export const voiceStyles=[{value:'professional',label:'自然专业'},{value:'warm',label:'亲切讲述'},{value:'formal',label:'庄重汇报'}] as const;
export function normalizePresentationVoice(value:unknown):PresentationVoiceSettings {
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const sample=raw.cloneSample&&typeof raw.cloneSample==='object'?raw.cloneSample as Record<string,unknown>:{};
 return {...DEFAULT_VOICE,style:voiceStyles.some(style=>style.value===raw.style)?raw.style as PresentationVoiceSettings['style']:'professional',
 ...(typeof sample.assetId==='string'&&sample.assetId.trim()&&sample.assetId.length<=200&&typeof sample.name==='string'&&(sample.status==='pending'||sample.status==='demo-ready')?{cloneSample:{assetId:sample.assetId,name:sample.name.slice(0,200),status:sample.status as 'pending'|'demo-ready',...(sample.status==='demo-ready'&&sample.selected===true?{selected:true}:{})}}:{})};
}
export function voiceProfileKey(voice?:PresentationVoiceSettings):string {
 const value=normalizePresentationVoice(voice);return `${value.speaker}:${value.style}`;
}

export function applyPresentationVoice<T extends {voice?:PresentationVoiceSettings;rate:number;pages:Record<string,{sentences:{audioUrl?:string;audioText?:string;audioProfileKey?:string;duration?:number}[]}>}>(settings:T,voice:PresentationVoiceSettings,rate:number):T {
 const normalized=normalizePresentationVoice(voice),changed=voiceProfileKey(settings.voice)!==voiceProfileKey(normalized);
 return {...settings,voice:normalized,rate:Number.isFinite(rate)?Math.max(.5,Math.min(2,rate)):1,pages:changed?Object.fromEntries(Object.entries(settings.pages).map(([id,page])=>[id,{...page,sentences:page.sentences.map(line=>({...line,audioUrl:undefined,audioText:undefined,audioProfileKey:undefined,duration:undefined}))}])):settings.pages};
}
