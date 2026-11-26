import {assertAIWorkspaceWrite,canWriteAIWorkspace} from './workspace-ai-access';
import {useStudio} from './store';
import {aiRequest,AIRequestError} from './ai-client';
import {now,uid} from './scenes';
import {assetAvailableForAI,assetAvailableForInsertion,workAvailableInSpace} from './asset-access';
import {getAssetMetadata} from './asset-metadata';
import {visualGenerationPrompt} from './visual-guidelines';
import {appliedBackgroundReference,buildWorkBackgroundPrompt,describeBackgroundReference,makeWorkBackgroundSample} from './work-background';
import type {Asset,BackgroundDraft,Run} from './types';

const inflight=new Set<string>();
function patch(id:string,value:Partial<Pick<Run,'backgroundDraft'|'generatedBackgroundIds'|'backgroundAssetId'|'assetId'>>){
 useStudio.setState(s=>({runs:s.runs.map(r=>r.id===id&&canWriteAIWorkspace(r.workspaceId)?{...r,...value}:r)}));
}
function prepare(id:string,prompt:string){
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===id);
 if(!run)throw new Error('创作任务已不存在');
 assertAIWorkspaceWrite(run.workspaceId);
 if(run.backgroundDraft?.status==='pending'||run.backgroundDraft?.status==='failed'&&run.backgroundDraft.retryable||inflight.has(id))throw new Error('上一张图片仍在生成，请先查看结果');
 if(!prompt.trim()||prompt.trim().length>1500)throw new Error('请填写 1–1500 字的画面描述');
 const work=state.works.find(w=>w.id===run.workId&&workAvailableInSpace(w,run.workspaceId));
 if(run.workId&&!work)throw new Error('当前空间的作品已不存在');
 const width=work?.width||1920,height=work?.height||1080,ratio=width/height;
 if(!Number.isFinite(ratio)||width<=0||height<=0||ratio>4||ratio<.25)throw new Error('背景生成支持 1:4 至 4:1 的画面比例，请调整画布尺寸或从素材库选择图片');
 const draft:BackgroundDraft={requestId:uid('background'),prompt:prompt.trim(),size:`${width}*${height}`,status:'pending'};
 return {state,run,work,draft};
}
export function beginBackground(id:string,prompt:string){
 const {draft}=prepare(id,prompt);
 patch(id,{backgroundDraft:draft});
}
function referencesFor(ids:string[],workspaceId?:string){
 const state=useStudio.getState();
 return [...new Set(ids)].map(id=>{
  const asset=state.assets.find(a=>a.id===id);
  if(!asset||!assetAvailableForAI(asset,workspaceId))throw new Error('参考素材已不可用或已关闭 AI 调用，请重新选择');
  return asset;
 });
}
export function beginWorkBackground(id:string,text:string,pageId?:string,attachmentIds:string[]=[],model?:string){
 const {state,run,work,draft}=prepare(id,text);
 if(!work)throw new Error('请选择已有作品来制作背景');
 const page=pageId?work.pages.find(p=>p.id===pageId):work.pages[0];
 if(!page)throw new Error('目标页面已不存在，请重新选择页面');
 const references=referencesFor(attachmentIds,run.workspaceId);
 const system=state.systems.find(s=>s.id===work.styleId);
 const names=references.map(describeBackgroundReference).join('；').slice(0,225);
 const currentBackground=appliedBackgroundReference(page,state.assets,run.workspaceId);
 const previous=run.backgroundDraft;
 const samePage=previous?.targetWorkId===work.id&&previous.targetPageId===page.id;
 const history=samePage?(previous.userInstructions||[previous.prompt]).slice(-3):[];
 const userInstructions=[...history,text.trim()];
 const description=buildWorkBackgroundPrompt(work,page.id,text,system,history,currentBackground);
 const refNote=names?`本次参考素材：${names}。\n`:'';
 const generationPrompt=visualGenerationPrompt((refNote+description).slice(0,1500),system);
 const bound:BackgroundDraft={...draft,userInstructions,targetWorkId:work.id,targetPageId:page.id,workTitle:work.title,pageName:page.name,styleId:work.styleId,generationPrompt,referenceIds:[...new Set([...references.map(a=>a.id),...(currentBackground?[currentBackground.id]:[])])]};
 patch(id,{backgroundDraft:bound});
 if((model||run.model)==='demo')finishBackground(run,bound,makeWorkBackgroundSample(work,page.id,system,userInstructions.join('。')));
}
function sameRequestOwner(latest:Run|undefined,run:Run,requestId:string):boolean {
 return Boolean(latest&&latest.backgroundDraft?.requestId===requestId&&(latest.workspaceId||'personal')===(run.workspaceId||'personal')&&latest.workId===run.workId&&canWriteAIWorkspace(run.workspaceId));
}
function finishBackground(run:Run,draft:BackgroundDraft,src:string){
 const latest=useStudio.getState().runs.find(r=>r.id===run.id);
 if(!latest||!sameRequestOwner(latest,run,draft.requestId))return;
 const demo=!draft.taskId,assetId=`asset-${draft.requestId}`;
 const params:Record<string,string>={model:demo?'本地样稿':'万相',size:draft.size,userPrompt:draft.prompt,
  ...(draft.taskId?{taskId:draft.taskId}:{}),
  ...(draft.targetWorkId&&draft.targetPageId?{targetWorkId:draft.targetWorkId,targetPageId:draft.targetPageId}:{})};
 const title=draft.workTitle?`${draft.workTitle} · ${draft.pageName}`:run.aiPlan?.title||'创作';
 const description=draft.generationPrompt||draft.prompt;
 const asset:Asset={id:assetId,workspaceId:run.workspaceId||'personal',name:`${title} · 背景 ${(latest.generatedBackgroundIds?.length||0)+1}`,
  kind:'image',src,preview:src,description:demo?'依据当前页面配色和布局制作的本地背景样稿。':'根据已确认描述生成的背景，可继续调整描述生成新版本。',
  tags:[demo?'演示样稿':'AI生成','背景'],author:'纪鸣',createdAt:now(),source:'generated',
  metadata:{analysis:{status:'ready',summary:description,tags:['背景'],basis:demo?'demo':'inherited'},business:{note:demo?'本地样稿':'AI生成的概念素材',subject:'',confirmed:false,usage:'reusable',allowAi:true}},
  package:{id:uid('package'),version:'1.0',prompt:description,skillIds:[],styleId:draft.styleId??run.styleId,params,files:[{name:demo?'背景.svg':'背景.png',type:'image',src}],complete:true}};
 useStudio.getState().addAsset(asset);
 patch(run.id,{backgroundDraft:{...draft,status:'ready',assetId},generatedBackgroundIds:[...new Set([...(latest.generatedBackgroundIds||[]),assetId])]});
}
function resourcesAccessible(run:Run,draft:BackgroundDraft){
 try{
  if(draft.targetWorkId&&!useStudio.getState().works.some(w=>w.id===draft.targetWorkId&&workAvailableInSpace(w,run.workspaceId)))throw new Error('当前空间的作品已不存在');
  if(draft.referenceIds?.length)referencesFor(draft.referenceIds,run.workspaceId);
  return true;
 }catch(error){
  patch(run.id,{backgroundDraft:{...draft,status:'failed',retryable:false,error:(error as Error).message}});
  return false;
 }
}
type ImageTask={id:string;status:string;url?:string;error?:string;retryable?:boolean};
export async function advanceBackground(id:string){
 if(inflight.has(id))return;
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===id),draft=run?.backgroundDraft;
 if(!run||!draft||draft.status==='ready'||draft.status==='failed'&&!draft.retryable||!canWriteAIWorkspace(run.workspaceId))return;
 inflight.add(id);
 try{
  if(!resourcesAccessible(run,draft))return;
  const polling=!!draft.taskId&&draft.status!=='failed';
  const task=await aiRequest<ImageTask>(polling?`images/${encodeURIComponent(draft.taskId!)}`:'images',polling?undefined:{prompt:draft.generationPrompt??visualGenerationPrompt(draft.prompt,state.systems.find(s=>s.id===run.styleId)),size:draft.size,workspaceId:run.workspaceId||'personal',idempotencyKey:draft.requestId});
  const latest=useStudio.getState().runs.find(r=>r.id===id);if(!sameRequestOwner(latest,run,draft.requestId))return;
  if(!resourcesAccessible(run,draft))return;
  const next:BackgroundDraft={...draft,taskId:task.id,error:undefined,status:'pending',retryable:false};
  if(task.status==='failed'){patch(id,{backgroundDraft:{...next,status:'failed',error:task.error||'图片生成失败',retryable:!!task.retryable}});return;}
  if(task.status!=='succeeded'){patch(id,{backgroundDraft:next});return;}
  if(!task.url?.startsWith('/api/ai/media/')){patch(id,{backgroundDraft:{...next,status:'failed',error:'图片地址无效'}});return;}
  finishBackground(run,next,task.url);
 }catch(error){
  if(!sameRequestOwner(useStudio.getState().runs.find(r=>r.id===id),run,draft.requestId))return;
  const retryable=!(error instanceof AIRequestError&&[400,401,403,404,409,413,422].includes(error.status));
  patch(id,{backgroundDraft:{...draft,status:'failed',retryable,error:error instanceof Error?error.message:'图片服务暂不可用'}});}finally{inflight.delete(id);}
}
export function applyBackground(id:string,assetId:string,pageId?:string){
 const state=useStudio.getState(),run=state.runs.find(r=>r.id===id),asset=state.assets.find(a=>a.id===assetId);
 if(!run||!asset||asset.kind!=='image'||!assetAvailableForInsertion(asset,run.workspaceId)||getAssetMetadata(asset).business.usage==='reference')throw new Error('这张图片当前不能用于作品，请重新选择');
 assertAIWorkspaceWrite(run.workspaceId);
 const work=state.works.find(w=>w.id===run.workId&&workAvailableInSpace(w,run.workspaceId));
 if(run.workId&&!work)throw new Error('作品已不存在或已移入回收站');
 const binding=asset.package?.params;
 if(binding?.targetWorkId&&run.generatedBackgroundIds?.includes(asset.id)&&binding.targetWorkId!==work?.id)throw new Error('这张候选背景属于之前的作品，请回到原作品采用');
 if(work){
  const target=pageId||(binding?.targetWorkId===work.id?binding.targetPageId:undefined)||work.pages[0]?.id;
  if(!target||!work.pages.some(page=>page.id===target))throw new Error('目标页面已不存在，请重新选择页面');
  const files=work.creationPackage?.files||[];
  state.saveWork({...work,pages:work.pages.map(page=>page.id===target?{...page,backgroundImage:asset.src,backgroundAssetId:asset.id}:page),creationPackage:work.creationPackage?{...work.creationPackage,files:files.some(f=>f.src===asset.src)?files:[...files,{name:asset.name,type:'image',src:asset.src}]}:undefined});
 }
 patch(id,{backgroundAssetId:asset.id,...(!work?{assetId:asset.id}:{})});
}
