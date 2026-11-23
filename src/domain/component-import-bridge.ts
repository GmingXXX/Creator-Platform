import { validComponentValue } from './component-import';
import type { ComponentField, ComponentValues } from './component-import';

/** Persisted defaults and the editor bridge live with the HTML, so saved/exported components render without a host. */
export function applyComponentValues(html: string, fields: ComponentField[], values: ComponentValues): string {
  const defaults = Object.fromEntries(fields.map(field => [field.key, field.default]));
  for (const [key, value] of Object.entries(values)) {
    const field = fields.find(item => item.key === key);
    if (!field || !validComponentValue(field, value)) throw new Error(`组件参数「${field?.label || key}」无效。`);
  }
  const payload = JSON.stringify({ fields, initial: { ...defaults, ...values } }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const bootstrap = `<script data-zhichuang-component-sdk="1">(()=>{
const config=${payload};
let props={...config.initial},channel='',requestId=0,pendingType='zhichuang:component:ready';
const subscribers=new Set();
function valid(field,value){
 if(field.type==='boolean')return typeof value==='boolean';
 if(field.type==='number')return typeof value==='number'&&Number.isFinite(value)&&(field.min===undefined||value>=field.min)&&(field.max===undefined||value<=field.max);
 return typeof value==='string'&&value.length<=(field.type==='textarea'?4000:500)&&(field.type!=='color'||/^#[\\da-f]{6}$/i.test(value));
}
function send(type,extra={}){if(channel)parent.postMessage({type,channel,requestId,...extra},'*');}
function render(type){
 if(!subscribers.size)return;
 try{
  for(const fn of subscribers){const result=fn(Object.freeze({...props}));if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});send('zhichuang:component:error',{message:'本版参数接口需要同步更新，请调整组件回调。'});return;}}
  send(type,{props:{...props}});
 }catch{send('zhichuang:component:error',{message:'组件渲染失败，请检查组件代码。'});}
}
window.ZhichuangComponent={
 getProps:()=>({...props}),
 subscribe(fn){if(typeof fn!=='function')throw new Error('组件订阅需要函数');subscribers.add(fn);render(pendingType);return()=>subscribers.delete(fn);}
};
addEventListener('message',event=>{
 if(event.source!==parent)return;
 const data=event.data;
 if(!data||typeof data!=='object'||!['zhichuang:component:init','zhichuang:component:props'].includes(data.type)||typeof data.channel!=='string'||!data.channel||data.channel.length>200||!Number.isFinite(data.requestId))return;
 if(data.type==='zhichuang:component:props'&&data.channel!==channel)return;
 if(data.type==='zhichuang:component:init')channel=data.channel;
 requestId=data.requestId;
 if(!data.props||typeof data.props!=='object'||Array.isArray(data.props)){send('zhichuang:component:error',{message:'组件参数格式无效。'});return;}
 for(const [key,value] of Object.entries(data.props)){const field=config.fields.find(item=>item.key===key);if(!field||!valid(field,value)){send('zhichuang:component:error',{message:'组件参数值无效。'});return;}}
 props={...props,...data.props};pendingType=data.type==='zhichuang:component:init'?'zhichuang:component:ready':'zhichuang:component:applied';render(pendingType);
});
})();</script>`;
  const withoutPrevious = html.replace(/<script\b[^>]*data-zhichuang-component-sdk="1"[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  if (/<head\b[^>]*>/i.test(withoutPrevious)) return withoutPrevious.replace(/<head\b[^>]*>/i, match => match + bootstrap);
  const doctype = withoutPrevious.match(/^\s*<!doctype[^>]*>/i)?.[0];
  return doctype ? doctype + bootstrap + withoutPrevious.slice(doctype.length) : bootstrap + withoutPrevious;
}
