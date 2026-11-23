export interface NavigationMemory {path:string;origin?:string;returns:Record<string,string>;previewReturns:Record<string,string>}
export const emptyNavigation=():NavigationMemory=>({path:'',returns:{},previewReturns:{}});
const safeOrigin=(value:unknown):string|undefined=>typeof value==='string'&&(value==='/'||/^\/projects(?:\?[^#]*)?$/.test(value))?value:undefined;
const safePreviewTarget=(value:unknown):string|undefined=>safeOrigin(value)||(typeof value==='string'&&/^\/(?:create|editor|presentations|present|video|dream)\/[a-zA-Z0-9_-]+(?:\?[^#]*)?$/.test(value)?value:undefined);
const workId=(path:string)=>/^\/(?:editor|presentations|present|video|dream|preview)\/([^/?]+)/.exec(path)?.[1];
/** Only home/project-list origins are valid; editor and legacy hub routes never become return targets. */
export function advanceNavigation(memory:NavigationMemory,path:string,explicitOrigin?:unknown):NavigationMemory{
 const explicit=safeOrigin(explicitOrigin),id=workId(path),oldId=workId(memory.path);
 const currentOrigin=path==='/'||path.startsWith('/?')?explicit||'/':safeOrigin(path);
 if(currentOrigin)return {...memory,path,origin:currentOrigin};
 if(path.startsWith('/create/'))return {...memory,path,origin:explicit||memory.origin||(oldId?memory.returns[oldId]:undefined)};
 if(id){
  const fromEditor=Boolean(oldId),origin=explicit||(!fromEditor?memory.origin:memory.returns[id]);
  const returns={...memory.returns};if(origin)returns[id]=origin;else delete returns[id];
  const previewReturns={...memory.previewReturns};
  if(path.startsWith('/preview/')&&path!==memory.path){
   const target=memory.path.startsWith('/create/')?safePreviewTarget(memory.path):oldId===id&&!memory.path.startsWith('/preview/')?safePreviewTarget(memory.path):origin;
   if(target)previewReturns[id]=target;else delete previewReturns[id];
  }
  return {path,returns,previewReturns,origin:undefined};
 }
 return {...memory,path,origin:undefined};
}
export function editorReturnTarget(memory:NavigationMemory,id:string,fallback='/projects'){return safeOrigin(memory.returns[id])||safeOrigin(fallback)||'/projects';}
let current=emptyNavigation();
export function trackEditorNavigation(path:string,origin?:unknown){current=advanceNavigation(current,path,origin);}
export function currentEditorReturn(id:string,fallback='/projects'){return editorReturnTarget(current,id,fallback);}

export function previewReturnTarget(memory:NavigationMemory,id:string,fallback='/projects'){return safePreviewTarget(memory.previewReturns[id])||editorReturnTarget(memory,id,fallback);}
export function currentPreviewReturn(id:string,fallback='/projects'){return previewReturnTarget(current,id,fallback);}
