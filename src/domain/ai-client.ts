import {useEffect,useState} from 'react';
export interface AIMessage {role:'system'|'user'|'assistant';content:string}
export interface AIConfig {models:{id:string;label:string}[];configured?:{deepseek:boolean;image:boolean}}
export class AIRequestError extends Error {
 constructor(message:string,readonly status:number){super(message);this.name='AIRequestError';}
}
export async function aiRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),180000);
 const abort=()=>controller.abort();if(signal?.aborted)controller.abort();signal?.addEventListener('abort',abort,{once:true});
 try{const response=await fetch(`/api/ai/${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json','X-ZC-Client':'studio'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
 const data=await response.json().catch(()=>({error:'AI 服务未启动或返回了无效响应，请启动服务后重试。'}));
 if(!response.ok)throw new AIRequestError(typeof data.error==='string'?data.error:data.error?.message||'AI 请求未完成，请重试。',response.status);return data as T;
 }catch(error){if(controller.signal.aborted)throw new Error(signal?.aborted?'请求已停止。':'请求超时，内容已保留，请重试。');throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export function aiChat(model:string,messages:AIMessage[],signal?:AbortSignal){return aiRequest<{content:string;model:string}>('chat',{model,messages,responseFormat:'json'},signal)}
export function useAIModels(){
 const [config,setConfig]=useState<AIConfig>(),[error,setError]=useState<string>(),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;aiRequest<AIConfig>('config').then(c=>{if(active)setConfig(c)}).catch(()=>{if(active)setError('AI 服务未连接')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return {models:[...(config?.models||[{id:'deepseek-flash',label:'DeepSeek Flash'},{id:'deepseek-v4-pro',label:'DeepSeek Pro'}]),{id:'demo',label:'演示模式 · 离线示例'}],available:!!config?.configured?.deepseek,loading,error};
}
