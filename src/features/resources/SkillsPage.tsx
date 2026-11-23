import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { set } from 'idb-keyval';
import { ArrowUpRight, FileArchive, LoaderCircle, Plus, WandSparkles } from 'lucide-react';
import { useStudio } from '../../domain/store';
import {skillAvailableToActor,skillActorAccount} from '../../domain/skill-access';
import {createSkillDraft,getSkillMetadata} from '../../domain/skill-metadata';
import type { Skill } from '../../domain/types';
import { createExampleSkillPackage, parseSkillPackage, skillPackageLimits, type ImportedSkill } from '../../domain/skill-package';
import { Badge, Button, Modal, PageHeader, SearchInput, Tabs, downloadBlob, toast } from '../../components/ui';
import { SkillPreview, PackageFiles, SkillGrid, SkillDetails, SkillEditor } from './SkillResources';
import '../../styles/skill-package.css';
import '../../styles/resources-v15.css';

export function SkillsPage() {
 const state = useStudio(), navigate = useNavigate();
 const [params,setParams]=useSearchParams();
 const [query, setQuery] = useState(''), [tab, setTab] = useState('all');
 const [source,setSource]=useState('all');
 const [newSkill,setNewSkill]=useState<Skill|null>(null);
 const beginCreate=()=>{const ownerAccount=skillActorAccount(useStudio.getState());if(!ownerAccount){toast('当前身份无法创建技能',true);return;}setNewSkill(createSkillDraft({ownerAccount}));};
 const [selected, setSelected] = useState<Skill | null>(null);
 const selectedSkill=state.skills.find(s=>s.id===selected?.id);
 const detailSkill=(selectedSkill&&skillAvailableToActor(selectedSkill,state)?selectedSkill:null)||state.skills.find(s=>s.personal&&skillAvailableToActor(s,state)&&s.id===params.get('skill'));
 const closeDetail=()=>{setSelected(null);if(params.has('skill')){const next=new URLSearchParams(params);next.delete('skill');setParams(next,{replace:true});}};
 const [upload, setUpload] = useState(false), [candidate, setCandidate] = useState<ImportedSkill | null>(null);
 const [error, setError] = useState(''), [filename, setFilename] = useState(''), [busy, setBusy] = useState(false);
 const fileInput = useRef<HTMLInputElement>(null), sourceFile = useRef<File | null>(null), parseToken = useRef(0);
 const personal=state.skills.filter(s=>s.personal&&!s.public&&skillAvailableToActor(s,state));
 const skills=personal.filter(s=>(tab==='all'||state.favorites.includes(s.id))&&(source==='all'||(s.source||(s.origin?'community':'uploaded'))===source)&&`${s.name}${s.description}${s.category}`.toLowerCase().includes(query.toLowerCase()));
 const beginUpload=()=>{setUpload(true);setCandidate(null);setError('');setFilename('');sourceFile.current=null;};
 const readSkill = async (file?: File) => {
  if (!file) return;
  const token = ++parseToken.current;
  setError(''); setCandidate(null); setFilename(file.name); setBusy(true); sourceFile.current = null;
  try {
   if (file.size > skillPackageLimits.compressedBytes) throw new Error('技能 ZIP 请控制在 10 MB 以内。');
   const parsed = await parseSkillPackage(new Uint8Array(await file.arrayBuffer()), file.name);
   if (token === parseToken.current) { setCandidate(parsed); sourceFile.current = file; }
  } catch (e) { if (token === parseToken.current) setError(e instanceof Error ? e.message : '无法读取技能包，请重试。'); }
  finally { if (token === parseToken.current) setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
 };
 const add = async () => {
  if (!candidate || !sourceFile.current || busy) return;
  setBusy(true); setError('');
  try {
   const storageKey = `zhichuang-skill-package:${candidate.id}`;
   await set(storageKey, sourceFile.current);
   state.addSkill({ ...candidate, metadata:{...getSkillMetadata(candidate),ownerAccount:skillActorAccount(useStudio.getState())||'',visibility:'private',allowedWorkspaceIds:[]},enabled:true, workspaceId:'personal', source:'uploaded', sourcePackage: { ...candidate.sourcePackage, storageKey } });
   setUpload(false); setTab('all');setSource('uploaded'); setCandidate(null); sourceFile.current = null; toast('技能与原始 ZIP 已保存到可用技能库，当前仅本人可见');
  } catch { setError('无法保存技能包，浏览器存储空间可能不足。请重试。'); }
  finally { setBusy(false); }
 };
 const example = async () => {
  try { const bytes = await createExampleSkillPackage(); downloadBlob(new Blob([bytes as BlobPart], { type: 'application/zip' }), '企业时间轴编排.skill.zip'); }
  catch { toast('示例技能包生成失败，请重试', true); }
 };
 return <div className="res-page">
  <PageHeader title="Skills" description="跨空间管理可用技能，方法版本与权限分别记录。"><Button onClick={()=>navigate('/community?tab=skills')}>从社区添加 <ArrowUpRight size={15}/></Button><Button onClick={beginUpload}><Plus size={16} />上传技能</Button><Button variant="primary" onClick={beginCreate}><Plus size={16}/>新建技能</Button></PageHeader>
  <div className="res-skill-intro"><div className="res-skill-intro-icon"><WandSparkles size={24} /></div><div><strong>从想法到成品，多一点拿手好戏</strong><p>为智能体装上组件制作、风格生成与版式编排能力。启用后，Agent 会根据任务自动调用所需技能。</p></div><span className="res-skill-count">{personal.length}<small>个可用技能</small></span></div>
  <p className="skill-library-note">技能可跨空间使用；私有草稿仅本人可见，原项目空间技能保留原有成员访问范围。客户资料和授权由任务所属空间管理。</p>
  <Tabs glass value={tab} onChange={setTab} items={[{value:'all',label:'全部技能'},{value:'favorites',label:'我的收藏'}]}/>
  <div className="res-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="搜索技能名称、用途或分类"/><select aria-label="技能来源" value={source} onChange={e=>setSource(e.target.value)}><option value="all">全部来源</option><option value="uploaded">本地上传</option><option value="community">社区添加</option><option value="builtin">平台预置</option></select><span className="res-toolbar-spacer"/><span className="res-result-count">{skills.length} 个技能</span></div>
  <SkillGrid skills={skills} onSelect={setSelected}/>
  {detailSkill&&<SkillDetails skill={detailSkill} onClose={closeDetail}/>}
  {newSkill&&<SkillEditor skill={newSkill} newSkill onClose={()=>setNewSkill(null)}/>}
  <Modal open={upload} onClose={() => !busy && setUpload(false)} title="添加你的技能" description="导入技能说明、参考资料和资源，让完整的创作方法可以复用。" wide footer={<><Button variant="secondary" onClick={() => void example()} disabled={busy}>下载示例 ZIP</Button><Button variant="primary" disabled={!candidate || busy} onClick={() => void add()}>{busy ? <LoaderCircle size={15} className="spinner" /> : <Plus size={15} />}添加技能</Button></>}>
   <input type="file" accept=".zip,application/zip,application/x-zip-compressed" aria-label="上传 ZIP 技能包" ref={fileInput} className="res-sr-only" onChange={e => void readSkill(e.target.files?.[0])} />
   <button className="res-upload-zone skill-upload-zone" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? <LoaderCircle size={28} className="spinner" /> : <FileArchive size={28} />}<strong>{busy ? '正在处理技能包…' : filename || '选择 ZIP 技能包'}</strong><span>包内包含 SKILL.md，支持参考资料与预览图 · 最大 10 MB</span></button>
   {error && <p className="res-error" role="alert">{error}</p>}
   {candidate && <div className="skill-import-details"><div className="skill-import-summary"><div className="skill-import-preview"><SkillPreview skill={candidate} /></div><div><Badge tone="green">格式检查通过</Badge><h3>{candidate.name}</h3><p>{candidate.description}</p><small>待导入技能 · v{candidate.version}</small><p className="res-muted">需要提供：{candidate.input}</p></div></div><PackageFiles skill={candidate} /></div>}
   <p className="res-muted">添加到可用技能库，初始仅本人可见，不自动共享。</p>
   <p className="res-muted skill-package-help">原始 ZIP 与资源将一并保存。未提供预览图时，使用技能类型示意预览。</p>
  </Modal>
 </div>;
}
