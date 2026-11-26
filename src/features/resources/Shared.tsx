import {workspaceCanEdit} from '../../domain/workspace-management';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileText, FolderOpen, Heart, Package, Play, Sparkles, Copy, ArrowUpRight, Image as ImageIcon, File, ChevronRight, Info } from 'lucide-react';
import { useStudio } from '../../domain/store';
import { workAvailableInSpace } from '../../domain/asset-access';
import { useMedia } from '../../domain/upload';
import {contentPurposes,getProjectCategory,getWorkPurposes,getWorkDisplayForm,publicationCategoryError,projectCategories} from '../../domain/project-taxonomy';
import {createSceneWork,exhibitTypes} from '../../domain/fixtures';
import {GeneratedComponentPackageDownload} from './GeneratedComponentReview';
import {AssetInsertTarget,type NewAssetProject} from './AssetInsertTarget';
import '../../styles/community-v14.css';
import type { Asset, Work } from '../../domain/types';
import { Artwork } from '../../components/Artwork';
import { SceneRenderer } from '../editor/SceneRenderer';
import { Button, Modal, Badge, Tabs, toast } from '../../components/ui';
import { assetCanInsert, assetNode, assetPreviewWork, formatDate, sourceLabels, typeLabels, workRoute } from './helpers';
import { MaterialWorkPreview } from './MaterialWorkPreview';
import { StoryExperience } from '../studios/StoryPreview';
import { AssetMetadataPanel, type AssetMetadataPanelHandle } from './AssetMetadataPanel';
import {CatalogComponentActions} from './CatalogComponentActions';
import {ExperienceSummary} from '../conversation/ExperiencePanel';


function SceneRuntimePreview({work,pageId}:{work:Work;pageId?:string}) {
 const host=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(0);
 useEffect(()=>{const el=host.current;if(!el)return;const fit=()=>setScale(el.clientWidth/work.width);fit();const observer=new ResizeObserver(fit);observer.observe(el);return()=>observer.disconnect();},[work.width]);
 return <div className="res-runtime-preview" ref={host} style={{aspectRatio:`${work.width} / ${work.height}`}}><div style={{width:work.width,height:work.height,transform:`scale(${scale})`,transformOrigin:'top left'}}><SceneRenderer work={work} pageId={pageId} interactive/></div></div>;
}

export function RuntimePreview({work,pageId}:{work:Work;pageId?:string}) {
 return work.kind==='presentation'||work.kind==='video'?<MaterialWorkPreview key={work.id} work={work} large/>:work.kind==='story'?<StoryExperience projectMusic={work.storyMusic} styleId={work.styleId} key={work.id} nodes={work.storyNodes||[]} edges={work.storyEdges||[]} width={work.width} height={work.height}/>:<SceneRuntimePreview work={work} pageId={pageId}/>;
}

export function FavoriteButton({id}:{id:string}) {
 const selected=useStudio(s=>s.favorites.includes(id));
 return <button className={`res-favorite ${selected?'is-active':''}`} aria-label={selected?'取消收藏':'收藏'} aria-pressed={selected} onClick={e=>{e.stopPropagation();useStudio.getState().toggleFavorite(id);}}><Heart size={16} fill={selected?'currentColor':'none'}/></button>;
}
export function Avatar({name}:{name:string}) {return <span className="res-avatar" aria-hidden="true">{name.slice(-2,-1)||name.slice(0,1)}</span>;}
export function AssetPreview({asset,large=false}:{asset:Asset;large?:boolean}) {
 const source=useMedia(asset.src);const preview=useMedia(asset.preview||asset.src);
 const works=useStudio(state=>state.works);const work=assetPreviewWork(asset,works);
 if(work&&(work.kind==='presentation'||work.kind==='video'))return <MaterialWorkPreview work={work} large={large}/>;
 if(asset.sourceWorkId||asset.workSnapshot)return <div className="res-document-preview"><FileText size={48}/><strong>{asset.name}</strong><span>工程预览暂不可用</span></div>;
 if(asset.kind==='video'&&large)return <video className="res-media-player" src={source} poster={preview} controls playsInline preload="metadata"/>;
 if(asset.kind==='audio'&&large)return <div className="res-audio-preview"><div className="res-wave">{Array.from({length:44},(_,i)=><i key={i} style={{height:`${20+(i*19)%70}%`}}/>)}</div><audio src={source} controls/><p>{asset.name}</p></div>;
 if((asset.kind==='html'||asset.kind==='component'&&asset.componentType==='html')&&large&&source)return <iframe className="res-html-preview" title={asset.name} src={source} sandbox="allow-scripts"/>;
 if(asset.kind==='component'&&asset.componentType==='html'&&!large&&asset.package?.params.catalogSlug)return <div className="res-asset-preview" style={{position:'relative'}}>{asset.package?.params.catalogEdited==='true'?<iframe title={`${asset.name}缩略预览`} src={source} sandbox="allow-scripts" tabIndex={-1} style={{width:'100%',height:'100%',border:0,pointerEvents:'none'}}/>:<img src={preview} alt={asset.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}<span aria-hidden="true" style={{position:'absolute',inset:0}}/><span className="res-asset-kind">组件</span></div>;
 if(asset.kind==='document'||asset.kind==='presentation')return <div className="res-document-preview"><FileText size={48}/><strong>{asset.name}</strong><span>文档资料</span></div>;
 return <div className={`res-asset-preview ${large?'is-large':''}`}><Artwork type={asset.componentType|| (asset.kind==='audio'?'bubble':undefined)} styleId={asset.package?.styleId} title={asset.name} image={asset.kind==='image'||asset.kind==='video'?preview:undefined}/>{asset.kind==='video'&&<span className="res-video-play"><Play size={20}/></span>}<span className="res-asset-kind">{typeLabels[asset.kind]}</span></div>;
}
export function PackageContents({asset}:{asset:Asset}) {
 const [selected,setSelected]=useState<number|null>(null);const skills=useStudio(s=>s.skills);const works=useStudio(s=>s.works);const pkg=asset.package;
 const linkedId=asset.sourceWorkId||pkg?.params.experienceWorkId;
 const linked=!asset.public&&linkedId?works.find(work=>work.id===linkedId&&!work.deletedAt&&(work.workspaceId||'personal')===(asset.workspaceId||'personal')):undefined;
 const experience=linked?.experience||pkg?.experience;
 if(!pkg)return <div className="res-soft-panel"><Package size={24}/><h3>暂无创作资料包</h3><p>该素材目前只包含成品。补充提示词、参考资产或技能后，即可用于同款创作。</p></div>;
 return <div className="res-package">{experience&&<ExperienceSummary record={experience}/>}<div className={`res-package-status ${pkg.complete?'complete':'incomplete'}`}><Package size={18}/><div><strong>创作资料包 <span>v{pkg.version}</span></strong><p>{pkg.complete?'资料已就绪，可完整带入下一次创作':'资料包不完整，请补齐依赖后使用一键同款'}</p></div>{pkg.complete&&<Check size={18}/>}</div><h4>关联文件 <span>{pkg.files.length}</span></h4><div className="res-file-tree">{pkg.files.map((f,i)=><div key={`${f.name}-${i}`}><button onClick={()=>setSelected(selected===i?null:i)}><File size={16}/><span>{f.name}</span><small>{f.type}</small><ChevronRight size={14} className={selected===i?'rotate-90':''}/></button>{selected===i&&<pre className="res-file-content">{f.content||`文件引用：${f.src||'未提供文件内容'}\n用途：${f.type}`}</pre>}</div>)}</div><h4>创作提示词</h4><div className="res-prompt-copy"><p>{pkg.prompt}</p><button aria-label="复制提示词" onClick={()=>navigator.clipboard.writeText(pkg.prompt).then(()=>toast('提示词已复制')).catch(()=>toast('无法访问剪贴板，请手动选择文本复制'))}><Copy size={15}/></button></div>{pkg.negativePrompt&&<p className="res-muted">约束：{pkg.negativePrompt}</p>}<h4>关联 Skills</h4><div className="res-inline-tags">{pkg.skillIds.length?pkg.skillIds.map(id=><Badge key={id}>{skills.find(s=>s.id===id)?.name||id}</Badge>):<span className="res-muted">本次创作未使用额外技能</span>}</div><h4>生成参数</h4><dl className="res-detail-grid">{Object.entries(pkg.params).filter(([key])=>key!=='experienceWorkId').map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p className="res-muted">来源版本：{pkg.sourceId||asset.id} · {asset.author}</p></div>;
}
export function SubmissionDialog({work,asset,onClose}:{work?:Work;asset?:Asset;onClose:()=>void}) {
 const [title,setTitle]=useState(work?.title||asset?.name||'');
 const [description,setDescription]=useState(asset?.description||(work?.kind==='story'?'可直接复用的互动影片模板，包含故事节点、分支关系和媒体素材。':work?.kind==='video'?'可继续编辑的视频模板，包含完整分镜与讲解文案。':work?.kind==='presentation'?'可继续编辑的演示模板，包含页面、内容与讲稿。':'可直接复用的交互页面模板，包含页面、组件、交互和素材。'));
 const [purposes,setPurposes]=useState(work?getWorkPurposes(work):[]),[form,setForm]=useState<Work['type']|''>(work?getWorkDisplayForm(work)||'':'');
 const [agreed,setAgreed]=useState(false),[error,setError]=useState('');
 const submit=()=>{
  if(!title.trim()||!description.trim()){setError('请填写标题和用途说明。');return;}
  if(work&&work.kind!=='exhibit'&&!purposes.length){setError('请选择至少一项展示内容。');return;}
  if(work){const categoryError=publicationCategoryError({...work,contentPurposes:purposes,displayForm:form||null});if(categoryError){setError(categoryError);return;}}
  if(!agreed){setError('请确认已检查投稿内容与素材使用范围。');return;}
  try {
   const state=useStudio.getState();
   if(work){const latest=state.works.find(w=>w.id===work.id);if(!latest){setError('当前作品已不存在，请返回作品列表。');return;}state.saveWork({...latest,contentPurposes:purposes,...(latest.kind==='exhibit'?{displayForm:form||null,...(form?{type:form}:{})}:{})});}
   const id=work?state.submitWork(work.id):asset?state.submitAsset(asset.id):undefined;
   if(!id){setError('当前资源无法提交，请检查是否已有待审核版本。');return;}
   useStudio.setState(data=>({submissions:data.submissions.map(item=>item.id===id&&workspaceCanEdit(data,item.work?.workspaceId||item.asset?.workspaceId||'personal')?{...item,name:title.trim(),description,work:item.work?{...item.work,title:title.trim()}:undefined,asset:item.asset?{...item.asset,name:title.trim(),description}:undefined}:item)}));
   toast('已提交审核，通过后将在共创社区显示');onClose();
  }catch(e){setError(e instanceof Error?e.message:'提交失败，请重试。');}
 };
 const category=work?projectCategories.find(c=>c.id===getProjectCategory(work))?.label:undefined;
 const counts=work?.kind==='story'?`${work.storyNodes?.length||0} 个节点 · ${work.storyEdges?.length||0} 条分支连线`:work?.kind==='video'?`${work.shots?.length||0} 个分镜 · 包含讲解文案`:work?`${work.pages.length} 个页面 · ${work.pages.reduce((n,p)=>n+p.nodes.length,0)} 个可编辑组件`:`${asset?.package?.files.length||1} 个关联文件 · ${asset?.package?.skillIds.length||0} 个技能`;
 return <Modal open onClose={onClose} title="提交到共创社区" description="每次投稿会保存一个独立快照，不影响你继续编辑。" footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={submit}>提交审核</Button></>}><div className="res-form"><label>投稿标题<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80}/></label><label>资源分类<div className="res-input-readonly">{work?`展项模板 / ${category}`:`展项素材 / ${typeLabels[asset?.kind||'image']}`}</div></label>{work&&<><div className="res-field"><span>展示内容 · 可多选</span><small className="res-muted">交互页面投稿时，展示内容与展示形式至少填写一项。</small><div className="community-purpose-select" role="group" aria-label="展示内容">{contentPurposes.map(p=><button key={p.id} type="button" title={p.description} aria-pressed={purposes.includes(p.id)} onClick={()=>setPurposes(previous=>previous.includes(p.id)?previous.filter(id=>id!==p.id):[...previous,p.id])}>{p.label}</button>)}</div></div>{work.kind==='exhibit'&&<label>展示形式<select aria-label="展示形式" value={form} onChange={e=>setForm(e.target.value as Work['type'])}><option value="">无</option>{exhibitTypes.map(type=><option key={type}>{type}</option>)}</select></label>}</>}<label>用途说明<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="res-submission-preview">{work?<Artwork work={work}/>:asset?<AssetPreview asset={asset}/>:null}<div><strong>包含当前版本的完整内容</strong><p>{counts}</p></div></div><p className="res-muted">制作经验、整理历史和内部参考说明默认保留在当前空间，不随本次投稿公开。</p><label className="res-checkbox"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>已检查内容、封面和素材使用范围，允许团队复用此版本</label>{error&&<p className="res-error" role="alert">{error}</p>}</div></Modal>;
}

export function AssetDetails({asset:initialAsset,onClose,community=false}:{asset:Asset;onClose:()=>void;community?:boolean}) {
 const [tab,setTab]=useState('preview');
 const [metadataVisited,setMetadataVisited]=useState(false);
 const [leaveOpen,setLeaveOpen]=useState(false);
 const metadataEditor=useRef<AssetMetadataPanelHandle>(null);
 const pendingAction=useRef<(()=>void)|null>(null);
 const [target,setTarget]=useState('');
 const [destination,setDestination]=useState<'existing'|'new'>('existing');
 const [newProject,setNewProject]=useState<NewAssetProject>({title:initialAsset.name.slice(0,60),resolution:'1920×1080',width:1920,height:1080});
 const [insertError,setInsertError]=useState('');
 const [mode,setMode]=useState<'insert'|'background'|null>(null);
 const [submitting,setSubmitting]=useState(false);
 const [state,setState]=useState('待机');
 const currentAsset=useStudio(s=>s.assets.find(item=>item.id===initialAsset.id));
 const asset=currentAsset||initialAsset;
 const allWorks=useStudio(s=>s.works);
 const workspaceId=useStudio(s=>s.activeWorkspaceId);
 const works=allWorks.filter(w=>w.kind==='exhibit'&&workAvailableInSpace(w,workspaceId));
 const editableWork=!community&&!asset.public?allWorks.find(w=>w.id===asset.sourceWorkId):undefined;
 const materialWork=assetPreviewWork(asset,allWorks);
 const editable=useStudio(s=>workspaceCanEdit(s,workspaceId));
 const canInsert=editable&&assetCanInsert(asset)&&!asset.deletedAt;
 const navigate=useNavigate();
 const changeTab=(value:string)=>{if(value==='metadata')setMetadataVisited(true);setTab(value);};
 const guardExit=(action:()=>void)=>{
  if(metadataEditor.current?.isDirty()){pendingAction.current=action;setLeaveOpen(true);return;}
  action();
 };
 const continueMetadata=()=>{pendingAction.current=null;setLeaveOpen(false);changeTab('metadata');};
 const finishLeave=(save:boolean)=>{
  if(save&&!metadataEditor.current?.save()){continueMetadata();return;}
  if(!save)metadataEditor.current?.discard();
  const action=pendingAction.current;pendingAction.current=null;setLeaveOpen(false);action?.();
 };
 const reuse=()=>{
  const latest=useStudio.getState().assets.find(item=>item.id===asset.id)||asset;
  const draft=useStudio.getState().referenceAsset(latest);
  if(!draft){toast(useStudio.getState().creationError||'资料包有缺项，请先查看创作资料',true);setTab('package');return;}
  onClose();navigate('/');toast('创作资料已带入，新需求草稿已准备好');
 };
 const insert=()=>{
  if(!canInsert)return;
  setInsertError('');
  try{
   const studio=useStudio.getState();
   let work:Work;
   if(destination==='new'){
    const [width,height]=newProject.resolution==='custom'?[newProject.width,newProject.height]:newProject.resolution.split('×').map(Number);
    if(!newProject.title.trim())throw new Error('请填写作品名称');
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<320||width>16384||height>16384)throw new Error('宽高需为 320–16384 之间的整数');
    work={...createSceneWork({title:newProject.title.trim(),type:'卡片浏览型',width,height,styleId:'',kind:'exhibit',blank:true}),workspaceId:studio.activeWorkspaceId,displayForm:null,contentPurposes:[]};
   }else{
    const existing=studio.works.find(item=>item.id===target&&item.kind==='exhibit'&&workAvailableInSpace(item,studio.activeWorkspaceId));
    if(!existing)throw new Error('请选择当前空间中可编辑的作品');
    work=existing;
   }
   if(!work.pages[0])throw new Error('目标作品没有页面');
   const selected=studio.adoptAsset(asset.id,work.workspaceId||'personal');
   if(!selected)throw new Error(useStudio.getState().creationError||'暂时无法使用这份素材，请检查素材的归属和状态');
   const updated={...work,pages:work.pages.map((page,index)=>index===0?mode==='background'?{...page,backgroundImage:selected.src,backgroundAssetId:selected.id}:{...page,nodes:[...page.nodes,assetNode(selected,work)]}:page)};
   studio.saveWork(updated);onClose();navigate(workRoute(updated));toast(destination==='new'?'作品已创建，素材已添加到画布':mode==='background'?'已设为页面背景':'素材已插入画布');
  }catch(error){setInsertError(error instanceof Error?error.message:'素材添加失败，请重试');}
 };
 const addToLibrary=()=>{
  const id=useStudio.getState().copyAssetToLibrary(asset.id);
  if(!id){toast(useStudio.getState().creationError||'暂时无法复用这份素材，请刷新后重试',true);return;}
  onClose();navigate(`/library?asset=${encodeURIComponent(id)}`);toast('已添加到素材库');
 };
 const continueEditing=()=>{
  if(!editableWork||editableWork.deletedAt)return;
  onClose();navigate(workRoute(editableWork));
 };
 const restore=()=>{
  if(!editableWork||!useStudio.getState().restoreWork(editableWork.id)){toast('恢复失败，请刷新后重试',true);return;}
  onClose();navigate(`/library?asset=${encodeURIComponent(asset.id)}`);toast('素材已恢复');
 };
 const footer=mode?<><Button variant="secondary" onClick={()=>setMode(null)}>返回素材</Button><Button variant="primary" disabled={destination==='existing'&&!target} onClick={()=>guardExit(insert)}>{destination==='new'?'创建并插入画布':'添加并打开画布'}</Button></>:asset.deletedAt?<><Button variant="secondary" onClick={()=>guardExit(onClose)}>关闭</Button><Button variant="primary" onClick={restore} disabled={!editableWork}>恢复素材</Button></>:<>
  <Button variant="secondary" onClick={()=>guardExit(community?addToLibrary:()=>setSubmitting(true))}>{community?'加入素材库':'提交社区'}</Button>
  {!community&&<GeneratedComponentPackageDownload asset={asset}/>}
  {!community&&canInsert&&<Button variant="secondary" onClick={()=>setMode('insert')}>插入画布</Button>}
  <Button variant={editableWork?'secondary':'primary'} onClick={()=>guardExit(reuse)} disabled={!editable||!asset.package?.complete}><Sparkles size={15}/>一键同款</Button>
  {editableWork&&<Button variant="primary" onClick={()=>guardExit(continueEditing)}>继续编辑<ArrowUpRight size={15}/></Button>}
 </>;
 return <><Modal open onClose={()=>guardExit(onClose)} title={asset.name} wide footer={footer}>
  <div className="res-detail-topline"><span><Avatar name={asset.author}/>{asset.author}</span><span>{sourceLabels[asset.source]} · {formatDate(asset.updatedAt||asset.createdAt)}</span><FavoriteButton id={asset.id}/></div>
  {asset.deletedAt&&<p className="res-material-lifecycle">此素材已移入回收站，恢复后可继续编辑原工程。</p>}
  {mode?<AssetInsertTarget destination={destination} onDestination={value=>{setDestination(value);setInsertError('');}} works={works} target={target} onTarget={value=>{setTarget(value);setInsertError('');}} project={newProject} onProject={value=>{setNewProject(value);setInsertError('');}} error={insertError}/>:<>
   <Tabs value={tab} onChange={changeTab} items={[{value:'preview',label:'效果预览'},{value:'metadata',label:'素材信息'},{value:'package',label:`创作资料${asset.package?` (${asset.package.files.length})`:''}`},{value:'usage',label:'使用说明'}]}/>
   <div className="res-detail-body" hidden={tab==='metadata'}>{tab==='preview'?<>
    <AssetPreview asset={asset} large/>
    <div className="res-inline-tags"><CatalogComponentActions asset={asset}/></div>
    {asset.componentImport && <div className="component-import-badge"><strong>{asset.componentImport.runtime === 'parameters-connected' ? '已保留试编辑配置' : '已完成导入预览'}</strong> · {asset.componentImport.source === 'package' ? '来自组件 ZIP' : '来自 HTML 文件'} · 离线能力未验证{asset.componentImport.fields.length > 0 && <div>导入时开放参数：{asset.componentImport.fields.map(field => field.label).join('、')}。画布中以当前配置嵌入运行。</div>}</div>}
    {asset.kind==='component'&&asset.componentType==='bubble'&&<div className="res-component-play"><span>体验组件状态</span>{['待机','聆听','思考','播报'].map(x=><button className={x===state?'active':''} onClick={()=>setState(x)} key={x}>{x}</button>)}<span className={`res-state-orb state-${state}`}>{state==='播报'?'你好，欢迎来到我们的展厅。':state==='聆听'?'正在聆听…':state==='思考'?'正在组织回答…':'准备好开始对话'}</span></div>}
    {(asset.kind==='component'||asset.kind==='html')&&<div className="asset-capability-note"><Info size={15}/><span>{asset.kind==='component'&&canInsert?<><strong>已适配组件</strong> · 可编辑已开放的属性。生成其他新交互形式仍需要开发适配。</>:asset.kind==='html'?<><strong>嵌入式组件</strong> · 可在画布调整位置与尺寸，内部元素不会自动拆分。</>:<><strong>待适配组件</strong> · 可以查看效果与资料，接入组件规范后才能原生编辑。</>}</span></div>}
    <p>{asset.description}</p><div className="res-inline-tags">{asset.tags.map(tag=><Badge key={tag}>{tag}</Badge>)}</div>
    {asset.kind==='image'&&!community&&canInsert&&<Button variant="secondary" onClick={()=>setMode('background')}><ImageIcon size={15}/>设为背景</Button>}
   </>:tab==='metadata'?null:tab==='package'?<PackageContents asset={asset}/>:<div className="res-prose"><h3>把制作方法一起复用</h3><p>点击“一键同款”，成品预览、关联文件、提示词、Skill 与生成参数会一起成为新的创作参考。回到首页后描述你要改变的主题、风格或比例，再开始生成。</p><h4>可编辑范围</h4><p>{materialWork?.kind==='presentation'?'演示作品保留页面内容、布局与讲稿，可从作品列表继续编辑同一份工程。社区模板通过快速复用创建独立作品副本。':materialWork?.kind==='video'?'视频作品保留分镜画面、文案与时长，可从作品列表进入视频编辑器。社区模板通过快速复用创建独立作品副本；完整视频合成为演示能力。':asset.kind==='component'?canInsert?'已适配组件可插入画布，编辑其开放的内容、外观与交互属性。全新组件需要开发适配后才能原生编辑。':'此组件尚未适配画布属性与事件，只提供效果和资料预览。':asset.kind==='html'?'HTML 程序在隔离环境中运行。可以调整外层位置与尺寸，内部元素不会自动转换为原生可编辑组件。':'媒体可在画布中移动、缩放、替换；成品中的像素元素不会自动拆分。'}</p><h4>来源与版本</h4><p>{asset.author} · {asset.package?`创作资料包 v${asset.package.version}`:'成品资产'}。社区发布版本与个人草稿相互独立。</p></div>}</div>
  </>}
  {metadataVisited&&<div className="res-detail-body" hidden={tab!=='metadata'||mode!==null}><AssetMetadataPanel ref={metadataEditor} asset={asset} readOnly={!workspaceCanEdit(useStudio.getState(),asset.workspaceId||'personal')||community||Boolean(asset.public)||asset.source==='builtin'||(asset.workspaceId||'personal')!==workspaceId||Boolean(asset.deletedAt)}/></div>}
 </Modal>{submitting&&<SubmissionDialog asset={asset} onClose={()=>setSubmitting(false)}/>}
 <Modal open={leaveOpen} onClose={continueMetadata} title="保存素材信息？" description="业务说明有尚未保存的修改。" footer={<><Button variant="secondary" onClick={continueMetadata}>继续编辑</Button><Button variant="ghost" onClick={()=>finishLeave(false)}>放弃修改</Button><Button variant="primary" onClick={()=>finishLeave(true)}>保存并继续</Button></>}><p className="res-muted">保存后继续当前操作，或放弃本次修改。已保存的信息不会丢失。</p></Modal></>;
}
