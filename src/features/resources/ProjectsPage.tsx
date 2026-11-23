import {MoveWorkDialog} from '../workspace/MoveWorkDialog';
import {appendReferenceToDraft} from '../../domain/exhibit-references';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArchiveRestore, ArrowUpRight, Copy, Grid2X2, List, MoreHorizontal, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useStudio } from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {ProjectCategoryFilter,ProjectDetailFilters} from './ProjectFilters';
import { contentPurposes, getProjectCategory, getWorkPurposes, getWorkDisplayForm, projectCategories } from '../../domain/project-taxonomy';
import type { Work } from '../../domain/types';
import { Artwork } from '../../components/Artwork';
import { Button, EmptyState, Menu, Modal, PageHeader, SearchInput, toast } from '../../components/ui';
import { filterWorks, formatDate, workRoute } from './helpers';
import { Avatar, SubmissionDialog } from './Shared';
import { DeleteWorkDialog } from '../workspace/DeleteWorkDialog';
import '../../styles/workspace-lifecycle.css';
import '../../styles/v14-navigation.css';

type ProjectTab = 'active' | 'trash';

export function ProjectsPage() {
 const state=useStudio(),navigate=useNavigate();
 const [params,setParams]=useSearchParams();
 const updateFilters=(values:Record<string,string|null>)=>{const next=new URLSearchParams(params);for(const [key,value] of Object.entries(values)){if(value)next.set(key,value);else next.delete(key);}setParams(next,{replace:true});};
 const query=params.get('q')||'',type=params.get('form')||'全部',purpose=params.get('purpose')||'all';
 const time=params.get('time')||'全部时间',sort=params.get('sort')||'recent',view=params.get('view')||'grid';
 const tab:ProjectTab=params.get('status')==='trash'?'trash':'active';
 const setQuery=(value:string)=>updateFilters({q:value}),setType=(value:string)=>updateFilters({form:value==='全部'?null:value}),setPurpose=(value:string)=>updateFilters({purpose:value==='all'?null:value});
 const setTime=(value:string)=>updateFilters({time:value==='全部时间'?null:value}),setSort=(value:string)=>updateFilters({sort:value==='recent'?null:value}),setView=(value:string)=>updateFilters({view:value==='grid'?null:value});
 const newProject=()=>{const next=new URLSearchParams(params);next.set('new','1');setParams(next,{replace:true});};
 const [moving,setMoving]=useState<Work|null>(null);
 const [rename,setRename]=useState<Work|null>(null),[name,setName]=useState('');
 const [submission,setSubmission]=useState<Work|null>(null),[remove,setRemove]=useState<Work|null>(null);
 const category=projectCategories.some(item=>item.id===params.get('category'))?params.get('category')!:'all';
 const spaceId=state.activeWorkspaceId||'personal';
 const editable=workspaceCanEdit(state,spaceId),workspaces=state.workspaces;
 const space=workspaces.find(item=>item.id===spaceId)||workspaces[0];
 const spaceWorks=state.works.filter(work=>(work.workspaceId||'personal')===spaceId);
 const trashed=spaceWorks.filter(work=>Boolean(work.deletedAt));
 const candidates=(tab==='trash'?trashed:spaceWorks.filter(work=>!work.deletedAt))
  .filter(work=>(category==='all'||getProjectCategory(work)===category)&&(purpose==='all'||getWorkPurposes(work).includes(purpose)))
  .map(work=>({...work,archived:false}));
 const works=filterWorks(candidates,{query,type:category==='interactive'?type:'全部',time,sort,archived:false});
 const changeCategory=(value:string)=>updateFilters({category:value==='all'?null:value,form:null});
 const clearFilters=()=>updateFilters({q:null,form:null,purpose:null,time:null,category:null});
 const filtered=Boolean(query||category!=='all'||purpose!=='all'||type!=='全部'||time!=='全部时间');
 const changeTab=(next:ProjectTab)=>updateFilters({status:next==='trash'?'trash':null});
 const saveRename=()=>{
  if(!rename||!name.trim())return;
  const latest=useStudio.getState().works.find(work=>work.id===rename.id&&!work.deletedAt);
  if(!latest){setRename(null);return;}
  try{state.saveWork({...latest,title:name.trim()});setRename(null);toast('作品名称已更新');}
  catch(error){toast(error instanceof Error?error.message:'无法保存作品名称，请重试',true);}
 };
 const restore=(work:Work)=>{if(state.restoreWork(work.id))toast('作品已恢复');};

 return <div className="res-page">
  <PageHeader title={spaceId==='personal'?'我的作品':space.name} description={`管理${space.name}中的交互页面、智能演示、互动影片。每个作品保留完整的创作工程。`}>
   <Button variant="primary" disabled={!editable} onClick={newProject}><Plus size={16}/>新建作品</Button>
  </PageHeader>
  <div className="res-page-tabs">
   <button className={tab==='active'?'active':''} onClick={()=>changeTab('active')}>全部作品 <span>{spaceWorks.filter(work=>!work.deletedAt).length}</span></button>
   <button className={`lifecycle-trash-tab ${tab==='trash'?'active':''}`} onClick={()=>changeTab('trash')}><Trash2 size={14}/>回收站{trashed.length>0&&<span>{trashed.length}</span>}</button>
  </div>
  <ProjectCategoryFilter value={category} onChange={changeCategory} testId="project-category-filter"/>
  <div className="res-toolbar project-toolbar-v14">
   <SearchInput value={query} onChange={setQuery} placeholder="搜索作品名称"/>
   <ProjectDetailFilters category={category} purpose={purpose} form={type==='全部'?'':type} onPurpose={setPurpose} onForm={value=>setType(value||'全部')}/>
   <select aria-label="按时间筛选" value={time} onChange={event=>setTime(event.target.value)}>{['全部时间','最近7天','最近30天'].map(item=><option key={item}>{item}</option>)}</select>
   <span className="res-toolbar-spacer"/><span className="res-result-count">{works.length} 件作品</span>
   <select aria-label="作品排序" value={sort} onChange={event=>setSort(event.target.value)}><option value="recent">最近编辑</option><option value="name">名称排序</option></select>
   <div className="res-view-switch"><button aria-label="网格视图" className={view==='grid'?'active':''} onClick={()=>setView('grid')}><Grid2X2 size={17}/></button><button aria-label="列表视图" className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={17}/></button></div>
  </div>
  {filtered&&<div className="community-active-filters">{purpose!=='all'&&<button aria-label="移除展示内容筛选" onClick={()=>setPurpose('all')}>{contentPurposes.find(p=>p.id===purpose)?.label} ×</button>}{category==='interactive'&&type!=='全部'&&<button aria-label="移除展示形式筛选" onClick={()=>setType('全部')}>{type==='none'?'未分类':type} ×</button>}<button className="clear" onClick={clearFilters}>清除筛选</button></div>}
  {tab==='trash'&&<p className="lifecycle-trash-note">已删除的作品保留在这里。恢复后，内容、页面和素材引用都会保留。</p>}
  {!works.length?<EmptyState title={filtered?'没有找到相关作品':tab==='trash'?'回收站是空的':'从第一件作品开始'} description={filtered?'试试其他名称或分类，也可以清除筛选条件。':tab==='trash'?'从最近草稿或作品列表删除的作品会出现在这里。':'选择一种创作方式，或从社区模板获得灵感。'} action={filtered?undefined:tab==='active'&&editable?<Button onClick={newProject}>新建作品</Button>:undefined}/>:<div className={`res-projects ${view==='list'?'list-view':'res-grid'}`}>
   {works.map((work,index)=><ProjectCard key={work.id} index={index} work={work} removed={tab==='trash'} onRename={()=>{setRename(work);setName(work.title);}} onSubmit={()=>setSubmission(work)} onMove={()=>setMoving(work)} onDelete={()=>setRemove(work)} onRestore={()=>restore(spaceWorks.find(item=>item.id===work.id)!)}/>)}
  </div>}
  {rename&&<Modal open onClose={()=>setRename(null)} title="重命名作品" footer={<><Button onClick={()=>setRename(null)}>取消</Button><Button variant="primary" disabled={!name.trim()} onClick={saveRename}>保存名称</Button></>}><label className="res-field">作品名称<input autoFocus value={name} maxLength={80} onChange={event=>setName(event.target.value)} onKeyDown={event=>event.key==='Enter'&&!event.nativeEvent.isComposing&&saveRename()}/></label></Modal>}
  {submission&&<SubmissionDialog work={submission} onClose={()=>setSubmission(null)}/>}
  {moving&&<MoveWorkDialog work={moving} onClose={()=>setMoving(null)} onMoved={()=>navigate('/projects')}/>}
  <DeleteWorkDialog work={remove} onClose={()=>setRemove(null)}/>
 </div>;
}

type ProjectCardProps={index:number;work:Work;removed:boolean;onRename:()=>void;onSubmit:()=>void;onDelete:()=>void;onRestore:()=>void;onMove:()=>void};
function ProjectCard({index,work,removed,onRename,onSubmit,onDelete,onRestore,onMove}:ProjectCardProps) {
 const state=useStudio(),navigate=useNavigate();
 const editable=workspaceCanEdit(state,work.workspaceId||'personal');
 const destination=editable?workRoute(work):`/preview/${work.id}`;
 const category=projectCategories.find(item=>item.id===getProjectCategory(work))!;
 const description=work.kind==='exhibit'?(getWorkDisplayForm(work)||'未分类'):work.kind==='presentation'?'讲解演示':work.kind==='video'?'视频创作':'节点剧情';
 const purposeLabels=getWorkPurposes(work).map(id=>contentPurposes.find(item=>item.id===id)?.label).filter(Boolean).slice(0,2);
 const cover=<><Artwork work={work}/>{!removed&&<span className="res-cover-action">{editable?'继续编辑':'预览作品'} <ArrowUpRight size={16}/></span>}<span className="res-cover-badge">{category.label}</span></>;
 const actions=editable?[
  {label:'继续编辑',icon:<Pencil size={15}/>,onClick:()=>navigate(destination)},
  {label:'预览作品',icon:<ArrowUpRight size={15}/>,onClick:()=>navigate(`/preview/${work.id}`)},
  {label:'重命名',onClick:onRename},
  {label:'复制作品',icon:<Copy size={15}/>,onClick:()=>{if(state.duplicateWork(work.id))toast('已创建独立副本');}},
  {label:'参考此展项创作',icon:<Copy size={15}/>,onClick:()=>{try{appendReferenceToDraft('work',work.id);navigate('/');toast('已加入当前创作参考，可继续添加其他展项');}catch(error){toast(error instanceof Error?error.message:'无法添加参考',true);}}},
  ...((work.workspaceId||'personal')==='personal'?[{label:'移动到项目空间',onClick:onMove}]:[]),
  {label:'提交到共创社区',icon:<Share2 size={15}/>,onClick:onSubmit},
  {label:'删除作品',icon:<Trash2 size={15}/>,danger:true,onClick:onDelete},
 ]:[{label:'预览作品',icon:<ArrowUpRight size={15}/>,onClick:()=>navigate(destination)}];
 const count=work.kind==='story'?`${work.storyNodes?.length||0} 个节点`:work.kind==='video'?`${work.shots?.length||0} 个分镜`:`${work.pages.length} 个页面`;
 return <motion.article className={`res-card res-project-card ${removed?'lifecycle-trash-card':''}`} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.22,delay:Math.min(index,8)*0.025,ease:[0.22,1,0.36,1]}}>
  {removed?<div className="res-cover-button">{cover}</div>:<button className="res-cover-button" onClick={()=>navigate(destination)} aria-label={`打开${work.title}`}>{cover}</button>}
  <div className="res-card-body"><div className="res-card-title-row">{removed?<h3>{work.title}</h3>:<button className="res-text-link" onClick={()=>navigate(destination)}><h3>{work.title}</h3></button>}{!removed&&<Menu trigger={<button className="res-icon-button" aria-label={`${work.title}更多操作`}><MoreHorizontal size={18}/></button>} items={actions}/>}</div>
   <p className="res-card-description">{description} <span>·</span> {work.width} × {work.height}{purposeLabels.length>0&&<span className="project-work-purpose">{purposeLabels.join(' · ')}</span>}</p>
   <div className="res-card-footer">{removed?<><small className="lifecycle-removed-date">{formatDate(work.deletedAt!)} 移入回收站</small><Button size="sm" disabled={!editable} onClick={onRestore}><ArchiveRestore size={14}/>恢复作品</Button></>:<><span><Avatar name="纪鸣"/>纪鸣</span><small>{formatDate(work.updatedAt)} 编辑 · {count}</small></>}</div>
  </div>
 </motion.article>;
}
