import {useState} from 'react';
import {get} from 'idb-keyval';
import {motion} from 'motion/react';
import {ArrowUpRight,Check,Download,FileText,Zap,Power,Plus} from 'lucide-react';
import {useStudio} from '../../domain/store';
import {skillVersion} from '../../domain/skill-publication';
import {getSkillMetadata,syncSkillPackage} from '../../domain/skill-metadata';
import {skillCanManage,skillAvailableToActor,skillActorAccount} from '../../domain/skill-access';
import {exportSkillPackage} from '../../domain/skill-package';
import {SkillMetadataForm,SkillMetadataDetails,prepareSkillForm} from './SkillMetadataForm';
import type {Skill} from '../../domain/types';
import {Artwork} from '../../components/Artwork';
import {Badge,Button,EmptyState,Modal,downloadBlob,toast} from '../../components/ui';
import {Avatar,FavoriteButton} from './Shared';
import '../../styles/skill-package.css';
import '../../styles/community-v14.css';

export function SkillPreview({skill}:{skill:Skill}) {
 const system=useStudio(s=>s.systems.find(item=>item.id===skill.styleId));
 if(skill.sourcePackage?.preview)return <img className="skill-package-cover" src={skill.sourcePackage.preview} alt={`${skill.name}效果预览`}/>;
 if(skill.previewType==='text')return <div className="res-skill-text-preview" style={{background:system?.background||'#102033',color:system?.text||'#fff'}}><span>CONTENT STUDIO / 内容策划</span><strong>{skill.name==='讲稿整理'?'一段故事，清晰展开':'让表达，更简洁有力'}</strong><div><i>01</i><p>从一个想法开始，走进创新的故事。</p></div><div><i>02</i><p>提炼关键内容，让每个重点被看见。</p></div><div><i>03</i><p>连接技术与场景，讲述真实价值。</p></div><small>结构清晰 · 自然表达 · 层次分明</small></div>;
 if(skill.previewType==='image')return <div className="res-skill-image-preview"><Artwork image={`/media/${skill.styleId||'technology'}.svg`} title={skill.name}/><div style={{color:system?.text||'#fff'}}><span>IMAGE GENERATION</span><strong>{skill.name}</strong><small>光感 · 材质 · 画面留白</small></div></div>;
 return <Artwork type={skill.previewType} styleId={skill.styleId} title={skill.name}/>;
}
export function PackageFiles({skill}:{skill:Skill}) {
 const pack=skill.sourcePackage;
 if(!pack)return null;
 return <div className="skill-package-files"><div className="skill-package-files-heading"><strong>技能包内容</strong><span>{pack.files.length} 个文件</span></div><ul>{pack.files.map(file=><li key={file.path}><FileText size={14}/><span title={file.path}>{file.path}</span><small>{file.size<1024?`${file.size} B`:`${(file.size/1024).toFixed(1)} KB`}</small></li>)}</ul>{pack.hasScripts&&<p className="skill-package-note">包含脚本依赖，已保留原文件；上传不会执行脚本。</p>}</div>;
}
export function SkillGrid({skills,onSelect,community=false}:{skills:Skill[];onSelect:(skill:Skill)=>void;community?:boolean}) {
 const state=useStudio();
 if(!skills.length)return <EmptyState title="没有找到相关技能" description={community?'只有审核通过的技能会在这里公开，试试其他关键词。':'上传 ZIP 技能包，或到共创社区添加适合你的创作能力。'}/>;
 return <div className="res-grid res-skill-grid">{skills.map((skill,index)=>{
  const pending=state.submissions.some(s=>s.skill?.id===skill.id&&s.status==='pending');
  const manageable=skillCanManage(skill,state);
  return <motion.article className="res-card" key={skill.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.22,delay:Math.min(index,8)*0.025,ease:[0.22,1,0.36,1]}}><div className="res-cover-wrapper"><button className="res-cover-button" onClick={()=>onSelect(skill)} aria-label={`查看${skill.name}`}><SkillPreview skill={skill}/><span className="res-cover-action">效果与制作方法 <ArrowUpRight size={15}/></span></button><FavoriteButton id={skill.id}/><span className="res-cover-label"><Zap size={12}/>{skill.category}</span></div><div className="res-card-body"><div className="res-card-title-row"><button className="res-text-link" onClick={()=>onSelect(skill)}><h3>{skill.name}</h3></button>{pending?<Badge tone="blue">待审核</Badge>:!community&&skill.enabled!==false?<span className="res-enabled"><Check size={13}/>已启用</span>:null}</div><p className="res-card-description res-lines-two">{skill.description}</p><div className="res-card-footer"><span><Avatar name={skill.author}/>{skill.author}<small>v{skill.version}</small></span>{community?<Button size="sm" onClick={()=>onSelect(skill)}>查看技能<ArrowUpRight size={14}/></Button>:<Button size="sm" disabled={!manageable} aria-label={skill.enabled!==false?'停用技能':'启用技能'} aria-pressed={skill.enabled!==false} title={skill.enabled!==false?'点击停用此技能':'启用后由 Agent 按任务调用'} onClick={()=>{try{state.addSkill({...skill,enabled:skill.enabled===false});toast(skill.enabled===false?'技能已启用，Agent 将按任务调用':'技能已停用，后续任务不再自动调用');}catch(error){toast(error instanceof Error?error.message:'无法修改技能',true)}}}><Power size={14}/>{skill.enabled!==false?'已启用':'启用技能'}</Button>}</div></div></motion.article>;
 })}</div>;
}
function SkillSubmissionDialog({skill,onClose}:{skill:Skill;onClose:()=>void}) {
 const [agreed,setAgreed]=useState(false),[error,setError]=useState('');
 const submit=()=>{if(!agreed){setError('请确认已检查技能说明、示例和资源。');return;}const id=useStudio.getState().submitSkill(skill.id);if(!id){setError('暂时无法提交，请检查是否已有待审核版本及技能包是否完整。');return;}toast('技能已提交审核，通过后会发布一个独立版本');onClose();};
 return <Modal open title="提交技能到共创社区" description="提交当前完整技能包与说明。待审核版本不会替换已经发布的版本。" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={submit}>提交审核</Button></>}><div className="res-form"><strong>{skill.name} · v{skill.version}</strong><p>{skill.description}</p><PackageFiles skill={skill}/><label className="res-checkbox"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>已检查技能说明、示例和资源，允许团队复用此版本</label>{error&&<p className="res-error" role="alert">{error}</p>}</div></Modal>;
}
export function SkillEditor({skill,onClose,newSkill=false}:{skill:Skill;onClose:()=>void;newSkill?:boolean}) {
 const [draft,setDraft]=useState(skill),[error,setError]=useState('');
 const save=()=>{try{const saved=syncSkillPackage(prepareSkillForm(draft));useStudio.getState().addSkill(saved);toast(newSkill?'已保存未启用的 Skill 草稿':'技能信息已保存，已发布版本保持不变');onClose();}catch(cause){setError(cause instanceof Error?cause.message:'无法保存技能，请检查填写内容。')}};
 return <Modal open wide title={newSkill?'新建技能':'编辑技能信息'} description="定义可复用的方法、输入输出与权限需求。" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={save}>{newSkill?'保存 Skill 草稿':'保存修改'}</Button></>}><SkillMetadataForm skill={draft} onChange={setDraft}/>{error&&<p className="res-error" role="alert">{error}</p>}</Modal>;
}
export function SkillDetails({skill:initialSkill,onClose,community=false}:{skill:Skill;onClose:()=>void;community?:boolean}) {
 const state=useStudio();const skill=state.skills.find(s=>s.id===initialSkill.id)||initialSkill;
 const [submitting,setSubmitting]=useState(false),[editing,setEditing]=useState(false);
 const adopted=state.skills.find(s=>s.personal&&!s.public&&s.origin?.skillId===skill.id&&s.origin.version===skillVersion(skill)&&getSkillMetadata(s).ownerAccount===skillActorAccount(state));
 const pending=state.submissions.some(s=>s.skill?.id===skill.id&&s.status==='pending');
 const manageable=skillCanManage(skill,state),own=manageable&&!skill.origin&&skill.source!=='builtin';
 const adopt=()=>{
  const latest=useStudio.getState();
  const exists=latest.skills.some(s=>s.personal&&!s.public&&s.origin?.skillId===skill.id&&s.origin.version===skillVersion(skill)&&getSkillMetadata(s).ownerAccount===skillActorAccount(latest));
  if(exists)return;
  const result=latest.adoptSkill(skill.id);
  if(!result){toast('暂时无法添加此版本，请刷新重试',true);return;}
  latest.addSkill({...result,enabled:true});toast(`已添加并启用「${skill.name}」，Agent 将按任务调用`);
 };
 const toggle=()=>{try{state.addSkill({...skill,enabled:skill.enabled===false});toast(skill.enabled===false?'技能已启用，Agent 将按任务调用':'技能已停用，后续任务不再自动调用');}catch(error){toast(error instanceof Error?error.message:'无法修改技能',true)}};
 const download=async()=>{try{const pack=skill.sourcePackage,blob=pack?.storageKey?await get<Blob>(pack.storageKey):undefined;if(!blob)throw new Error('原始技能包未找到，请重新导入。');downloadBlob(blob,pack!.filename);}catch(error){toast(error instanceof Error?error.message:'技能包下载失败，请重试',true);}};
 const exportCurrent=async()=>{try{const storageKey=skill.sourcePackage?.storageKey||skill.sourcePackage?.resourceStorageKey;const original=storageKey?await get<Blob>(storageKey):undefined;const bytes=await exportSkillPackage(skill,original);downloadBlob(new Blob([bytes as BlobPart],{type:'application/zip'}),`${skill.name}.skill.zip`);}catch(error){toast(error instanceof Error?error.message:'技能包导出失败',true)}};
 if(!community&&!skillAvailableToActor(skill,state))return <Modal open title="技能已不可用" onClose={onClose}><p>当前身份无法访问此技能，请返回技能列表。</p></Modal>;
 return <><Modal open onClose={onClose} title={skill.name} description={skill.description} wide footer={<><span className="res-footer-note">{community?`添加 v${skill.version} 到可用技能库，Agent 按任务调用`:'启用后，Agent 根据任务调用；已有作品保持不变'}</span>{community?<Button variant="primary" onClick={adopt} disabled={!!adopted}>{adopted?<Check size={15}/>:<Plus size={15}/>} {adopted?'已添加':'添加技能'}</Button>:<Button variant="primary" disabled={!manageable} onClick={toggle} aria-label={skill.enabled!==false?'停用技能':'启用技能'} aria-pressed={skill.enabled!==false}><Power size={15}/>{skill.enabled!==false?'停用技能':'启用技能'}</Button>}</>}><div className="res-skill-detail"><div><div className="res-skill-detail-preview"><SkillPreview skill={skill}/></div><div className="res-detail-topline"><span><Avatar name={skill.author}/>{skill.author}</span><Badge>{skill.category}</Badge><span>v{skill.version}</span>{skill.source==='builtin'&&<Badge>平台预置</Badge>}{adopted&&<Badge tone="green">此版本已添加</Badge>}</div><h4>效果说明</h4><p className="res-muted">{skill.description}</p>{skill.sourcePackage&&<PackageFiles skill={skill}/>}<div className="skill-personal-actions"><Button size="sm" onClick={()=>void exportCurrent()}><Download size={14}/>导出当前技能包</Button>{skill.sourcePackage?.storageKey&&<Button size="sm" onClick={()=>void download()}><Download size={14}/>下载原始技能包</Button>}</div>{own&&<div className="skill-personal-actions"><Button size="sm" onClick={()=>setEditing(true)}>编辑技能信息</Button><Button size="sm" disabled={pending} onClick={()=>setSubmitting(true)}>{pending?'此版本正在审核':'提交到共创社区'}</Button></div>}{skill.origin&&<p className="res-muted">已添加的社区版本 · v{skill.version}。更新由你主动选择，当前能力不会自动变动。</p>}</div><div className="res-prose"><h4>需要你提供</h4><p>{skill.input}</p><h4>技能执行步骤</h4><ol className="res-skill-steps">{skill.steps.map((step,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{step}</p></li>)}</ol><h4>输出结果</h4><p>{getSkillMetadata(skill).output||'尚未填写预期输出'}</p><SkillMetadataDetails skill={skill}/>{skill.sourcePackage&&<details className="skill-instructions"><summary>查看完整技能说明</summary><pre>{skill.sourcePackage.instructions}</pre></details>}</div></div></Modal>{submitting&&<SkillSubmissionDialog skill={skill} onClose={()=>setSubmitting(false)}/>} {editing&&<SkillEditor skill={skill} onClose={()=>setEditing(false)}/>}</>;
}
