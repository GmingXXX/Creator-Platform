import {pluginDeniedReason,useCreationConfig} from '../../domain/creation-plugins';
import {StoryPlanMap} from './StoryPlanMap';
import {storyKinds,storyKind,type StoryLayer} from '../../domain/story-canvas';
import '../../styles/story-authoring.css';
import type {RunActivity} from '../creation/RunProgress';
import {assertAIWorkspaceWrite,canWriteAIWorkspace} from '../../domain/workspace-ai-access';
import {checkpointSources,restoreCheckpointSources} from './creation-source-checkpoint';
import {validateReferences,type ExhibitReference} from '../../domain/exhibit-references';
import {assetAvailableForAI} from '../../domain/asset-access';
import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,ImagePlus,Plus,Upload,X} from 'lucide-react';
import {Button,Modal,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {selectTaskSkills,type SkillSelection} from '../../domain/skill-matching';
import {importWorkspaceFile} from '../../domain/workspace-upload';
import {captureKnowledgeTarget} from '../../domain/workspace-knowledge';
import type {Asset,StoryEdge,StoryNode,Work} from '../../domain/types';
import {buildStoryWork,generateStoryPlan,storyPlanErrors,type StoryGenerationInput,type StoryPlan} from '../../domain/story-generation';
import {MaterialPicker} from '../resources/MaterialPicker';
import {AssetPreview} from '../resources/Shared';
import {CreationModel,CreationSize,CreationSources,type SourceFile} from './CreationFields';
import {resolveCreationSize} from './creationLogic';
import {Field,Stepbar} from './StudioShared';
import {CreationSurface} from './CreationSurface';
import {AssetReview} from '../creation/AssetReview';
import {generateReviewVideo} from '../creation/generation-review-video';
import {generateReviewImage} from '../creation/generation-materials';
import {visualGenerationPrompt} from '../../domain/visual-guidelines';
import '../../styles/studios.css';
import '../../styles/studio-creation.css';

const labels=storyKinds;
const isMedia=(asset:Asset)=>['image','video','html'].includes(asset.kind);
export interface StoryCreationDialogProps {
 inline?:boolean;requestKey?:string;onBack?:()=>void;open:boolean;onClose:()=>void;initialTitle?:string;initialFlow?:string;initialTopic?:string;
 initialWorkspaceId?:string;initialModel?:string;initialStyleId?:string;initialSkillIds?:string[];initialReferences?:ExhibitReference[];initialFiles?:SourceFile[];
 initialAutoGenerate?:boolean;keepDraftOnClose?:boolean;onCreated?:(work:Work)=>void;onActivity?:(activity?:RunActivity)=>void;
}
export function StoryCreationDialog({inline=false,requestKey='manual-story',onBack,open,onClose,initialTitle='',initialFlow='',initialTopic='',initialWorkspaceId,initialModel=useCreationConfig.getState().defaultModel,initialStyleId='',initialSkillIds=[],initialReferences=[],initialFiles=[],initialAutoGenerate=false,keepDraftOnClose=false,onCreated,onActivity}:StoryCreationDialogProps){
 const referenceSnapshot=useRef<ExhibitReference[]>(structuredClone(initialReferences));
 const sessionRequestKey=useRef(inline?requestKey:crypto.randomUUID()).current;
 const state=useStudio(),navigate=useNavigate();
 const [usedSkills,setUsedSkills]=useState<SkillSelection[]>([]);
 const [generateMissing,setGenerateMissing]=useState(inline),[progress,setProgress]=useState(''),[mediaPrompts,setMediaPrompts]=useState<Record<string,string>>({}),[mediaModes,setMediaModes]=useState<Record<string,'image'|'video'>>({});
 const workspaceRef=useRef(initialWorkspaceId||useStudio.getState().activeWorkspaceId);
 const [title,setTitle]=useState('未命名互动影片'),[flow,setFlow]=useState(''),[step,setStep]=useState(0);
 const [resolution,setResolution]=useState('1920×1080'),[width,setWidth]=useState(1920),[height,setHeight]=useState(1080),[styleId,setStyleId]=useState(initialStyleId);
 const [files,setFiles]=useState<SourceFile[]>([]),[pool,setPool]=useState<Asset[]>([]),[nodes,setNodes]=useState<StoryNode[]>([]),[edges,setEdges]=useState<StoryEdge[]>([]);
 const [model,setModel]=useState(initialModel),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[picker,setPicker]=useState<string>();
 const mediaInput=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),initialized=useRef(false),generationEpoch=useRef(0),titleEdited=useRef(false);
 const context=[flow,...files.map(file=>file.text)].filter(Boolean).join('\n\n');
 const analyze=async(input:StoryGenerationInput)=>{
  const request=new AbortController();controller.current?.abort();controller.current=request;setBusy(true);setError('');
  try{
   const unavailable=!inline&&pluginDeniedReason('story',workspaceRef.current);if(unavailable)throw new Error(unavailable);
   assertAIWorkspaceWrite(workspaceRef.current);
   const references=validateReferences(referenceSnapshot.current,useStudio.getState(),workspaceRef.current);
   const matched=selectTaskSkills({accessState:{...useStudio.getState(),activeWorkspaceId:workspaceRef.current},skills:useStudio.getState().skills,prompt:[input.title,input.flow,...input.files.map(file=>file.text)].join('\n'),outputKind:'story',workspaceId:workspaceRef.current,explicitSkillIds:initialSkillIds});
   const selected=useStudio.getState().skills.filter(skill=>matched.skillIds.includes(skill.id)).map(skill=>({name:skill.name,input:skill.input,steps:skill.steps,instructions:skill.sourcePackage?.instructions}));
   let draft:StoryPlan;
   if(input.model==='demo'){
    const parts=[input.flow,...input.files.map(file=>file.text)].join('\n').split(/[\n→]+/).map(value=>value.trim()).filter(Boolean).slice(0,10);
    const scenes=parts.map((text,index)=>({id:`scene-${index}`,type:'scene',title:text.slice(0,30),text,x:370+index*300,y:100}));
    const list=[{id:'start',type:'start',title:'体验开始',text:'',x:70,y:100},...scenes,{id:'end',type:'end',title:'体验结束',text:'',x:370+scenes.length*300,y:100}];
    draft={nodes:list,edges:list.slice(0,-1).map((node,index)=>({id:`edge-${index}`,source:node.id,target:list[index+1].id,label:'继续'}))};
   }else draft=await generateStoryPlan({...input,skills:selected,references,workspaceId:workspaceRef.current},request.signal);
   assertAIWorkspaceWrite(workspaceRef.current);
   if(!request.signal.aborted){if(!titleEdited.current&&draft.title)setTitle(draft.title);setNodes(draft.nodes.map(n=>({...n,type:storyKind(n.type)})));setEdges(draft.edges);setUsedSkills(matched.selections);setStep(1);}
  }catch(reason){if(!request.signal.aborted)setError(reason instanceof Error?reason.message:'生成未完成，请重试');}
  finally{if(controller.current===request)setBusy(false);}
 };
 useEffect(()=>()=>{generationEpoch.current++;initialized.current=false;controller.current?.abort();},[]);
 useEffect(()=>{
  if(!open){if(!keepDraftOnClose){generationEpoch.current++;controller.current?.abort();initialized.current=false;}return;}
  if(keepDraftOnClose&&initialized.current)return;
  initialized.current=true;referenceSnapshot.current=structuredClone(initialReferences);workspaceRef.current=initialWorkspaceId||useStudio.getState().activeWorkspaceId;setUsedSkills([]);
  const epoch=++generationEpoch.current;
  {
   const nextTitle=initialTitle||'未命名互动影片',nextFlow=initialFlow||initialTopic;
   titleEdited.current=Boolean(initialTitle);
   const media=initialFiles.map(file=>file.asset).filter(isMedia);
   setTitle(nextTitle);setFlow(nextFlow);setModel(initialModel);setStyleId(initialStyleId);setFiles(initialFiles);setPool(media);setNodes([]);setEdges([]);setStep(0);setBusy(false);setError('');setPicker(undefined);
   let restored=false;if(inline){try{const saved=JSON.parse(localStorage.getItem(`zc-creation-plan:${workspaceRef.current}:${requestKey}`)||'null');if(saved?.kind==='story'&&Array.isArray(saved.nodes)&&saved.nodes.length<=40&&Array.isArray(saved.edges)&&saved.edges.length<=100&&saved.nodes.every((node:StoryNode)=>typeof node.id==='string'&&typeof node.title==='string'&&typeof node.text==='string')&&saved.edges.every((edge:StoryEdge)=>typeof edge.source==='string'&&typeof edge.target==='string'&&typeof edge.label==='string')){
    const available=useStudio.getState().assets.filter(asset=>assetAvailableForAI(asset,workspaceRef.current));const restoredFiles=Array.isArray(saved.sources)?restoreCheckpointSources(saved.sources,available,workspaceRef.current):initialFiles;setFiles(restoredFiles);setTitle(typeof saved.title==='string'?saved.title:nextTitle);setFlow(typeof saved.flow==='string'?saved.flow:nextFlow);setNodes(saved.nodes.map((node:StoryNode)=>{const asset=available.find(asset=>asset.id===node.mediaAssetId);return {...node,type:storyKind(node.type),mediaAssetId:asset?.id,media:asset?.src,layers:node.layers?.map(l=>l.assetId?{...l,src:available.find(a=>a.id===l.assetId)?.src}:l)};}));setEdges(saved.edges);setPool(available.filter(asset=>saved.nodes.some((node:StoryNode)=>node.mediaAssetId===asset.id||node.layers?.some(l=>l.assetId===asset.id))||restoredFiles.some(file=>isMedia(file.asset)&&file.asset.id===asset.id)));setStep(saved.step===0?0:1);setMediaPrompts(saved.mediaPrompts&&typeof saved.mediaPrompts==='object'?saved.mediaPrompts:{});setGenerateMissing(saved.generateMissing!==false);setMediaModes(saved.mediaModes&&typeof saved.mediaModes==='object'?saved.mediaModes:{});setUsedSkills(Array.isArray(saved.usedSkills)?saved.usedSkills:[]);if(typeof saved.styleId==='string')setStyleId(saved.styleId);if(typeof saved.model==='string')setModel(saved.model);if(typeof saved.resolution==='string')setResolution(saved.resolution);if(Number.isInteger(saved.width))setWidth(saved.width);if(Number.isInteger(saved.height))setHeight(saved.height);restored=true;
   }}catch{setError('已保存方案无法读取，将重新整理。');}}
   if(!restored&&initialAutoGenerate&&(nextFlow.trim()||initialFiles.some(file=>file.text.trim())))void Promise.resolve().then(()=>{if(generationEpoch.current===epoch)void analyze({title:nextTitle,flow:nextFlow,files:initialFiles,assets:media,model:initialModel,styleId:initialStyleId});});
  }
 },[open,keepDraftOnClose]);
 useEffect(()=>{if(inline&&nodes.length&&canWriteAIWorkspace(workspaceRef.current)){try{localStorage.setItem(`zc-creation-plan:${workspaceRef.current}:${requestKey}`,JSON.stringify({kind:'story',step,sources:checkpointSources(files),title,flow,nodes,edges,usedSkills,mediaPrompts,mediaModes,generateMissing,styleId,model,resolution,width,height}));}catch{setError('浏览器无法保存方案，请保持本页打开。');}}},[inline,step,files,nodes,edges,title,flow,usedSkills,mediaPrompts,mediaModes,generateMissing,requestKey,styleId,model,resolution,width,height]);
 const close=()=>{if(uploading)return;if(!keepDraftOnClose)controller.current?.abort();setPicker(undefined);onClose();};
 const generate=()=>{
  if(!title.trim())return setError('请填写作品名称');
  if(!context.trim())return setError('请填写体验流程，或上传可读取文字的策划脚本');
  try{resolveCreationSize(resolution,width,height);}catch(reason){setError((reason as Error).message);return;}
  void analyze({title,flow,files,assets:pool,model,styleId});
 };
 const create=async(blank:boolean)=>{
  if(!title.trim())return setError('请填写作品名称');
  if(busy||uploading)return;setBusy(true);setError('');const request=new AbortController();controller.current=request;
  try{
   const references=validateReferences(referenceSnapshot.current,useStudio.getState(),workspaceRef.current);
   const size=resolveCreationSize(resolution,width,height);
   const disabled=blank&&pluginDeniedReason('story',workspaceRef.current);if(disabled)throw new Error(disabled);
   if(!blank){const issues=storyPlanErrors(nodes,edges);if(issues.length)throw new Error(issues.join('；'));}
   let preparedNodes=nodes,preparedPool=pool;
   assertAIWorkspaceWrite(workspaceRef.current);
   if(!blank&&generateMissing&&model!=='demo'){
    for(let index=0;index<preparedNodes.length;index++){const node=preparedNodes[index];if(node.mediaAssetId)continue;
     validateReferences(references,useStudio.getState(),workspaceRef.current);
     setProgress(`正在生成节点 ${index+1} / ${preparedNodes.length} 的素材，已完成的素材会保留`);
     const generationPrompt=visualGenerationPrompt(mediaPrompts[node.id]||`${title}：${node.title}。${node.text.slice(0,1000)}。故事场景配图，不在画面上生成字幕。`,state.systems.find(style=>style.id===styleId));
     let asset=await generateReviewImage({prompt:generationPrompt,workspaceId:workspaceRef.current,styleId,requestKey:`${sessionRequestKey}:${node.id}`,signal:request.signal});
     if((mediaModes[node.id]||(node.type==='scene'?'video':'image'))==='video'){setProgress(`正在生成节点 ${index+1} / ${preparedNodes.length} 的视频片段`);asset=await generateReviewVideo({prompt:generationPrompt,workspaceId:workspaceRef.current,styleId,requestKey:`${sessionRequestKey}:${node.id}:video`,referenceImage:asset.src,signal:request.signal});}
     preparedPool=[...preparedPool.filter(item=>item.id!==asset.id),asset];preparedNodes=preparedNodes.map(item=>item.id===node.id?{...item,media:asset.src,mediaAssetId:asset.id}:item);setPool(preparedPool);setNodes(preparedNodes);
    }
   }
   const studio=useStudio.getState(),workspaceId=workspaceRef.current,sourceAssets=[...new Map([...files.map(file=>file.asset),...preparedPool].map(asset=>[asset.id,asset])).values()];
   const adopted=sourceAssets.map(asset=>studio.adoptAsset(asset.id,workspaceId));
   if(adopted.some(asset=>!asset))throw new Error('有参考素材暂不可用，请重新选择');
   const assets=adopted as Asset[],assetIdMap=new Map(sourceAssets.map((asset,index)=>[asset.id,assets[index]]));
   const work=buildStoryWork({title,flow,files,assets,assetIdMap,plan:{nodes:preparedNodes,edges},...size,workspaceId,model,styleId,skillIds:blank?[]:usedSkills.map(skill=>skill.id),blank,references});
   assertAIWorkspaceWrite(workspaceId);validateReferences(references,useStudio.getState(),workspaceId);
   if(request.signal.aborted)throw new Error('制作已停止，方案已保留');
   studio.saveWork(work);if(inline)localStorage.removeItem(`zc-creation-plan:${workspaceRef.current}:${requestKey}`);onCreated?.(useStudio.getState().works.find(item=>item.id===work.id)||work);if(!inline){onClose();navigate(`/dream/${work.id}`);}toast(inline?'互动影片已生成，可以直接体验或进入节点画布':blank?'空白节点画布已创建，可以开始搭建':'节点与素材已保存，可以继续编辑或试运行');
  }catch(reason){setError(reason instanceof Error?reason.message:'创建失败，请重试');}finally{setBusy(false);setProgress('');}
 };
 const addMedia=(asset:Asset)=>setPool(old=>old.some(item=>item.id===asset.id)?old:[...old,asset]);
 const bind=(nodeId:string,asset:Asset)=>{addMedia(asset);setNodes(old=>old.map(node=>node.id===nodeId?{...node,media:asset.src,mediaAssetId:asset.id}:node));};
 const overlay=(nodeId:string,asset:Asset)=>{addMedia(asset);const layer:StoryLayer={id:crypto.randomUUID(),kind:asset.kind as StoryLayer['kind'],name:asset.name,text:'',x:15,y:15,width:70,height:60,src:asset.src,assetId:asset.id};setNodes(old=>old.map(node=>node.id===nodeId?{...node,layers:[...(node.layers||[]),layer]}:node));};
 const placeOptions=(node:StoryNode)=>{const routes=edges.filter(e=>e.source===node.id&&(!e.trigger||e.trigger==='click'));const buttons=routes.map((edge,i):StoryLayer=>({id:crypto.randomUUID(),kind:'button',name:edge.label,text:edge.label,x:8+(i%3)*30,y:82-(Math.floor(i/3)*Math.min(12,78/Math.ceil(routes.length/3))),width:25,height:Math.min(10,74/Math.ceil(routes.length/3)),color:'#ffffff',size:2.4}));setNodes(items=>items.map(n=>n.id===node.id?{...n,layers:[...(n.layers||[]),...buttons]}:n));setEdges(items=>items.map(e=>{const i=routes.findIndex(r=>r.id===e.id);return i<0?e:{...e,trigger:'layerClick',layerId:buttons[i].id};}));};
 const uploadMedia=async(list:FileList|null)=>{
  if(!list)return;setUploading(true);setError('');
  try{const workspaceId=workspaceRef.current,knowledgeTarget=captureKnowledgeTarget(useStudio.getState(),workspaceId),added:Asset[]=[];for(const file of Array.from(list)){
   if(!/\.(png|jpg|jpeg|webp|gif|svg|avif|mp4|webm|mov|html|htm)$/i.test(file.name))throw new Error('节点素材支持图片、视频和 HTML');
   const asset=await importWorkspaceFile(file,workspaceId,knowledgeTarget);useStudio.getState().addAsset(asset);added.push(asset);
  }setPool(old=>[...old,...added]);}catch(reason){setError(reason instanceof Error?reason.message:'素材上传失败');}
  finally{setUploading(false);if(mediaInput.current)mediaInput.current.value='';}
 };
 const update=(id:string,patch:Partial<StoryNode>)=>{setNodes(old=>old.map(node=>node.id===id?{...node,...patch}:node));setError('');};
 const issues=step===1?storyPlanErrors(nodes,edges):[];
 const missing=nodes.filter(node=>node.type!=='start'&&!node.mediaAssetId).length;
 useEffect(() => {
  if (!inline || !onActivity || !busy) return;
  onActivity({step: step === 0 ? 0 : 3, label: progress || (step === 0 ? '正在整理故事节点' : '正在编排作品')});
  return () => onActivity();
 }, [inline, onActivity, busy, step, progress]);
 return <><CreationSurface inline={inline} open={open} onClose={close} title={inline?"确认策划、节点与素材":"创建互动影片"} footer={<>{!inline&&progress&&<span className="creation-progress" role="status">{progress}</span>}
  {busy&&<Button onClick={()=>controller.current?.abort()}>暂停制作</Button>}<Button disabled={busy||uploading} onClick={()=>step?setStep(0):(onBack||close)()}><ArrowLeft size={14}/>{inline?'调整创作要求':'返回上一步'}</Button>
  {step===0?<><Button disabled={busy||uploading} variant={context.trim()?'secondary':'primary'} onClick={()=>void create(true)}>进入空白画布<ArrowRight size={14}/></Button>{context.trim()&&<Button variant="primary" disabled={busy||uploading} onClick={generate}>{busy?'正在整理节点…':'生成节点草稿'}<ArrowRight size={14}/></Button>}</>:<Button variant="primary" disabled={busy||uploading||issues.length>0} onClick={()=>void create(false)}>{busy?'正在制作作品…':inline?'按此方案生成作品':'创建并进入节点画布'}<ArrowRight size={14}/></Button>}
 </>}>
  {referenceSnapshot.current.length>0&&<p className="studio-muted">本次展项参考：{referenceSnapshot.current.map(reference=>`${reference.sourceTitle}（${{interaction:'交互',ui:'UI 风格',content:'内容组织',effect:'局部效果'}[reference.dimension]} · ${reference.scopeLabel}）`).join('、')}。按支持的节点与分支整理，视觉效果以实际预览为准。</p>}
  <Stepbar steps={[inline?'策划故事':'描述体验','确认节点与素材',inline?'生成与体验':'节点画布']} current={step}/>
  {step===0?<fieldset disabled={busy||uploading} className="studio-create-form creation-setup">
   <Field label="作品名称"><input autoFocus value={title} maxLength={80} onChange={event=>{titleEdited.current=true;setTitle(event.target.value);}}/></Field>
   <Field label="体验流程" hint="可以暂不填写，直接进入空白画布手动搭建。"><textarea rows={4} maxLength={8000} value={flow} onChange={event=>setFlow(event.target.value)} placeholder="观众从哪里开始？做出哪些选择？不同选择分别走向什么结果？"/></Field>
   <CreationSources workspaceId={workspaceRef.current} files={files} onChange={setFiles} onBusy={setUploading} label="上传策划脚本"/>
   <div className="creation-media-tools"><Button onClick={()=>setPicker('__pool__')}><ImagePlus size={14}/>添加参考素材</Button><span>{pool.length} 份素材可供脚本匹配</span></div>
   {pool.length>0&&<p className="studio-muted">{pool.map(asset=>asset.name).join('、')}</p>}
   <div className="studio-form-row"><CreationSize value={resolution} onChange={setResolution} width={width} height={height} onWidth={setWidth} onHeight={setHeight}/><Field label="设计风格"><select aria-label="设计风格" value={styleId} onChange={event=>setStyleId(event.target.value)}><option value="">无</option>{state.systems.filter(system=>system.id!=='none').map(system=><option key={system.id} value={system.id}>{system.name}</option>)}</select></Field>{context.trim()&&<CreationModel value={model} onChange={setModel}/>}</div>
   {initialSkillIds.length>0&&<p className="studio-muted">已带入技能：{state.skills.filter(skill=>initialSkillIds.includes(skill.id)).map(skill=>skill.name).join('、')}</p>}
   {context.length>32000&&<p className="studio-muted">本次节点草稿使用前 32000 字参考内容，完整文件会保留在作品中。</p>}
   <p className="studio-muted">脚本和素材均可稍后添加。封面从节点图片或视频选取，创建后仍可调整。</p>
  </fieldset>:<fieldset disabled={busy||uploading} className="creation-confirm-fields"><div className="creation-nodes">
   <Field label="作品名称"><input value={title} maxLength={80} onChange={event=>{titleEdited.current=true;setTitle(event.target.value);}}/></Field>
   <StoryPlanMap nodes={nodes} edges={edges} assets={[...pool,...state.assets]} onPick={id=>{const el=document.getElementById('story-plan-'+id);el?.scrollIntoView({block:'center',behavior:'smooth'});el?.querySelector('input')?.focus({preventScroll:true});}}/><details className="story-script-summary"><summary>查看策划脚本 · 剧情与分支</summary><p>以下脚本与下方节点共用内容，修改节点正文与选项后同步更新。</p>{nodes.map((node,index)=><section key={node.id}><strong>{index+1}. {node.title}</strong><p>{node.text}</p><small>{edges.filter(edge=>edge.source===node.id).map(edge=>`${edge.label} → ${nodes.find(item=>item.id===edge.target)?.title||'待指定'}`).join('；')||'故事结局'}</small></section>)}</details>
   {usedSkills.length>0&&<p className="studio-muted" title={usedSkills.map(skill=>`${skill.name}：${skill.reason}`).join("；")}>{model==='demo'?'已匹配技能（演示模式未调用模型）':'本次参考技能'}：{usedSkills.map(skill=>skill.name).join("、")}</p>}
   <p className="studio-muted">{model==='demo'?'演示模式按文本顺序整理草稿，分支可在画布手动调整。':'已按脚本生成节点和分支，请确认选项、结局及素材对应关系。'}{missing>0?` ${missing} 个节点暂未配图或视频，可继续搭建；运行时会显示场景文字与背景。`:' 节点素材已就绪。'}</p>
   <div className="creation-media-tools"><input ref={mediaInput} hidden type="file" multiple accept="image/*,video/*,.html,.htm" onChange={event=>void uploadMedia(event.target.files)}/><Button disabled={uploading} onClick={()=>mediaInput.current?.click()}><Upload size={14}/>{uploading?'正在上传…':'批量上传节点素材'}</Button><span>{pool.length} 份素材可分配</span></div>
   {nodes.map((node,index)=><article className="creation-node" id={'story-plan-'+node.id} key={node.id}>
    <div className="creation-node-number">{String(index+1).padStart(2,'0')}</div>
    <div className="creation-node-content"><div className="studio-form-row"><Field label={`节点 ${index+1} 名称`}><input value={node.title} maxLength={80} onChange={event=>update(node.id,{title:event.target.value})}/></Field><Field label={`节点 ${index+1} 类型`}><select value={storyKind(node.type)} onChange={event=>update(node.id,{type:event.target.value})}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div>
     <textarea aria-label={`节点 ${index+1} 内容`} value={node.text} rows={2} onChange={event=>update(node.id,{text:event.target.value})}/>
     <div className="creation-node-links">{edges.filter(edge=>edge.source===node.id).map(edge=><label key={edge.id}><input aria-label={`${node.title}选项文案`} value={edge.label} onChange={event=>setEdges(old=>old.map(value=>value.id===edge.id?{...value,label:event.target.value}:value))}/><ArrowRight size={12}/><select aria-label={`${node.title}后续节点`} value={edge.target} onChange={event=>setEdges(old=>old.map(value=>value.id===edge.id?{...value,target:event.target.value}:value))}>{nodes.filter(value=>value.id!==node.id&&value.type!=='start').map(value=><option key={value.id} value={value.id}>{value.title}</option>)}</select><Button size="sm" aria-label={`移除${node.title}的${edge.label}连接`} onClick={()=>setEdges(old=>old.filter(value=>value.id!==edge.id))}><X size={12}/></Button></label>)}</div>
     {node.type!=='end'&&<Button size="sm" onClick={()=>{const target=nodes.find(value=>value.id!==node.id&&value.type!=='start'&&!edges.some(edge=>edge.source===node.id&&edge.target===value.id));if(target)setEdges(old=>[...old,{id:crypto.randomUUID(),source:node.id,target:target.id,label:'新选项'}]);}}><Plus size={12}/>添加去向</Button>}
    </div>
    <div className="creation-node-media"><details><summary>场景素材与叠加控件</summary><Button size="sm" onClick={()=>setPicker('overlay:'+node.id)}>叠加图片、视频或 HTML</Button>{edges.some(e=>e.source===node.id&&(!e.trigger||e.trigger==='click'))&&<Button size="sm" onClick={()=>placeOptions(node)}>把选项放到画面上</Button>}{node.layers?.map(l=><small key={l.id}>{l.name} · {l.kind==='button'?'互动按钮':'叠加素材'}</small>)}</details><label>生成类型<select aria-label={`节点 ${index+1} 生成类型`} value={mediaModes[node.id]||(node.type==='scene'?'video':'image')} onChange={event=>setMediaModes(old=>({...old,[node.id]:event.target.value as 'image'|'video'}))}><option value="image">图片</option><option value="video">视频片段 · 5 秒</option></select></label><label>素材描述<textarea aria-label={`节点 ${index+1} 素材描述`} rows={3} maxLength={(mediaModes[node.id]||(node.type==='scene'?'video':'image'))==='video'?Math.max(0,1501-visualGenerationPrompt('x',state.systems.find(style=>style.id===styleId)).length):1500} value={mediaPrompts[node.id]??`${title}：${node.title}。${node.text}`} onChange={event=>setMediaPrompts(old=>({...old,[node.id]:event.target.value}))}/></label><AssetReview value={pool.find(asset=>asset.id===node.mediaAssetId)||state.assets.find(asset=>asset.id===node.mediaAssetId)} workspaceId={workspaceRef.current} styleId={styleId} prompt={mediaPrompts[node.id]??`${title}：${node.title}。${node.text}`} requestKey={`${sessionRequestKey}:${node.id}`} kinds={['image','video','html']} onBusy={setUploading} onChange={asset=>bind(node.id,asset)}/>{node.mediaAssetId&&<Button size="sm" onClick={()=>update(node.id,{media:undefined,mediaAssetId:undefined})}>移除素材</Button>}</div>
   </article>)}
   {issues.length>0&&<div className="form-error" role="alert"><strong>请先完善体验路径</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
  </div></fieldset>}
  {step===1&&<label className="generation-delivery-status"><input type="checkbox" checked={generateMissing} disabled={busy} onChange={event=>setGenerateMissing(event.target.checked)}/> 自动生成缺失节点素材{model==='demo'?'（离线示例模式不调用服务）':''}</label>}{error&&<p className="form-error" role="alert">{error}</p>}
 </CreationSurface><MaterialPicker open={!!picker} onClose={()=>setPicker(undefined)} workspaceId={workspaceRef.current} kinds={['image','video','html']} title={picker==='__pool__'?'添加故事参考素材':'选择节点素材'} onSelect={asset=>{if(picker?.startsWith('overlay:'))overlay(picker.slice(8),asset);else if(picker==='__pool__')addMedia(asset);else if(picker)bind(picker,asset);}}/></>;
}
