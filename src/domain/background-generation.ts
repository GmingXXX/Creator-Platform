import {assertAIWorkspaceWrite,canWriteAIWorkspace} from './workspace-ai-access';
import {useStudio} from './store';
import {aiRequest,AIRequestError} from './ai-client';
import {now,uid} from './scenes';
import {assetAvailableForInsertion} from './asset-access';
import {getAssetMetadata} from './asset-metadata';
import {visualGenerationPrompt} from './visual-guidelines';
import type {Asset,BackgroundDraft,Run} from './types';
const inflight=new Set<string>();
function patch(id:string,value:Partial<Pick<Run,'backgroundDraft'|'generatedBackgroundIds'|'backgroundAssetId'|'assetId'>>){useStudio.setState(s=>({runs:s.runs.map(r=>r.id===id&&canWriteAIWorkspace(r.workspaceId)?{...r,...value}:r)}));}
export function beginBackground(id:string,prompt:string){
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===id);
 if(!run)throw new Error('创作任务已不存在');
 assertAIWorkspaceWrite(run.workspaceId);
 if(run.backgroundDraft?.status==='pending'||run.backgroundDraft?.status==='failed'&&run.backgroundDraft.retryable||inflight.has(id))throw new Error('上一张图片仍在生成，请先查看结果');
 if(!prompt.trim()||prompt.trim().length>1500)throw new Error('请填写 1–1500 字的画面描述');
 const work=state.works.find(w=>w.id===run.workId);
 const ratio=(work?.width||1920)/(work?.height||1080);
 if(ratio>4||ratio<.25)throw new Error('背景生成支持 1:4 至 4:1 的画面比例，请调整画布尺寸或从素材库选择图片');
 patch(id,{backgroundDraft:{requestId:uid('background'),prompt:prompt.trim(),size:`${work?.width||1920}*${work?.height||1080}`,status:'pending'}});
}
function sameRequestOwner(latest:Run|undefined,run:Run,requestId:string):boolean {
 return Boolean(latest&&latest.backgroundDraft?.requestId===requestId&&(latest.workspaceId||'personal')===(run.workspaceId||'personal')&&latest.workId===run.workId&&canWriteAIWorkspace(run.workspaceId));
}
type ImageTask={id:string;status:string;url?:string;error?:string;retryable?:boolean};
export async function advanceBackground(id:string){
 if(inflight.has(id))return;
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===id),draft=run?.backgroundDraft;
 if(!run||!draft||draft.status==='ready'||draft.status==='failed'&&!draft.retryable||!canWriteAIWorkspace(run.workspaceId))return;
 inflight.add(id);
 try{
  const polling=!!draft.taskId&&draft.status!=='failed';
  const task=await aiRequest<ImageTask>(polling?`images/${encodeURIComponent(draft.taskId!)}`:'images',polling?undefined:{prompt:visualGenerationPrompt(draft.prompt,state.systems.find(s=>s.id===run.styleId)),size:draft.size,workspaceId:run.workspaceId||'personal',idempotencyKey:draft.requestId});
  const latest=useStudio.getState().runs.find(r=>r.id===id);if(!sameRequestOwner(latest,run,draft.requestId))return;
  const next:BackgroundDraft={...draft,taskId:task.id,error:undefined,status:'pending',retryable:false};
  if(task.status==='failed'){patch(id,{backgroundDraft:{...next,status:'failed',error:task.error||'图片生成失败',retryable:!!task.retryable}});return;}
  if(task.status!=='succeeded'){patch(id,{backgroundDraft:next});return;}
  if(!task.url?.startsWith('/api/ai/media/')){patch(id,{backgroundDraft:{...next,status:'failed',error:'图片地址无效'}});return;}
  const asset:Asset={id:`asset-${draft.requestId}`,workspaceId:run.workspaceId||'personal',name:`${run.aiPlan?.title||'创作'} · 背景 ${(latest!.generatedBackgroundIds?.length||0)+1}`,kind:'image',src:task.url,preview:task.url,description:'根据已确认描述生成的背景，可继续调整描述生成新版本。',tags:['AI生成','背景'],author:'纪鸣',createdAt:now(),source:'generated',metadata:{analysis:{status:'ready',summary:draft.prompt,tags:['背景'],basis:'inherited'},business:{note:'AI生成的概念素材',subject:'',confirmed:false,usage:'reusable',allowAi:true}},package:{id:uid('package'),version:'1.0',prompt:draft.prompt,skillIds:[],styleId:run.styleId,params:{model:'万相',taskId:task.id,size:draft.size},files:[{name:'背景.png',type:'image',src:task.url}],complete:true}};
  useStudio.getState().addAsset(asset);
  patch(id,{backgroundDraft:{...next,status:'ready',assetId:asset.id},generatedBackgroundIds:[...(latest!.generatedBackgroundIds||[]),asset.id]});
 }catch(error){
  if(!sameRequestOwner(useStudio.getState().runs.find(r=>r.id===id),run,draft.requestId))return;
  const retryable=!(error instanceof AIRequestError&&[400,401,403,404,409,413,422].includes(error.status));
  patch(id,{backgroundDraft:{...draft,status:'failed',retryable,error:error instanceof Error?error.message:'图片服务暂不可用'}});}finally{inflight.delete(id);}
}
export function applyBackground(id:string,assetId:string){
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===id),asset=state.assets.find(a=>a.id===assetId);
 if(!run||!asset||asset.kind!=='image'||!assetAvailableForInsertion(asset,run.workspaceId)||getAssetMetadata(asset).business.usage==='reference')throw new Error('这张图片当前不能用于作品，请重新选择');
 assertAIWorkspaceWrite(run.workspaceId);
 const work=state.works.find(w=>w.id===run.workId&&!w.deletedAt);
 if(run.workId&&!work)throw new Error('作品已不存在或已移入回收站');
 if(work){
  const files=work.creationPackage?.files||[];
  state.saveWork({...work,pages:work.pages.map((page,i)=>i? page:{...page,backgroundImage:asset.src,backgroundAssetId:asset.id}),creationPackage:work.creationPackage?{...work.creationPackage,files:files.some(f=>f.src===asset.src)?files:[...files,{name:asset.name,type:'image',src:asset.src}]}:undefined});
 }
 patch(id,{backgroundAssetId:asset.id,...(!work?{assetId:asset.id}:{})});
}
