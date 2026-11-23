import {taskWorkspaceContext} from './workspace-context';
import {referenceContext,validateReferences} from './exhibit-references';
import {assertAIWorkspaceWrite,canWriteAIWorkspace} from './workspace-ai-access';
import {appendSkillContext} from './skill-context';
import {selectTaskSkills} from './skill-matching';
import {useStudio} from './store';
import {aiChat,aiRequest} from './ai-client';
import {buildAIWork,parseAIPlan,planSystemPrompt} from './ai-plan';
import {assetAvailableForAI} from './asset-access';
import {getAssetMetadata} from './asset-metadata';
import {getBackgroundCandidates,nativeComponentForPrompt} from './generation-resource';
import {skillIsValid} from './skill-publication';
import {assetDependencyError} from './resource-permissions';
import {skillAvailableInSpace} from './resource-sharing';
import {assetAvailableForInsertion} from './asset-access';
import {readAssetSources} from './document-intake';
import {creationMessages} from '../features/studios/creationLogic';
import {uid,now} from './scenes';
import type {Asset,Run,Work} from './types';
const pending=new Map<string,AbortController>();
export const isRealModel=(model:string)=>model.startsWith('deepseek-');
function checkResources(run:Run){
 const state=useStudio.getState(),space=run.workspaceId||'personal';
 assertAIWorkspaceWrite(space);
 validateReferences(run.references||[],state,space);
 for(const id of [...run.attachmentIds,...(run.backgroundAssetId?[run.backgroundAssetId]:[])]){
 const a=state.assets.find(a=>a.id===id);
 if(!a||!assetAvailableForAI(a,space))throw new Error('参考素材已不可用或已关闭 AI 调用，请重新选择。');
 const error=assetDependencyError(state.assets,a,space,'ai');if(error)throw new Error(error);
 if(id===run.backgroundAssetId&&getAssetMetadata(a).business.usage==='reference')throw new Error('参考素材不能直接作为成品背景，请重新选择。');
 }
 if(run.skillIds.some(id=>{const skill=state.skills.find(s=>s.id===id);return !skill||!skillAvailableInSpace(skill,space,{...state,activeWorkspaceId:space})||!skillIsValid(skill)}))throw new Error('部分技能已不可用，请重新选择。');
}
interface ImageTask {id:string;status:string;url?:string;error?:string}
export async function advanceAIRun(id:string){
 if(pending.has(id))return;
 const controller=new AbortController();pending.set(id,controller);
 try{
 let state=useStudio.getState(),run=state.runs.find(r=>r.id===id);
 if(!run||run.status!=='running'||!canWriteAIWorkspace(run.workspaceId))return;
 if(!run.skillSelections){
 const matched=selectTaskSkills({accessState:{...state,activeWorkspaceId:run.workspaceId||'personal'},skills:state.skills,prompt:run.prompt,outputKind:run.outputKind,workspaceId:run.workspaceId||'personal',explicitSkillIds:run.explicitSkillIds??run.skillIds});
 state.updateRun(id,{skillIds:matched.skillIds,skillSelections:matched.selections,explicitSkillIds:run.explicitSkillIds??run.skillIds});
 run={...run,skillIds:matched.skillIds};
 }
 checkResources(run);
 if(['presentation','video','story','html'].includes(run.outputKind)||(run.outputKind==='component'&&(!nativeComponentForPrompt(run.prompt)||/悬浮|翻转|卡片组/.test(run.prompt)))){state.updateRun(id,{studioReview:true,status:'waiting',step:1});return;}
 if(!run.aiPlan){
  const candidates=getBackgroundCandidates(run,state.assets);
  const attachments=state.assets.filter(a=>run!.attachmentIds.includes(a.id)&&assetAvailableForAI(a,run!.workspaceId));
  const sources=attachments.length?await readAssetSources(attachments):[];
  const context={workspace:taskWorkspaceContext(state,run.workspaceId||'personal'),request:run.prompt,references:referenceContext(validateReferences(run.references||[],state,run.workspaceId||'personal')),style:state.systems.find(s=>s.id===run!.styleId),resources:candidates.map(c=>({name:c.asset.name,summary:getAssetMetadata(c.asset).analysis.summary})),attachments:attachments.map(a=>({id:a.id,kind:a.kind,name:a.name,path:a.intake?.relativePath,description:a.description,metadata:getAssetMetadata(a),parseStatus:sources.find(f=>f.asset.id===a.id)?.status})),reference:run.reference?{prompt:run.reference.prompt,params:run.reference.params}:undefined};
  state.updateRun(id,{step:0});
  const serialized=JSON.stringify(context);
  if(serialized.length>12000)throw new Error('本次参考资料过多，请减少附件或技能后再试。');
  const selectedSkills=state.skills.filter(s=>run!.skillIds.includes(s.id)).map(s=>({name:s.name,input:s.input,steps:s.steps,instructions:s.sourcePackage?.instructions}));
  assertAIWorkspaceWrite(run.workspaceId);
  const response=await aiChat(run.model,appendSkillContext(creationMessages(planSystemPrompt,context,sources.filter(f=>f.text).map(f=>`文件：${f.asset.intake?.relativePath||f.asset.name}\n${f.text}`).join('\n\n')),selectedSkills),controller.signal);
  assertAIWorkspaceWrite(run.workspaceId);
  const plan=parseAIPlan(response.content);
  if(controller.signal.aborted||useStudio.getState().runs.find(r=>r.id===id)?.status!=='running')return;
  state.updateRun(id,{aiPlan:plan,step:1,status:plan.mode==='discuss'?'waiting':'running'});
 }
 state=useStudio.getState();run=state.runs.find(r=>r.id===id)!;
 if(run.status!=='running'||!run.aiPlan||run.aiPlan.mode==='discuss')return;
 checkResources(run);
 if(run.outputKind==='exhibit'&&!run.structureConfirmed){state.updateRun(id,{status:'waiting',step:1});return;}
 if(run.outputKind==='html'||(run.outputKind==='component'&&(!nativeComponentForPrompt(run.prompt)||/悬浮|翻转|卡片组/.test(run.prompt))))throw new Error('真实模式当前支持原生展项编排与图片生成；全新组件需开发适配。可描述为时间轴、卡片或页面，或选择明确标注的演示模式。');
 if(run.outputKind==='exhibit'&&!run.resourceStrategy&&!run.backgroundAssetId){state.updateRun(id,{status:'waiting',step:2});return;}
 let asset:Asset|undefined;
 if(run.outputKind==='image'||run.resourceStrategy==='generate'){
  let task:ImageTask;
  if(run.aiImageTaskId)task=await aiRequest<ImageTask>(`images/${encodeURIComponent(run.aiImageTaskId)}`,undefined,controller.signal);
  else{task=await aiRequest<ImageTask>('images',{prompt:run.aiPlan.imagePrompt||run.prompt,size:'1696*960',workspaceId:run.workspaceId||'personal',idempotencyKey:run.id},controller.signal);assertAIWorkspaceWrite(run.workspaceId);state.updateRun(id,{aiImageTaskId:task.id,step:3});}
  if(controller.signal.aborted)return;
  assertAIWorkspaceWrite(run.workspaceId);
  if(task.status==='failed')throw new Error(task.error||'图片生成失败，请重试。');
  if(task.status!=='succeeded')return;
  if(!task.url?.startsWith('/api/ai/media/'))throw new Error('生成图片地址无效。');
  asset={id:`asset-${run.id}`,workspaceId:run.workspaceId||'personal',name:`${run.aiPlan.title||'生成图片'}${run.outputKind==='image'?'':' · 背景'}`,kind:'image',src:task.url,preview:task.url,description:'万相真实生成的概念素材，使用前请核对内容。',tags:['AI生成','概念素材'],author:'纪鸣',createdAt:now(),source:'generated',metadata:{analysis:{status:'ready',summary:run.aiPlan.imagePrompt||run.prompt,tags:['AI生成'],basis:'inherited'},business:{note:'真实生图，非客户事实证明',subject:'',confirmed:false,usage:'reusable',allowAi:true}},package:{references:structuredClone(run.references||[]),id:uid('package'),version:'1.0',prompt:run.aiPlan.imagePrompt||run.prompt,files:[{name:'生成图片.png',type:'image',src:task.url}],skillIds:run.skillIds,params:{model:'万相',taskId:task.id},styleId:run.styleId,complete:true}};
 }
 if(run.outputKind==='component'){
  const componentType=nativeComponentForPrompt(run.prompt)!;
  asset={id:`asset-${run.id}`,workspaceId:run.workspaceId||'personal',name:run.aiPlan.title||'生成组件',kind:'component',componentType,src:'/media/industrial.svg',preview:'/media/industrial.svg',description:run.aiPlan.answer+'（基于已适配的原生组件；未生成新组件代码）',tags:['原生组件','AI配置'],author:'纪鸣',createdAt:now(),source:'generated',package:{references:structuredClone(run.references||[]),id:uid('package'),version:'1.0',prompt:run.prompt,skillIds:run.skillIds,params:{model:run.model},complete:true,files:[{name:'component.schema.json',type:'component',content:JSON.stringify({type:componentType,content:run.aiPlan.sections?.[0]?.body,items:run.aiPlan.sections?.map(s=>({id:uid('item'),title:s.title,description:s.body,year:s.year}))})}]}};
 }
 let work:Work|undefined=['image','component'].includes(run.outputKind)?undefined:buildAIWork(run.aiPlan,run,state.assets.filter(a=>run!.attachmentIds.includes(a.id)&&assetAvailableForInsertion(a,run!.workspaceId)));
 const background=asset?.kind==='image'?asset:state.assets.find(a=>a.id===run!.backgroundAssetId&&assetAvailableForInsertion(a,run!.workspaceId||'personal'));
 if(run.backgroundAssetId&&!background)throw new Error('所选背景已不可用，请重新选择。');
 if(work&&background)work={...work,pages:work.pages.map((p,i)=>i===0?{...p,backgroundImage:background.src,backgroundAssetId:background.id}:p)};
 if(work?.creationPackage){work={...work,creationPackage:{...work.creationPackage,files:[...state.assets.filter(a=>run!.attachmentIds.includes(a.id)).map(a=>({name:a.name,type:a.kind,src:a.src})),...(background?[{name:background.name,type:'image',src:background.src}]:[])]}};}
 if(controller.signal.aborted||useStudio.getState().runs.find(r=>r.id===id)?.status!=='running')return;
 checkResources(run);
 if(asset?.package&&work)asset={...asset,package:{...asset.package,params:{...asset.package.params,experienceWorkId:work.id},references:structuredClone(work.references||[])}};
 if(asset)state.addAsset(asset);
 if(work)state.saveWork({...work,productionStage:run.productionStage});
 state.updateRun(id,{status:'complete',step:5,workId:work?.id,assetId:asset?.id,error:undefined});
 }catch(error){if(controller.signal.aborted)return;const state=useStudio.getState();const failedRun=state.runs.find(r=>r.id===id);if(failedRun?.status==='running'&&canWriteAIWorkspace(failedRun.workspaceId))state.updateRun(id,{status:'failed',error:error instanceof Error?error.message:'AI 创作未完成，请重试。'});}finally{pending.delete(id);}
}
export function stopInactiveAI(){for(const [id,controller]of pending){const run=useStudio.getState().runs.find(r=>r.id===id);if(run?.status!=='running'||!canWriteAIWorkspace(run.workspaceId))controller.abort();}}
