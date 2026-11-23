import type {Asset, SceneNode, Work} from '../../domain/types';
import {now} from '../../domain/scenes';

export interface EditorImageTask {id:string;status:'queued'|'pending'|'running'|'succeeded'|'failed';retryable?:boolean;url?:string;error?:string}
export interface ImageDraft {retryable?:boolean;requestId:string;taskId?:string;prompt:string;size:string;assetId?:string;status:'pending'|'succeeded'|'failed'}

/** Only server-owned image files can become generated assets. Model text never supplies a URL. */
export function editorImageAsset(task:EditorImageTask,prompt:string,work:Pick<Work,'workspaceId'|'styleId'>):Asset {
 if(task.status!=='succeeded'||!/^[a-f\d]{32}$/.test(task.id)||task.url!==`/api/ai/media/${task.id}.png`)
  throw new Error('生成图片尚未完成或返回地址无效，请重新查询任务。');
 return {id:`asset-editor-image-${task.id}`,workspaceId:work.workspaceId||'personal',name:`AI 图片 · ${prompt.slice(0,24)}`,kind:'image',src:task.url,preview:task.url,description:'万相生成的概念素材，已保留提示词。',tags:['AI生成','概念素材'],author:'纪鸣',createdAt:now(),source:'generated',public:false,
  metadata:{analysis:{status:'ready',summary:prompt,tags:['AI生成'],basis:'inherited'},business:{note:'概念图片，请核对后使用',subject:'',confirmed:false,usage:'reusable',allowAi:true}},
  package:{id:`package-editor-${task.id}`,version:'1.0',prompt,files:[{name:'生成图片.png',type:'image',src:task.url}],skillIds:[],params:{model:'万相',taskId:task.id},styleId:work.styleId,complete:true}};
}
export function imageDraftStorageKey(workId:string,pageId:string,nodeId?:string){return `zc-editor-image:${workId}:${pageId}:${nodeId||'background'}`;}
export function readImageDraft(key:string):ImageDraft|undefined {
 try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(!raw||typeof raw.requestId!=='string'||typeof raw.prompt!=='string'||typeof raw.size!=='string'||!['pending','succeeded','failed'].includes(raw.status))return;return raw as ImageDraft;}catch{return;}
}

/** Match the provider's supported output ratios, using the selected image's dimensions. */
export function editorImageSize(work:Pick<Work,'width'|'height'>,node?:Pick<SceneNode,'w'|'h'>):string {
 const ratio=node?node.w/node.h:work.width/work.height;
 return ratio>=3?'2560*640':ratio>=1.5?'1696*960':ratio>=1.15?'1472*1104':ratio<=1/3?'640*2560':ratio<=.67?'960*1696':ratio<=.87?'1104*1472':'1280*1280';
}
