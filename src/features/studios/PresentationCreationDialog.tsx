import type {RunActivity} from '../creation/RunProgress';
import {assertAIWorkspaceWrite,canWriteAIWorkspace} from '../../domain/workspace-ai-access';
import {checkpointSources,restoreCheckpointSources} from './creation-source-checkpoint';
import {assetAvailableForAI} from '../../domain/asset-access';
import {createSceneWork} from '../../domain/scenes';
import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowDown,ArrowRight,ArrowUp,Plus,X} from 'lucide-react';
import {Button,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {applyCreationReferences} from '../../domain/reference-application';
import {validateReferences,type ExhibitReference} from '../../domain/exhibit-references';
import {selectTaskSkills,type SkillSelection} from '../../domain/skill-matching';
import type {Asset,Work} from '../../domain/types';
import {CreationModel,CreationSize,CreationSources,type SourceFile} from './CreationFields';
import {resolveCreationSize,sourcePackage} from './creationLogic';
import {makePresentationPages,reorder} from './studioLogic';
import {Field,Stepbar} from './StudioShared';
import {MaterialPicker} from '../resources/MaterialPicker';
import {buildPresentationWork,generatePresentationPlan,type PresentationSection} from '../../domain/presentation-generation';
import {CreationSurface} from './CreationSurface';
import {PresentationStylePicker} from './PresentationStylePicker';
import {AssetReview} from '../creation/AssetReview';
import {generateReviewImage} from '../creation/generation-materials';
import {visualGenerationPrompt} from '../../domain/visual-guidelines';
import {preparePresentationAudio} from './presentation-audio-preparation';
import {presentationDraftSignature,findPresentationDraft,type PresentationDraftCheckpoint} from './presentation-draft-recovery';
import '../../styles/studios.css';
import '../../styles/studio-creation.css';

type Props={inline?:boolean;requestKey?:string;onBack?:()=>void;open:boolean;onClose:()=>void;initialKind?:'presentation'|'video';initialTopic?:string;initialModel?:string;initialStyleId?:string;initialSkillIds?:string[];initialReferences?:ExhibitReference[];initialFiles?:SourceFile[];initialAutoGenerate?:boolean;initialWorkspaceId?:string;keepDraftOnClose?:boolean;onCreated?:(work:Work)=>void;onActivity?:(activity?:RunActivity)=>void};
export function PresentationCreationDialog({inline=false,requestKey='manual-presentation',onBack,open,onClose,initialKind='presentation',initialTopic='',initialModel='deepseek-flash',initialStyleId='',initialSkillIds=[],initialReferences=[],initialFiles=[],initialAutoGenerate=false,initialWorkspaceId,keepDraftOnClose=false,onCreated,onActivity}:Props){
 const sessionRequestKey=useRef(inline?requestKey:crypto.randomUUID()).current;
 const draftCheckpoint=useRef<PresentationDraftCheckpoint|undefined>(undefined);
 const state=useStudio(),navigate=useNavigate(),controller=useRef<AbortController|null>(null);
 const initialized=useRef(false),referenceSnapshot=useRef<ExhibitReference[]>(structuredClone(initialReferences));
 const [generateMissing,setGenerateMissing]=useState(inline),[progress,setProgress]=useState(''),[preparingSpeech,setPreparingSpeech]=useState(false);
 const [workspaceId,setWorkspaceId]=useState(()=>initialWorkspaceId||useStudio.getState().activeWorkspaceId);
 const [kind,setKind]=useState(initialKind),[step,setStep]=useState(0),[topic,setTopic]=useState(''),[styleId,setStyleId]=useState(''),[audience,setAudience]=useState('展厅参观者');
 const [resolution,setResolution]=useState('1920×1080'),[width,setWidth]=useState(1920),[height,setHeight]=useState(1080),[quantity,setQuantity]=useState(8),[duration,setDuration]=useState(60);
 const [sections,setSections]=useState<(PresentationSection&{reviewId?:string;imagePrompt?:string})[]>([]),[files,setFiles]=useState<SourceFile[]>([]),[model,setModel]=useState(initialModel),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[planTitle,setPlanTitle]=useState('');
 const [autoStart,setAutoStart]=useState(false),[usedSkills,setUsedSkills]=useState<SkillSelection[]>([]);
 const [skillIds,setSkillIds]=useState<string[]>(initialSkillIds),[images,setImages]=useState<Asset[]>([]),[imagePage,setImagePage]=useState<number|null>(null);
 useEffect(()=>{if(open&&(!keepDraftOnClose||!initialized.current)){initialized.current=true;draftCheckpoint.current=undefined;referenceSnapshot.current=structuredClone(initialReferences);setWorkspaceId(initialWorkspaceId||useStudio.getState().activeWorkspaceId);setKind(initialKind);setTopic(initialTopic);setModel(initialModel);setStyleId(initialStyleId);setSkillIds(initialSkillIds);setUsedSkills([]);setStep(0);setFiles(initialFiles);setSections([]);setImages(initialFiles.filter(f=>f.asset.kind==='image').map(f=>f.asset));setError('');setBusy(false);let restored=false;
   if(inline){try{const saved=JSON.parse(localStorage.getItem(`zc-creation-plan:${initialWorkspaceId||workspaceId}:${requestKey}`)||'null');if(saved?.kind==='presentation'&&Array.isArray(saved.sections)&&saved.sections.length>0&&saved.sections.length<=30&&saved.sections.every((section:PresentationSection)=>typeof section.title==='string'&&typeof section.narration==='string'&&Array.isArray(section.bullets)&&section.bullets.every((text:unknown)=>typeof text==='string'))){
    if(typeof saved.draftWorkId==='string'&&typeof saved.draftSignature==='string')draftCheckpoint.current={draftWorkId:saved.draftWorkId,draftSignature:saved.draftSignature};
    if(typeof saved.audience==='string')setAudience(saved.audience);
    const plan:{title:string;sections:PresentationSection[] }={title:typeof saved.title==='string'?saved.title:initialTopic,sections:saved.sections};
    const pool=useStudio.getState().assets.filter(asset=>assetAvailableForAI(asset,initialWorkspaceId||workspaceId));
    const restoredFiles=Array.isArray(saved.sources)?restoreCheckpointSources(saved.sources,pool,initialWorkspaceId||workspaceId):initialFiles;setFiles(restoredFiles);
    setSections(plan.sections.map((section,index)=>({...section,reviewId:typeof saved.sections[index].reviewId==='string'?saved.sections[index].reviewId:crypto.randomUUID(),imagePrompt:typeof saved.sections[index].imagePrompt==='string'?saved.sections[index].imagePrompt:undefined,imageAssetId:pool.some(asset=>asset.id===section.imageAssetId)?section.imageAssetId:undefined})));
    setImages(pool.filter(asset=>plan.sections.some(section=>section.imageAssetId===asset.id)||restoredFiles.some(file=>file.asset.kind==='image'&&file.asset.id===asset.id)));setPlanTitle(plan.title);setTopic(typeof saved.topic==='string'?saved.topic:initialTopic);setStep(saved.step===0?0:1);setUsedSkills(Array.isArray(saved.usedSkills)?saved.usedSkills:[]);setGenerateMissing(saved.generateMissing!==false);if(typeof saved.styleId==='string')setStyleId(saved.styleId);if(typeof saved.model==='string')setModel(saved.model);if(typeof saved.resolution==='string')setResolution(saved.resolution);if(Number.isInteger(saved.width))setWidth(saved.width);if(Number.isInteger(saved.height))setHeight(saved.height);restored=true;
   }}catch{setError('已保存方案无法读取，将重新整理。');}}
   setAutoStart(initialAutoGenerate&&!restored);}},[open,keepDraftOnClose]);
 const planCheckpoint=(currentSections=sections)=>({kind:'presentation',step,sources:checkpointSources(files),title:planTitle,topic,sections:currentSections,usedSkills,generateMissing,styleId,model,resolution,width,height,audience});
 const planSignature=(currentSections=sections)=>presentationDraftSignature({title:planTitle,topic,sections:currentSections,sources:checkpointSources(files),styleId,model,resolution,width,height,audience,usedSkills});
 useEffect(()=>{if(inline&&sections.length&&canWriteAIWorkspace(workspaceId)){try{
  if(draftCheckpoint.current?.draftSignature!==planSignature())draftCheckpoint.current=undefined;
  localStorage.setItem(`zc-creation-plan:${workspaceId}:${requestKey}`,JSON.stringify({...planCheckpoint(),...draftCheckpoint.current}));
 }catch{setError('浏览器无法保存方案，请保持本页打开。');}}},[inline,step,files,sections,planTitle,topic,usedSkills,generateMissing,workspaceId,requestKey,styleId,model,resolution,width,height,audience]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const close=()=>{if(uploading)return;if(!keepDraftOnClose)controller.current?.abort();onClose();};
 const generate=async()=>{
  if(!topic.trim())return setError('请填写你想讲述的主题');
  try{resolveCreationSize(resolution,width,height);}catch(e){setError((e as Error).message);return;}
  const request=new AbortController();controller.current=request;setBusy(true);setError('');
  try{
   assertAIWorkspaceWrite(workspaceId);
   const references=validateReferences(referenceSnapshot.current,useStudio.getState(),workspaceId);
   const matched=selectTaskSkills({accessState:{...useStudio.getState(),activeWorkspaceId:workspaceId},skills:useStudio.getState().skills,prompt:[topic,...files.map(file=>file.text)].join('\n'),outputKind:kind,workspaceId,explicitSkillIds:skillIds});
   const selected=useStudio.getState().skills.filter(skill=>matched.skillIds.includes(skill.id));
   let outline:PresentationSection[],title=topic.trim().slice(0,80);
   if(model==='demo')outline=makePresentationPages(topic,styleId).slice(0,quantity).map(p=>({title:p.name,narration:p.notes||'',bullets:['离线示例内容，请替换为上传资料中的事实。'],layout:'bullets'}));
   else{
    const plan=await generatePresentationPlan({topic,audience,kind,quantity,duration,style:state.systems.find(s=>s.id===styleId),images,files,model,workspaceId,references,skills:selected.map(skill=>({name:skill.name,input:skill.input,steps:skill.steps,instructions:skill.sourcePackage?.instructions}))},request.signal);
    outline=plan.sections;title=plan.title;
   }
   assertAIWorkspaceWrite(workspaceId);
   if(!request.signal.aborted){setSections(outline.map(section=>({...section,reviewId:crypto.randomUUID()})));setPlanTitle(title);setUsedSkills(matched.selections);setStep(1);}
  }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'生成未完成，请重试');}finally{if(controller.current===request)setBusy(false);}
 };
 useEffect(()=>{if(autoStart&&open){setAutoStart(false);void generate();}},[autoStart,open]);
 const create=async()=>{
  if(busy||uploading)return;setBusy(true);setError('');const request=new AbortController();controller.current=request;
  try{
   assertAIWorkspaceWrite(workspaceId);
   const references=validateReferences(referenceSnapshot.current,useStudio.getState(),workspaceId);
   let prepared=sections;let preparedImages=images;
   if(!prepared.length||prepared.some(section=>!section.title.trim()||!section.narration.trim()||!section.bullets.some(text=>text.trim())))throw new Error('请为每个页面填写标题、正文要点和讲稿');
   resolveCreationSize(resolution,width,height);
   if(generateMissing&&model!=='demo'&&prepared.some(section=>!section.imageAssetId)){
    for(let index=0;index<prepared.length;index++){const section=prepared[index];if(section.imageAssetId)continue;
     validateReferences(references,useStudio.getState(),workspaceId);
     setProgress(`正在生成第 ${index+1} / ${prepared.length} 页配图，已完成的素材会保留`);
     const asset=await generateReviewImage({prompt:visualGenerationPrompt(section.imagePrompt||`${planTitle}：${section.title}。${section.bullets.join('；')}。创作配图，不在图片内书写标题与正文。`,state.systems.find(style=>style.id===styleId)),workspaceId,styleId,requestKey:`${sessionRequestKey}:${section.reviewId||section.title}`,signal:request.signal}).catch(error=>{if(request.signal.aborted)throw new Error('配图生成已暂停，已完成的素材和方案已保留');throw new Error(`第 ${index+1} 页配图生成未完成：${error instanceof Error?error.message:'服务暂不可用'}。已完成的素材已保留，可稍后重试，或取消自动配图后继续生成作品。`);});
     preparedImages=[...preparedImages.filter(item=>item.id!==asset.id),asset];prepared=prepared.map((item,i)=>i===index?{...item,imageAssetId:asset.id,layout:'split'}:item);setImages(preparedImages);setSections(prepared);
    }
   }
   if(!prepared.length||prepared.some(s=>!s.title.trim()||!s.narration.trim()||!s.bullets.some(b=>b.trim())))throw new Error('请为每个页面填写标题、正文要点和讲稿');
   const size=resolveCreationSize(resolution,width,height);
   const originals=[...new Map([...files.map(f=>f.asset),...preparedImages].map(a=>[a.id,a])).values()];
   if(prepared.some(section=>section.imageAssetId&&!originals.some(asset=>asset.id===section.imageAssetId&&asset.kind==='image')))throw new Error('部分页面的配图已不可用，请重新选择或移除配图');
   const assets=originals.map(asset=>state.adoptAsset(asset.id,workspaceId)).filter((a):a is Asset=>!!a);if(assets.length!==originals.length)throw new Error('参考资料不可用，请重新上传');
   const adoptedSections=prepared.map(section=>({...section,imageAssetId:section.imageAssetId?assets[originals.findIndex(a=>a.id===section.imageAssetId)]?.id:undefined}));
   const referenceText=files.map(f=>f.text).join('\n');
   const signature=planSignature(prepared);
   const existingDraft=inline?findPresentationDraft(draftCheckpoint.current,useStudio.getState().works,workspaceId,sessionRequestKey,signature,canWriteAIWorkspace(workspaceId)):undefined;
   let work:Work;
   if(existingDraft)work=existingDraft;
   else if(kind==='presentation')work=buildPresentationWork({title:planTitle||topic.trim().slice(0,80),sections:adoptedSections},{...size,prompt:topic,model,styleId,designSystem:state.systems.find(system=>system.id===styleId),workspaceId,assets,referenceText,skillIds:usedSkills.map(skill=>skill.id),references});
   else{
    const base={...createSceneWork({title:planTitle||topic.trim().slice(0,80),kind,type:'媒体叙事型',styleId,...size,blank:true}),workspaceId,contentPurposes:[]};
    work={...base,aiModel:model,references:structuredClone(references),creationPackage:{...sourcePackage(topic,assets,{audience,referenceText,targetDuration:String(duration),model}),references:structuredClone(references),skillIds:usedSkills.map(skill=>skill.id)},shots:adoptedSections.map(s=>({id:crypto.randomUUID(),title:s.title,narration:s.narration,duration:Math.max(1,Math.round(duration/sections.length)),src:assets.find(a=>a.id===s.imageAssetId)?.src||(!styleId?'':`/media/${styleId}.svg`),assetId:s.imageAssetId})),voice:'专业讲解'};
   }
   if(kind==='presentation'&&!existingDraft)work=applyCreationReferences(work,references,{prompt:topic,preserveColors:Boolean(styleId)});
   let audioNotice='';
   assertAIWorkspaceWrite(workspaceId);validateReferences(references,useStudio.getState(),workspaceId);
   if(request.signal.aborted)throw new Error('制作已停止，方案已保留');
   if(inline&&kind==='presentation'&&model!=='demo'){
    // The visual work is complete. Audio service failures must not discard it.
    work={...work,creationPackage:{...work.creationPackage!,params:{...work.creationPackage!.params,presentationCreationRequestKey:sessionRequestKey,presentationDraftSignature:signature}}};
    state.saveWork(work);
    draftCheckpoint.current={draftWorkId:work.id,draftSignature:signature};
    try{localStorage.setItem(`zc-creation-plan:${workspaceId}:${requestKey}`,JSON.stringify({...planCheckpoint(prepared),...draftCheckpoint.current}));}
    catch{throw new Error('作品已保存，但无法保存继续制作进度；请从作品库打开已保存作品。');}
    setPreparingSpeech(true);setProgress('正在预备开场讲解，剩余语音演示时按需生成');
    const checkAccess=()=>{assertAIWorkspaceWrite(workspaceId);validateReferences(references,useStudio.getState(),workspaceId);};
    const preparedAudio=await preparePresentationAudio(work,{
     signal:request.signal,beforeRequest:checkAccess,
     onPrepared:partial=>{checkAccess();state.saveWork(partial);},
     onProgress:(prepared,total)=>setProgress(`已预备 ${prepared} / ${total} 句讲解，其余演示时按需生成`),
    });
    work=preparedAudio.work;audioNotice=preparedAudio.message;
   }
   assertAIWorkspaceWrite(workspaceId);validateReferences(references,useStudio.getState(),workspaceId);
   state.saveWork(work);if(inline){draftCheckpoint.current=undefined;localStorage.removeItem(`zc-creation-plan:${workspaceId}:${requestKey}`);}onCreated?.(work);if(!inline){onClose();navigate(kind==='presentation'?`/presentations/${work.id}`:`/video/${work.id}`);}toast(audioNotice||(inline?'作品已生成，可直接体验或选择进入编辑器':'作品已创建，可以继续编辑'));
  }catch(e){setError(e instanceof Error?e.message:'创建失败，请重试');}finally{setBusy(false);setProgress('');setPreparingSpeech(false);}
 };
 const pendingImages=sections.filter(section=>!section.imageAssetId).length;
 const edit=(index:number,patch:Partial<PresentationSection&{imagePrompt:string}>)=>setSections(old=>old.map((section,i)=>i===index?{...section,...patch}:section));
 useEffect(() => {
  if (!inline || !onActivity || !busy) return;
  onActivity({step: step === 0 ? 0 : 3, label: progress || (step === 0 ? '正在整理演示大纲' : '正在编排作品')});
  return () => onActivity();
 }, [inline, onActivity, busy, step, progress]);
 return <><CreationSurface inline={inline} open={open&&imagePage===null} onClose={close} title={inline?'确认演示内容与素材':`新建${kind==='presentation'?'智能演示':'视频作品'}`} footer={<>{!inline&&progress&&<span className="creation-progress" role="status">{progress}</span>}{busy&&<Button onClick={()=>controller.current?.abort()}>{preparingSpeech?'停止配音并保留作品':'暂停制作'}</Button>}<Button disabled={busy||uploading} onClick={()=>step?setStep(0):(onBack||close)()}>{inline?'调整创作要求':'返回上一步'}</Button><Button variant="primary" disabled={busy||uploading} onClick={()=>step?void create():void generate()}>{busy?(progress?'正在制作作品…':'正在整理内容…'):step?(inline?'按此方案生成作品':'创建并进入编辑器'):kind==='video'?'生成分镜':'生成大纲'}<ArrowRight size={14}/></Button></>}>
  {referenceSnapshot.current.length>0&&<p className="studio-muted">本次展项参考：{referenceSnapshot.current.map(reference=>`${reference.sourceTitle}（${{interaction:'交互',ui:'UI 风格',content:'内容组织',effect:'局部效果'}[reference.dimension]} · ${reference.scopeLabel}）`).join('、')}。作为策划参考，具体效果以生成后预览为准。</p>}
  <Stepbar steps={[inline?'理解需求':'填写主题',kind==='video'?'确认分镜与素材':'确认大纲与素材',inline?'生成与体验':'进入编辑器']} current={step}/>
  {step===0?<fieldset disabled={busy||uploading} className="studio-create-form creation-setup"><Field label="你想讲述什么？"><textarea autoFocus rows={3} maxLength={4000} value={topic} placeholder="例如：根据上传的大纲，介绍企业发展历程、核心技术与代表案例。" onChange={e=>setTopic(e.target.value)}/></Field><div className="studio-form-row"><Field label="面向受众"><select value={audience} onChange={e=>setAudience(e.target.value)}>{['展厅参观者','客户与合作伙伴','企业管理层','培训学员'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="设计风格"><PresentationStylePicker value={styleId} systems={state.systems} onChange={setStyleId}/></Field></div>{files.reduce((sum,f)=>sum+f.text.length,0)>24000&&<p className="studio-muted">本次大纲使用前 24000 字参考内容，完整文件仍会保存。</p>}<CreationSources workspaceId={workspaceId} files={files} onChange={setFiles} onBusy={setUploading}/><div className="studio-form-row"><CreationSize value={resolution} onChange={setResolution} width={width} height={height} onWidth={setWidth} onHeight={setHeight}/><Field label={kind==='video'?'建议分镜数量':'建议页数'}><input type="number" min={1} max={30} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(30,+e.target.value||1)))}/></Field>{kind==='video'&&<Field label="目标时长（秒）"><input type="number" min={10} max={1800} value={duration} onChange={e=>setDuration(Math.max(10,Math.min(1800,+e.target.value||60)))}/></Field>}</div><CreationModel value={model} onChange={setModel}/></fieldset>:<fieldset disabled={busy||uploading} className="creation-confirm-fields"><div className="creation-outline">{usedSkills.length>0&&<p className="studio-muted" title={usedSkills.map(skill=>`${skill.name}：${skill.reason}`).join("；")}>{model==='demo'?'已匹配技能（演示模式未调用模型）':'本次参考技能'}：{usedSkills.map(skill=>skill.name).join("、")}</p>}<p className="studio-muted">{model==='demo'?'当前为离线示例，请替换预置内容。':`面向${audience}整理的内容草稿，请核对资料与表述。`}正文、讲稿与配图将用于实际生成，可逐页调整。</p><Field label="演示名称"><input value={planTitle} maxLength={80} onChange={e=>setPlanTitle(e.target.value)}/></Field>{sections.map((section,i)=><div className="creation-outline-item" key={section.reviewId||section.title}><span>{String(i+1).padStart(2,'0')}</span><div><input aria-label={`第${i+1}页标题`} value={section.title} onChange={e=>edit(i,{title:e.target.value})}/><textarea aria-label={`第${i+1}页正文要点`} rows={3} value={section.bullets.join('\n')} placeholder="每行一个正文要点" onChange={e=>edit(i,{bullets:e.target.value.split('\n').slice(0,6)})}/><textarea aria-label={`第${i+1}页讲稿`} rows={3} value={section.narration} onChange={e=>edit(i,{narration:e.target.value})}/><div className="studio-form-row"><select aria-label={`第${i+1}页布局`} value={section.layout} onChange={e=>edit(i,{layout:e.target.value as PresentationSection['layout']})}><option value="title">主题页</option><option value="bullets">正文要点</option><option value="split">图文布局</option></select></div><label className="creation-image-prompt">配图描述<textarea aria-label={`第${i+1}页配图描述`} rows={2} value={section.imagePrompt??`${planTitle}：${section.title}。${section.bullets.join('；')}。`} onChange={event=>edit(i,{imagePrompt:event.target.value})}/></label><AssetReview value={images.find(asset=>asset.id===section.imageAssetId)||state.assets.find(asset=>asset.id===section.imageAssetId)} workspaceId={workspaceId} styleId={styleId} prompt={section.imagePrompt??`${planTitle}：${section.title}。${section.bullets.join('；')}。`} requestKey={`${sessionRequestKey}:${section.reviewId||section.title}`} onBusy={setUploading} onChange={asset=>{setImages(old=>[...old.filter(item=>item.id!==asset.id),asset]);edit(i,{imageAssetId:asset.id,layout:'split'});}}/>{section.imageAssetId&&<Button size="sm" onClick={()=>edit(i,{imageAssetId:undefined})}>移除配图</Button>}</div><div className="creation-outline-actions"><Button size="sm" aria-label={`上移第${i+1}页`} disabled={i===0} onClick={()=>setSections(old=>reorder(old,i,-1))}><ArrowUp size={13}/></Button><Button size="sm" aria-label={`下移第${i+1}页`} disabled={i===sections.length-1} onClick={()=>setSections(old=>reorder(old,i,1))}><ArrowDown size={13}/></Button><Button size="sm" aria-label={`删除第${i+1}页`} disabled={sections.length===1} onClick={()=>setSections(old=>old.filter((_,j)=>j!==i))}><X size={13}/></Button></div></div>)}<Button onClick={()=>setSections(old=>[...old,{reviewId:crypto.randomUUID(),title:kind==='video'?'新分镜':'新章节',narration:'',bullets:[''],layout:'bullets'}])}><Plus size={14}/>添加{kind==='video'?'分镜':'章节'}</Button></div></fieldset>}{step===1&&<label className="generation-delivery-status"><input type="checkbox" checked={generateMissing&&pendingImages>0} disabled={busy||pendingImages===0||model==='demo'} onChange={event=>setGenerateMissing(event.target.checked)}/> 为缺少配图的页面自动生成素材（{sections.filter(section=>section.imageAssetId).length} 页已有配图，{sections.filter(section=>!section.imageAssetId).length} 页待配图）{model==='demo'?'（离线示例模式不调用服务）':''}</label>}{error&&<p className="form-error" role="alert">{error}</p>}
 </CreationSurface><MaterialPicker open={open&&imagePage!==null} onClose={()=>setImagePage(null)} workspaceId={workspaceId} kinds={['image']} title="选择本页配图" onSelect={asset=>{if(imagePage===null)return;setImages(old=>[...old.filter(a=>a.id!==asset.id),asset]);edit(imagePage,{imageAssetId:asset.id,layout:'split'});setImagePage(null);}}/></>;
}
