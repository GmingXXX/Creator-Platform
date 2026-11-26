import {useEffect,useRef,useState} from 'react';
import type {StandaloneAssetRequest} from './editor-asset-intent';
import {appliedBackgroundReference,buildWorkBackgroundPrompt,makeWorkBackgroundSample} from '../../domain/work-background';
import {isWorkBackgroundRequest} from '../../domain/work-background-request';
import {applyEditorBackground,editorBackgroundContext,editorBackgroundHistory} from './editor-background';
import {materialRequestId} from '../creation/material-review-logic';
import {Button} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {visualGenerationPrompt} from '../../domain/visual-guidelines';
import type {Work,Asset} from '../../domain/types';
import {AssetPreview} from '../resources/Shared';
import {GeneratedComponentReview} from '../resources/GeneratedComponentReview';
import {generateReviewImage} from '../creation/generation-materials';
import {generateReviewVideo} from '../creation/generation-review-video';
import {insertMaterial} from './editor-materials';
import {editorAssetSample,insertStoryAsset} from './editor-asset-actions';

export function EditorAssetStudio({work,pageId,nodeId,onBeforeApply,onApplied,request}:{request?:StandaloneAssetRequest;work:Work;pageId?:string;nodeId?:string;onBeforeApply?:()=>void;onApplied?:(next:Work)=>void}){
 const workspaceId=work.workspaceId||'personal',choices=work.kind==='story'?(work.storyNodes||[]).map(n=>({id:n.id,name:n.title})):work.pages;
 const [target,setTarget]=useState(''),[kind,setKind]=useState<'image'|'video'|'component'>('image'),[prompt,setPrompt]=useState(''),[mode,setMode]=useState<'sample'|'provider'>(work.aiModel==='demo'?'sample':'provider');
 const [busy,setBusy]=useState(false),[component,setComponent]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Asset>();
 const style=useStudio(s=>s.systems.find(v=>v.id===work.styleId)),editable=useStudio(s=>workspaceCanEdit(s,workspaceId));
 const consumed=useRef(''),submitted=useRef('');
 useEffect(()=>{if(!request||consumed.current===request.id)return;consumed.current=request.id;setKind(request.kind);setPrompt(request.prompt);setMode(request.model==='demo'?'sample':'provider');},[request]);
 useEffect(()=>{if(!request||busy||submitted.current===request.id||kind!==request.kind||prompt!==request.prompt||mode!==(request.model==='demo'?'sample':'provider'))return;submitted.current=request.id;void generate(request.targetId);},[request,busy,kind,prompt,mode]);
 const destination=target||(work.kind==='story'?nodeId:pageId)||'';
 const generate=async(requestTarget?:string)=>{
  if(!editable||!prompt.trim()||busy)return;
  setError('');setBusy(true);setResult(undefined);
  try{
   const targetId=requestTarget||(work.kind==='story'?nodeId:pageId);
   const availableAssets=useStudio.getState().assets;
   const history=editorBackgroundHistory(work,targetId,availableAssets);
   const background=kind==='image'&&isWorkBackgroundRequest(prompt,history.length>0)?editorBackgroundContext(work,targetId):undefined;
   if(background){
    const reference=appliedBackgroundReference(background.page,availableAssets,workspaceId);
    const description=visualGenerationPrompt(buildWorkBackgroundPrompt(background.work,background.targetId,prompt.trim(),style,history,reference),style);
    const size=work.width+'*'+work.height;
    const key=materialRequestId(JSON.stringify([work.id,background.targetId,size,description]),0);
    const base=mode==='sample'?editorAssetSample(work,'image',prompt):await generateReviewImage({workspaceId,styleId:work.styleId,requestKey:'editor-background-'+key,prompt:description,size});
    const src=mode==='sample'?makeWorkBackgroundSample(background.work,background.targetId,style,[...history,prompt].join('。')):base.src;
    const asset:Asset={...base,name:background.name+' · 背景'+(mode==='sample'?'样稿':''),src,preview:src,
     description,package:{...base.package,id:base.package?.id||'package-'+base.id,version:base.package?.version||'1.0',
      prompt:description,styleId:work.styleId,skillIds:base.package?.skillIds||[],complete:true,
      files:base.package?.files||[{name:'背景样稿.svg',type:'image',src}],params:{...base.package?.params,targetWorkId:work.id,targetPageId:background.targetId,backgroundTargetName:background.name,userPrompt:prompt.trim(),size}}};
    useStudio.getState().addAsset(asset);setResult(asset);return;
   }
   if(mode==='sample'){const sample=editorAssetSample(work,kind,prompt);useStudio.getState().addAsset(sample);setResult(sample);return;}
   if(kind==='component'){setComponent(true);return;}
   const args={workspaceId,styleId:work.styleId,requestKey:`editor-${work.id}-${kind}`,prompt:visualGenerationPrompt(prompt.trim(),style)};
   setResult(await (kind==='image'?generateReviewImage(args):generateReviewVideo(args)));
  }catch(e){setError(e instanceof Error?e.message:'生成失败，请重试。')}finally{setBusy(false)}
 };
 const backgroundTarget=result?.package?.params.targetWorkId===work.id?result.package.params.targetPageId:undefined;
 const insert=()=>{
  if(!result||!editable||!onApplied||!(backgroundTarget||destination))return;
  try{
   onBeforeApply?.();
   const store=useStudio.getState(),base=store.works.find(w=>w.id===work.id&&!w.deletedAt);
   const savedAsset=store.assets.find(a=>a.id===result.id&&!a.deletedAt&&!a.archived);
   if(!base||!workspaceCanEdit(store,workspaceId)||!savedAsset)throw new Error('作品或素材已不可用。');
   const next=backgroundTarget?applyEditorBackground(base,backgroundTarget,savedAsset):base.kind==='story'?insertStoryAsset(base,destination,savedAsset):insertMaterial(base,destination,savedAsset);
   if(next===base)throw new Error(backgroundTarget?'原页面或节点已不可用。素材已保存在素材库。':'无法插入所选位置，请重新选择。');
   store.saveWork(next);const stored=useStudio.getState().works.find(w=>w.id===base.id);if(stored)onApplied(stored);
   setResult(undefined);
  }catch(e){setError(e instanceof Error?e.message:'插入失败')}
 };
 return <div className="editor-asset-form"><label>素材类型<select aria-label="素材类型" disabled={busy} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="image">图片</option><option value="video">视频</option><option value="component">互动组件</option></select></label>
 <label>素材需求<textarea maxLength={1200} value={prompt} disabled={busy} onChange={e=>setPrompt(e.target.value)} rows={3}/></label>
 <label>生成方式<select aria-label="生成方式" value={mode} disabled={busy} onChange={e=>setMode(e.target.value as typeof mode)}><option value="provider">调用模型生成</option><option value="sample">本地演示样稿</option></select></label>
 <Button disabled={!editable||busy||!prompt.trim()} onClick={()=>void generate()}>{busy?'正在生成…':'生成素材'}</Button>
 {error&&<p role="alert">{error}</p>}
 {result&&<><AssetPreview asset={result}/><strong>{result.name}</strong><small>已保存至当前空间的素材库</small>{onApplied&&backgroundTarget?<Button disabled={!editable} onClick={insert}>采用为「{result.package?.params.backgroundTargetName}」的背景</Button>:onApplied&&choices.length>0&&<><label>插入位置<select aria-label="插入位置" value={destination} onChange={e=>setTarget(e.target.value)}><option value="">选择页面或节点</option>{choices.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><Button disabled={!destination||!editable} onClick={insert}>插入所选位置</Button></>}</>}
 {component&&<GeneratedComponentReview input={{prompt,model:request?.model.startsWith('deepseek-')?request.model:work.aiModel?.startsWith('deepseek-')?work.aiModel:'deepseek-flash',style}} workspaceId={workspaceId} onClose={()=>setComponent(false)} onCreated={asset=>{setComponent(false);setResult(asset)}}/>}
 </div>;
}
