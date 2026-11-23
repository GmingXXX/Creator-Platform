import {normalizePresentationVoice,voiceProfileKey,type PresentationVoiceSettings} from './presentation-voice';
import {aiRequest} from './ai-client';
const cache=new Map<string,string>();
export async function requestPresentationSpeech(text:string,signal?:AbortSignal,force=false,voice?:PresentationVoiceSettings):Promise<string>{
 const content=text.trim();if(!content)throw new Error('本页还没有讲稿，请先补充讲稿');if(content.length>6000)throw new Error('讲稿过长，请拆分为多个页面');
 const key=JSON.stringify([content,voiceProfileKey(voice)]);const existing=cache.get(key);if(existing&&!force)return existing;
 const result=await aiRequest<{url:string}>('speech',{text:content,...(voice?{speaker:normalizePresentationVoice(voice).speaker,style:normalizePresentationVoice(voice).style}:{})},signal);
 if(typeof result.url!=='string'||!/^\/api\/ai\/(?:speech|audio|media)\/[a-zA-Z0-9._-]+$/.test(result.url))throw new Error('语音服务返回了无效音频地址');
 cache.set(key,result.url);return result.url;
}
