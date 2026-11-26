import {trackEditorNavigation} from './workspace/editor-return';
import {assetAvailableInSpace} from '../domain/asset-access';
import {skillAvailableInSpace} from '../domain/resource-sharing';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen, Plus, Search, FolderKanban, Images, Zap, LayoutTemplate, House, ChevronDown, LogOut, Settings2, ShieldCheck, RotateCcw, CheckCheck, ArrowUpRight, MessageSquare, Ellipsis, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import {deleteCreationSession,type CreationSession} from '../domain/creation-session';
import { useStudio } from '../domain/store';
import type { ComposerDraft, Work } from '../domain/types';
import { Logo, Button, Menu, Modal, SearchInput, Badge, toast } from '../components/ui';
import { Artwork } from '../components/Artwork';
import { AppearanceToggle } from '../components/AppearanceToggle';
import { NewExhibitDialog } from './NewExhibitDialog';
import { WorkspaceSwitch } from './workspace/WorkspaceSwitch';
import { DeleteWorkDialog } from './workspace/DeleteWorkDialog';
import {workspaceCanEdit} from '../domain/workspace-management';
import { isProjectWork } from '../domain/work-outputs';
import { isLibraryAsset } from '../domain/project-taxonomy';
import '../styles/workspace-lifecycle.css';

export function workRoute(work:Work){return work.kind==='story'?`/dream/${work.id}`:work.kind==='video'?`/video/${work.id}`:work.kind==='presentation'?`/presentations/${work.id}`:`/editor/${work.id}`}
const nav=[{to:'/',label:'首页',icon:House},{to:'/projects',label:'作品',icon:FolderKanban},{to:'/library',label:'素材库',icon:Images},{to:'/skills',label:'Skills',icon:Zap},{to:'/community',label:'共创社区',icon:LayoutTemplate}];
export function AppShell(){
 const [collapsed,setCollapsed]=useState(()=>{const preference=localStorage.getItem('zc-sidebar');return preference===null?['','#/','#'].includes(window.location.hash.split('?')[0]):preference==='1';}),[newOpen,setNewOpen]=useState(false),[search,setSearch]=useState(false),[q,setQ]=useState(''),[searchIndex,setSearchIndex]=useState(0),[settings,setSettings]=useState(false),[reset,setReset]=useState(false),[draftTab,setDraftTab]=useState('work');
 const state=useStudio(),location=useLocation(),navigate=useNavigate(),[params,setParams]=useSearchParams();
 const [removeWork,setRemoveWork]=useState<Work|null>(null),[removeDraft,setRemoveDraft]=useState<ComposerDraft|null>(null);
 const [removeChat,setRemoveChat]=useState<CreationSession|null>(null);
 const spaceId=state.activeWorkspaceId||'personal';
 const editable=workspaceCanEdit(state,spaceId);
 const workspaces=state.workspaces;
 const space=workspaces.find(item=>item.id===spaceId)||workspaces[0];
 const belongs=(item:{workspaceId?:string})=>(item.workspaceId||'personal')===spaceId;
 const visibleWorks=state.works.filter(work=>belongs(work)&&!work.deletedAt);
 const runs=state.runs.filter(run=>belongs(run)&&(!run.workId||visibleWorks.some(work=>work.id===run.workId)));
 const drafts=state.drafts.filter(draft=>belongs(draft)&&(draft.text||draft.reference||draft.attachmentIds.length));
 useEffect(()=>{if(params.get('new')){setNewOpen(editable);const next=new URLSearchParams(params);next.delete('new');setParams(next,{replace:true,state:location.state})}},[params,setParams,location.state,editable]);

 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(v=>!v)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 const sessions=(state.creationSessions||[]).filter(belongs).slice(0,5);
 const confirmChatDeletion=()=>{
  if(!removeChat)return;
  try{
   deleteCreationSession(removeChat.id);
   if(location.pathname===`/create/${removeChat.id}`)navigate('/',{replace:true});
   setRemoveChat(null);
   toast('会话已删除');
  }catch(error){
   setRemoveChat(null);
   toast(error instanceof Error?error.message:'删除会话失败，请重试',true);
  }
 };
 const recent=[...visibleWorks].filter(w=>!w.archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,5);
 // Dialog creation closes before navigating; clear only cancelled home launches after navigation settles.
 const lastPath=useRef(location.pathname);
 useEffect(()=>{if(lastPath.current!==location.pathname){lastPath.current=location.pathname;setNewOpen(false);}},[location.pathname]);
 const closeNewProject=()=>{setNewOpen(false);setTimeout(()=>{if(window.location.hash==='#/')trackEditorNavigation('/');},0);};
 const active=(path:string)=>path==='/'?location.pathname==='/'||location.pathname.startsWith('/create'):path==='/projects'?['/projects','/presentations','/video','/dream'].some(prefix=>location.pathname.startsWith(prefix)):path==='/community'?location.pathname.startsWith('/community')||location.pathname.startsWith('/design-systems'):location.pathname.startsWith(path);
 const searchEntries=[...visibleWorks.filter(w=>!w.archived&&isProjectWork(w)).map(w=>({id:w.id,title:w.title,type:'作品',path:workRoute(w)})),...state.assets.filter(a=>isLibraryAsset(a)&&!a.deletedAt&&!a.archived&&assetAvailableInSpace(a,state.activeWorkspaceId)).map(a=>({id:a.id,title:a.name,type:'素材',path:a.public?`/community?tab=assets&q=${encodeURIComponent(a.name)}`:`/library?asset=${encodeURIComponent(a.id)}${a.workspaceId&&a.workspaceId!=='personal'?'&scope=shared':''}`})),...state.skills.filter(a=>skillAvailableInSpace(a,state.activeWorkspaceId,state)).map(a=>({id:a.id,title:a.name,type:'Skills',path:a.personal?`/skills?skill=${encodeURIComponent(a.id)}`:`/community?tab=skills&skill=${encodeURIComponent(a.id)}`})),...state.systems.map(a=>({id:a.id,title:a.name,type:'设计风格',path:`/design-systems/${a.id}`}))].filter(x=>!q||x.title.toLowerCase().includes(q.toLowerCase())).slice(0,12);
 const activeSearchIndex=searchEntries.length?Math.min(searchIndex,searchEntries.length-1):0;
 const searchGroups=['作品','素材','Skills','设计风格'].map(group=>({group,items:searchEntries.map((item,idx)=>({...item,idx})).filter(item=>item.type===group)})).filter(g=>g.items.length>0);
 const onSearchKeyDown=(e:React.KeyboardEvent)=>{if(!searchEntries.length)return;if(e.key==='ArrowDown'){e.preventDefault();setSearchIndex(i=>(i+1)%searchEntries.length);}else if(e.key==='ArrowUp'){e.preventDefault();setSearchIndex(i=>(i-1+searchEntries.length)%searchEntries.length);}else if(e.key==='Enter'){e.preventDefault();const hit=searchEntries[activeSearchIndex];if(hit){setSearch(false);navigate(hit.path);}}};
 return <div className={clsx('app-shell',collapsed&&'sidebar-collapsed')}><aside className="sidebar"><div className="sidebar-brand"><Link to="/" aria-label="智创首页"><Logo small={collapsed}/></Link><button className="sidebar-toggle" aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={()=>{setCollapsed(!collapsed);localStorage.setItem('zc-sidebar',collapsed?'0':'1')}}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button></div><WorkspaceSwitch/><Button className="new-exhibit" variant="primary" disabled={!editable} onClick={()=>setNewOpen(true)} title="新建作品"><Plus size={18}/><span>新建作品</span></Button><button className="sidebar-search" title="搜索 Cmd+K" onClick={()=>setSearch(true)}><Search size={18}/><span>搜索</span><kbd>⌘ K</kbd></button> <nav className="sidebar-nav">{[...nav,...(state.role==='reviewer'?[{to:'/admin',label:'管理中心',icon:ShieldCheck}]:[])].map(n=>{const isActive=active(n.to);return <Link to={n.to} key={n.to} className={clsx(isActive&&'active')} title={n.label}>{isActive&&<motion.span layoutId="sidebar-nav-active" className="sidebar-nav-active-bg" transition={{type:'spring',stiffness:420,damping:34,mass:0.7}} aria-hidden="true"/>}<n.icon size={18}/><span>{n.label}</span></Link>;})}</nav><div className="sidebar-recents">
 {!!sessions.length&&<><div className="recent-heading"><span>最近会话</span></div>{sessions.map(chat=>{
  const title=chat.draft.text.trim()||'未命名会话';
  return <div className="recent-entry" key={chat.id}>
   <Link className="recent-item" title={title} to={`/create/${chat.id}`}><MessageSquare size={15}/><span className="recent-title">{title.slice(0,25)}</span></Link>
   <button className="recent-delete" disabled={!editable} title="删除会话" aria-label={`删除会话：${title}`} onClick={()=>setRemoveChat(chat)}><Trash2 size={13}/></button>
  </div>;
 })}</>}
 <div className="recent-heading"><span>最近草稿</span><Menu trigger={<button aria-label="切换草稿类型"><Ellipsis size={16}/></button>} items={[{label:'创作文件',onClick:()=>setDraftTab('work')},{label:'未发送需求',onClick:()=>setDraftTab('draft')},{label:'创作任务',onClick:()=>setDraftTab('run')}]}/></div>
 {draftTab==='work'?recent.map(work=><div className="recent-entry" key={work.id}><Link to={workRoute(work)} className="recent-item" title={work.title}><span className="recent-thumb"><Artwork work={work}/></span><span>{work.title}</span></Link><button className="recent-delete" disabled={!editable} title="删除草稿" aria-label={`删除草稿：${work.title}`} onClick={()=>setRemoveWork(work)}><Trash2 size={13}/></button></div>)
 :draftTab==='run'?runs.map(run=><Link className="recent-item" key={run.id} to={`/create/${run.id}`}><MessageSquare size={15}/><span className="recent-title">{run.prompt.slice(0,20)}</span><Badge>{run.status==='complete'?'完成':run.status==='running'?'生成中':'待继续'}</Badge></Link>)
 :drafts.slice(0,6).map(draft=><div className="recent-entry" key={draft.id}><button className="recent-item" onClick={()=>{state.selectDraft(draft.id);navigate('/')}}><MessageSquare size={15}/><span>{draft.text.slice(0,20)||'素材同款需求'}</span></button><button className="recent-delete" disabled={!editable} title="删除需求草稿" aria-label={`删除需求草稿：${draft.text.slice(0,20)||'素材同款需求'}`} onClick={()=>setRemoveDraft(draft)}><Trash2 size={13}/></button></div>)}
 {(draftTab==='work'&&!recent.length||draftTab==='run'&&!runs.length||draftTab==='draft'&&!drafts.length)&&<p className="recent-empty">这个空间还没有{draftTab==='run'?'创作任务':draftTab==='draft'?'未发送需求':'创作草稿'}</p>}
 </div><div className="sidebar-footer"><AppearanceToggle/><div className="workspace-status"><span className="green-dot"/><span>{spaceId==='personal'?'个人创作空间':'项目协作空间'}</span><Badge>内测版</Badge></div><Menu trigger={<button className="account-button"><span className="avatar">纪</span><span><strong>纪鸣</strong><small>{state.role==='reviewer'?'管理员视角':'内容创作团队'}</small></span><ChevronDown size={15}/></button>} items={[{label:'演示说明与设置',icon:<Settings2/>,onClick:()=>setSettings(true)},{label:state.role==='creator'?'演示：切换到管理员':'演示：切换到创作者',icon:<ShieldCheck/>,onClick:()=>{state.setRole(state.role==='creator'?'reviewer':'creator');toast('演示身份已切换')}},...(state.role==='reviewer'?[{label:'管理中心',icon:<CheckCheck/>,onClick:()=>navigate('/admin')}]:[]),{label:'退出登录',icon:<LogOut/>,onClick:()=>{state.logout();navigate('/login')}}]}/></div></aside><main className="workspace-main">{state.workspaceRestoreNotice&&<div className="workspace-readonly-notice" role="status">{state.workspaceRestoreNotice}<button onClick={()=>useStudio.setState({workspaceRestoreNotice:undefined})}>知道了</button></div>}{!editable&&<div className="workspace-readonly-notice" role="status">{space.archivedAt?'已归档 · 当前项目空间只读，可浏览和预览作品':'查看者 · 当前项目空间只读，可浏览和预览作品'}</div>}<Outlet/></main>
 <Modal open={!!removeChat} onClose={()=>setRemoveChat(null)} title="删除这段会话？" description="对话记录和未发送的回复将被删除。已创建的任务、作品和素材会保留。" footer={<><Button onClick={()=>setRemoveChat(null)}>取消</Button><Button variant="danger" onClick={confirmChatDeletion}>删除会话</Button></>}>
  <p className="recent-chat-delete-title">{removeChat?.draft.text.slice(0,100)||'未命名会话'}</p>
 </Modal>
 <DeleteWorkDialog work={removeWork} onClose={()=>setRemoveWork(null)} onDeleted={()=>{if(state.runs.some(run=>run.workId===removeWork?.id&&location.pathname===`/create/${run.id}`))navigate('/projects')}}/>
 <Modal open={Boolean(removeDraft)} onClose={()=>setRemoveDraft(null)} title="删除未发送的需求？" footer={<><Button onClick={()=>setRemoveDraft(null)}>取消</Button><Button variant="danger" onClick={()=>{if(removeDraft)state.deleteDraft(removeDraft.id);setRemoveDraft(null);toast('需求草稿已删除')}}>删除草稿</Button></>}><p className="lifecycle-description">这份尚未发送的需求将被删除，已生成的作品和素材会保留。</p><p className="lifecycle-delete-title">{removeDraft?.text.slice(0,100)||'素材同款需求'}</p></Modal>
 <NewExhibitDialog open={newOpen&&editable} onClose={closeNewProject}/>
 <Modal open={search} onClose={()=>setSearch(false)} title={`搜索${space.name}`} wide><div className="command-palette-wrap" onKeyDown={onSearchKeyDown}><SearchInput value={q} onChange={val=>{setQ(val);setSearchIndex(0);}} placeholder="搜索作品、素材、Skills 或设计风格…"/><div className="global-results" role="listbox" aria-label="搜索结果">{searchGroups.map(({group,items})=><div className="command-palette-group" key={group}><div className="command-palette-group-title">{group}</div>{items.map(x=><button key={x.type+x.id} role="option" aria-selected={x.idx===activeSearchIndex} className={clsx('command-palette-item',x.idx===activeSearchIndex&&'is-active')} onMouseEnter={()=>setSearchIndex(x.idx)} onClick={()=>{setSearch(false);navigate(x.path)}}><Search size={15}/><span>{x.title}</span><Badge>{x.type}</Badge><ArrowUpRight size={14}/></button>)}</div>)}{searchEntries.length===0&&<p>没有找到匹配内容，试试其他关键词。</p>}</div><div className="command-palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></Modal>
 <Modal open={settings} onClose={()=>setSettings(false)} title="关于这个创作空间" description="智创平台高保真产品 Demo"><div className="demo-notes"><p>展项编辑、内容修改、模板复用、资料包传递、审核状态、本地保存与浏览器运行包均可实际操作。</p><p>选择 DeepSeek 时会连接本机 AI 服务进行策划、编排与多轮修改，图片由万相生成。演示模式使用预置内容；视频合成、真人语音和多人在线协作仍为演示能力。播放器导出尚未连接真实设备。</p><p>数据存储在本浏览器。清理浏览器数据会清除本地作品；重要成果可导出工程或运行包。</p><div className="settings-row"><span>演示身份</span><select value={state.role} onChange={e=>state.setRole(e.target.value as 'creator'|'reviewer')}><option value="creator">创作者</option><option value="reviewer">管理员</option></select></div><Button variant="danger" disabled={!state.workspaces.every(space=>workspaceCanEdit(state,space.id))} onClick={()=>{setSettings(false);setReset(true)}}><RotateCcw/>重置演示数据</Button></div></Modal>
 <Modal open={reset} onClose={()=>setReset(false)} title="重置演示数据？" description="这将清除本浏览器中的创作记录并恢复初始样例。请先导出需要保留的作品。" footer={<><Button onClick={()=>setReset(false)}>取消</Button><Button variant="danger" onClick={()=>{try{state.resetDemo();setReset(false);navigate('/');toast('演示数据已恢复')}catch(error){toast(error instanceof Error?error.message:'暂时无法重置',true)}}}>确认重置</Button></>}><p className="muted">现有作品、生成资产、需求草稿与审核记录会被替换；本地上传文件、项目空间和成员设置保留。</p></Modal>
 </div>
}
