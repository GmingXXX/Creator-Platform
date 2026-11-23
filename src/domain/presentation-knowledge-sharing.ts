import type {CreationPackage,Work} from './types';
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
/** ACP bindings are private routing configuration and must never travel with a shared artifact. */
export function withoutPresentationKnowledge(params:CreationPackage['params']):CreationPackage['params'] {
 const {presentationStudio,...rest}=params;
 if(presentationStudio===undefined)return {...params};
 try {
  const studio:unknown=JSON.parse(presentationStudio);if(!isRecord(studio))return rest;
  if(!isRecord(studio.qa))return {...rest,presentationStudio:JSON.stringify({...studio,qa:undefined})};
  const {knowledge,...qa}=studio.qa;
  return {...rest,presentationStudio:JSON.stringify({...studio,qa})};
 }catch{return rest;}
}
export function workWithoutPresentationKnowledge(work:Work):Work {
 return {...work,...(work.creationPackage?{creationPackage:{...work.creationPackage,params:withoutPresentationKnowledge(work.creationPackage.params)}}:{})};
}
