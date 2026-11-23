import type {Asset, CreationPackage, StoryEdge, StoryNode} from '../../domain/types';
import {resolutions} from '../../domain/fixtures';

export const creationResolutions = resolutions;
export function resolveCreationSize(value:string,width:number,height:number){
 const [w,h]=value==='custom'?[width,height]:value.split('×').map(Number);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<320||h<320||w>16384||h>16384)throw new Error('宽高需为 320–16384 之间的整数');
 return {width:w,height:h};
}
export const createBlankStory=():{nodes:StoryNode[];edges:StoryEdge[]}=>({nodes:[],edges:[]});
function jsonObject(content:string):Record<string,unknown>{
 const clean=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 const value:unknown=JSON.parse(clean);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('生成结果格式不正确，请重试');return value as Record<string,unknown>;
}
const line=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
export function parseStoryDraft(content:string){
 const value=jsonObject(content);if(!Array.isArray(value.nodes)||!value.nodes.length||value.nodes.length>40||!Array.isArray(value.edges)||value.edges.length>100)throw new Error('请生成 1–40 个节点及有效的连接');
 const nodes:StoryNode[]=value.nodes.map((item:unknown,i:number)=>{
  if(!item||typeof item!=='object')throw new Error('节点内容无效');const node=item as Record<string,unknown>;
  const id=line(node.id,80),type=line(node.type,20),title=line(node.title,80);if(!id||!title||!['start','scene','choice','end'].includes(type))throw new Error('节点缺少名称或有效类型');
  return {id,type,title,text:line(node.text,3000),x:70+(i%4)*300,y:90+Math.floor(i/4)*240};
 });
 const ids=new Set(nodes.map(n=>n.id));if(ids.size!==nodes.length)throw new Error('节点编号重复，请重新生成');
 const edges:StoryEdge[]=value.edges.map((item:unknown,i:number)=>{if(!item||typeof item!=='object')throw new Error('连接信息无效');const edge=item as Record<string,unknown>;const source=line(edge.source,80),target=line(edge.target,80);if(!ids.has(source)||!ids.has(target)||source===target)throw new Error('节点连接不完整，请重新生成');return {id:`draft-edge-${i}`,source,target,label:line(edge.label,100)||'继续'};});
 return {nodes,edges};
}
export interface OutlineSection{title:string;narration:string}
export function parseOutlineDraft(content:string):OutlineSection[]{
 const value=jsonObject(content);if(!Array.isArray(value.sections)||value.sections.length<1||value.sections.length>30)throw new Error('请生成 1–30 个章节');
 return value.sections.map((item:unknown)=>{if(!item||typeof item!=='object')throw new Error('章节格式不正确');const section=item as Record<string,unknown>,title=line(section.title,100);if(!title)throw new Error('章节标题不能为空');return {title,narration:line(section.narration,3000)};});
}
export function storyMediaKind(node:{media?:string;mediaAssetId?:string},assets:Asset[]=[]):'image'|'video'|'html'{
 const asset=assets.find(a=>a.id===node.mediaAssetId||a.src===node.media);
 if(asset?.kind==='html'||/\.html?(?:[?#]|$)/i.test(node.media||''))return 'html';
 if(asset?.kind==='video'||/\.(mp4|webm|mov)(?:[?#]|$)/i.test(node.media||''))return 'video';return 'image';
}
export function sourcePackage(prompt:string,assets:Asset[],params:Record<string,string>):CreationPackage{
 return {id:crypto.randomUUID(),version:'1.0',prompt,files:assets.map(a=>({name:a.name,type:a.kind,src:a.src})),skillIds:[],params:{...params,referenceAssetIds:JSON.stringify(assets.map(a=>a.id))},complete:true};
}

/** Keep each message within the server's 12k limit, including JSON escaping. */
export function creationMessages(instruction:string,metadata:Record<string,unknown>,reference:string):import('../../domain/ai-client').AIMessage[]{
 const text=reference.slice(0,24000),context=Array.from({length:Math.ceil(text.length/10000)},(_,i)=>({role:'user' as const,content:`参考内容 ${i+1}：\n${text.slice(i*10000,(i+1)*10000)}`}));
 return [{role:'system',content:instruction},{role:'user',content:JSON.stringify(metadata)},...context];
}
