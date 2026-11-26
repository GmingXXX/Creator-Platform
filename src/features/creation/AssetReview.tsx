import {useEffect,useRef,useState} from 'react';
import {ImagePlus,LoaderCircle,Upload} from 'lucide-react';
import type {Asset} from '../../domain/types';
import {assetAvailableForAI} from '../../domain/asset-access';
import {useStudio} from '../../domain/store';
import {importWorkspaceFile} from '../../domain/workspace-upload';
import {Button,Modal} from '../../components/ui';
import {MaterialPicker} from '../resources/MaterialPicker';
import {AssetPreview} from '../resources/Shared';
import {readImageDraft} from '../editor/editor-image-generation';
import {generateReviewVideo,readReviewVideo} from './generation-review-video';
import {generateReviewImage} from './generation-materials';
import {generationAssetLabel} from './material-review-logic';
import {visualGenerationPrompt} from '../../domain/visual-guidelines';
import '../../styles/agent-creation.css';
export interface AssetReviewProps {onPromptChange?:(value:string)=>void;value?:Asset;onChange:(asset:Asset)=>void;workspaceId:string;styleId?:string;prompt:string;requestKey:string;kinds?:('image'|'video'|'html')[];onBusy?:(busy:boolean)=>void}
export function AssetReview({value,onChange,workspaceId,styleId,prompt,requestKey,kinds=['image'],onBusy,onPromptChange}:AssetReviewProps){
 const assets=useStudio(state=>state.assets),style=useStudio(state=>state.systems.find(item=>item.id===styleId));
 const [generationKind,setGenerationKind]=useState<'image'|'video'>('image');
 const [picker,setPicker]=useState(false),[preview,setPreview]=useState<Asset>(),[generating,setGenerating]=useState(false),[description,setDescription]=useState(prompt),[busy,setBusy]=useState(false),[error,setError]=useState(''),[candidate,setCandidate]=useState<Asset>();
 const input=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();}},[]);
 const taskDraft=readImageDraft(`zc-review-material:${workspaceId}:${requestKey}`),pendingDraft=taskDraft?.status==='pending'||taskDraft?.retryable;
 const pendingVideo=readReviewVideo(workspaceId,requestKey)?.status==='pending';
 const versions=assets.filter(asset=>asset.workspaceId===workspaceId&&assetAvailableForAI(asset,workspaceId)&&asset.package?.params.reviewSlot===requestKey);
 const status=(active:boolean)=>{setBusy(active);onBusy?.(active);};
 const generate=async(newVersion:boolean)=>{
  status(true);setError('');const abort=new AbortController();controller.current=abort;
  try{
   let asset:Asset;if(generationKind==='video'){asset=await generateReviewVideo({prompt:visualGenerationPrompt(description,style),workspaceId,styleId,requestKey,newVersion,referenceImage:value?.kind==='image'&&assetAvailableForAI(value,workspaceId)?value.src:undefined,signal:abort.signal});}
   else asset=await generateReviewImage({prompt:visualGenerationPrompt(description,style),workspaceId,styleId,requestKey,newVersion,signal:abort.signal});if(alive.current)setCandidate(asset);}
  catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:'素材生成失败');}finally{if(alive.current)status(false);}
 };
 const upload=async(file?:File)=>{if(!file)return;status(true);setError('');try{
  const result=await importWorkspaceFile(file,workspaceId);if(!kinds.includes(result.kind as 'image'|'video'|'html'))throw new Error('请上传对应类型的图片、视频或 HTML 文件');
  const asset={...result,workspaceId};useStudio.getState().addAsset(asset);onChange(asset);
 }catch(reason){setError(reason instanceof Error?reason.message:'上传失败');}finally{status(false);if(input.current)input.current.value='';}};
 return <div className="asset-review">
  {value?<><button className="asset-review-cover" aria-label={`放大预览${value.name}`} onClick={()=>setPreview(value)}><AssetPreview asset={value}/><span>放大预览</span></button><small className="asset-review-source">{generationAssetLabel(value)} · {value.name}</small></>:<div className="asset-review-empty"><ImagePlus size={20}/><span>尚未配置素材</span></div>}
  <div className="asset-review-controls"><Button size="sm" disabled={busy} onClick={()=>setPicker(true)}>{value?'替换素材':'选择素材'}</Button><Button size="sm" disabled={busy} onClick={()=>{const videoDraft=readReviewVideo(workspaceId,requestKey);const savedPrompt=videoDraft?.status==='pending'?videoDraft.prompt:pendingDraft?taskDraft?.prompt:undefined;if(videoDraft?.status==='pending')setGenerationKind('video');else if(pendingDraft)setGenerationKind('image');setDescription(savedPrompt?.split('\n\n华院展项制作约定：')[0]||prompt||(value&&assetAvailableForAI(value,workspaceId)?value.package?.prompt?.split('\n\n华院展项制作约定：')[0]||'':''));setCandidate(undefined);setGenerating(true);}}>AI 生成</Button><Button size="sm" disabled={busy} aria-label="上传替换素材" onClick={()=>input.current?.click()}><Upload size={13}/></Button></div>
  <input hidden ref={input} type="file" accept={kinds.includes('video')?'image/*,video/*,.html,.htm':'image/*'} onChange={event=>void upload(event.target.files?.[0])}/>
  {error&&!generating&&<p className="form-error" role="alert">{error}</p>}
  <MaterialPicker open={picker} onClose={()=>setPicker(false)} workspaceId={workspaceId} kinds={kinds} title="选择与替换素材" onSelect={asset=>{onChange(asset);setPicker(false);}}/>
  <Modal open={Boolean(preview)} onClose={()=>setPreview(undefined)} title={preview?.name||'素材预览'} wide footer={<Button onClick={()=>{setPreview(undefined);setPicker(true);}}>替换素材</Button>}><div className="asset-review-lightbox">{preview&&<AssetPreview asset={preview} large/>}</div></Modal>
  <Modal open={generating} onClose={()=>setGenerating(false)} title="生成与调整素材" wide footer={<Button variant="primary" disabled={!candidate||busy} onClick={()=>{if(candidate)onChange(candidate);setGenerating(false);}}>采用此素材</Button>}><div className="asset-review-generation">{kinds.includes('video')&&<label>生成素材类型<select aria-label="生成素材类型" value={generationKind} disabled={busy||pendingVideo||pendingDraft} onChange={event=>setGenerationKind(event.target.value as 'image'|'video')}><option value="image">图片</option><option value="video">视频片段 · 5 秒</option></select></label>}<label>画面描述<textarea aria-label="素材生成提示词" rows={4} maxLength={generationKind==='video'?Math.max(0,1501-visualGenerationPrompt('x',style).length):1500} value={description} disabled={busy||(generationKind==='image'?pendingDraft:pendingVideo)} onChange={event=>{setDescription(event.target.value);onPromptChange?.(event.target.value)}}/></label><small>{generationKind==='image'&&pendingDraft?'已有素材正在生成，将继续查询原任务；完成后可以修改描述再生成新版本。':''}生成时应用所选设计风格与基础排版规范；素材与提示词会保存在素材库。</small><div className="asset-review-controls"><Button disabled={busy||!description.trim()} onClick={()=>void generate(generationKind==='video'?Boolean(candidate):!pendingDraft&&versions.length>0)}>{busy?<><LoaderCircle size={14} className="spinner"/>正在生成…</>:(generationKind==='image'?pendingDraft:pendingVideo)?'继续查询原任务':candidate?'生成新版本':generationKind==='video'?'生成视频':'生成图片'}</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}{candidate&&<figure><AssetPreview asset={candidate} large/></figure>}{versions.length>0&&<div className="asset-review-version-list">{versions.map((asset,index)=><Button key={asset.id} size="sm" aria-pressed={candidate?.id===asset.id} onClick={()=>{setCandidate(asset);setDescription(asset.package?.prompt?.split('\n\n华院展项制作约定：')[0]||prompt);}}>版本 {index+1}</Button>)}</div>}</div></Modal>
 </div>;
}
