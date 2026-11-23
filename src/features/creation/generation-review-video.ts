import {assertAIWorkspaceWrite} from '../../domain/workspace-ai-access';
import {generateVideo} from '../../domain/video-generation';
import {useStudio} from '../../domain/store';
import {assetAvailableForAI} from '../../domain/asset-access';
import {AIRequestError} from '../../domain/ai-client';
import {materialRequestId} from './material-review-logic';
interface VideoDraft {key:string;prompt:string;status:'pending'|'failed'|'succeeded';assetId?:string;referenceImage?:string}
const storageKey=(workspace:string,key:string)=>`zc-review-video:${workspace}:${key}`;
export function readReviewVideo(workspace:string,key:string):VideoDraft|undefined{try{const draft=JSON.parse(localStorage.getItem(storageKey(workspace,key))||'null');return draft&&typeof draft.key==='string'&&typeof draft.prompt==='string'&&['pending','failed','succeeded'].includes(draft.status)&&(draft.referenceImage===undefined||typeof draft.referenceImage==='string'&&/^\/api\/ai\/media\/[a-f\d]{32}\.png$/.test(draft.referenceImage))?draft:undefined;}catch{return undefined;}}
export async function generateReviewVideo(input:{prompt:string;workspaceId:string;requestKey:string;styleId?:string;referenceImage?:string;newVersion?:boolean;signal?:AbortSignal}){
 const {prompt,workspaceId,requestKey,styleId,signal}=input;
 assertAIWorkspaceWrite(workspaceId);
 if(!prompt.trim()||prompt.length>1500)throw new Error('视频画面描述与风格要求合计需要为 1–1500 字符，请缩短描述。');
 const saved=readReviewVideo(workspaceId,requestKey);
 if(saved?.status==='pending'&&saved.prompt!==prompt)throw new Error('请先继续查询原视频任务；完成后可以调整描述生成新版本。');
 if(saved?.status==='succeeded'&&!input.newVersion&&saved.prompt===prompt){const cached=useStudio.getState().assets.find(asset=>asset.id===saved.assetId&&asset.workspaceId===workspaceId&&assetAvailableForAI(asset,workspaceId));if(cached)return cached;throw new Error('原视频素材已不可用，请生成新版本。');}
 const referenceImage=input.referenceImage&&/^\/api\/ai\/media\/[a-f\d]{32}\.png$/.test(input.referenceImage)?input.referenceImage:undefined;
 const draft:VideoDraft=saved?.status==='pending'?saved:{key:materialRequestId(`${workspaceId}:${requestKey}:${crypto.randomUUID()}`,Date.now()),prompt,referenceImage,status:'pending'};
 const save=(next:VideoDraft)=>{assertAIWorkspaceWrite(workspaceId);localStorage.setItem(storageKey(workspaceId,requestKey),JSON.stringify(next));};save(draft);
 try{
  const asset=await generateVideo(prompt,{workspaceId,styleId,requestKey:draft.key,reviewSlot:requestKey,referenceImage:draft.referenceImage,duration:5,onProgress:task=>{if(task.status==='failed'&&!task.retryable)save({...draft,status:'failed'});}},signal);
  assertAIWorkspaceWrite(workspaceId);
  const result={...asset,package:asset.package?{...asset.package,params:{...asset.package.params,reviewSlot:requestKey}}:undefined};useStudio.getState().addAsset(result);save({...draft,status:'succeeded',assetId:asset.id});return result;
 }catch(error){if(error instanceof AIRequestError&&[400,422].includes(error.status))save({...draft,status:'failed'});throw error;}
}
