import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {BookOpenCheck,LoaderCircle,Pencil,Sparkles,Square} from 'lucide-react';
import type {EditTarget,Skill,Work} from '../../domain/types';
import type {ExperienceRecord,ExperienceSections} from '../../domain/experience-types';
import {experienceSectionKeys} from '../../domain/experience-types';
import {createExperienceSkill,editExperience,experienceFingerprint,organizeExperience} from '../../domain/creation-experience';
import {experienceScopeLabel,experienceScopeOptions} from '../../domain/experience-scope';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {skillAvailableToActor,skillActorAccount} from '../../domain/skill-access';
import {getSkillMetadata,syncSkillPackage} from '../../domain/skill-metadata';
import {SkillMetadataForm,prepareSkillForm} from '../resources/SkillMetadataForm';
import {Button,Modal,toast} from '../../components/ui';
import '../../styles/creation-experience.css';

export const experienceLabels={overview:'做了什么',references:'参考了什么',changes:'作了哪些调整',lessons:'可复用做法',limitations:'尚待验证'};
export function ExperienceSummary({record}:{record:ExperienceRecord}) {
 return <div className="experience-summary" role="region" aria-label="制作经验摘要">
  <div className="experience-summary-meta"><strong>制作经验 · v{record.version}</strong><span>{record.mode==='local'?'本地规则整理':'AI 整理'} · 作品版本 {record.workRevision}</span></div>
  <p className="experience-scope-label">整理范围：{record.targetLabel||experienceScopeLabel(record.target)}</p>
  {experienceSectionKeys.map(key=><section key={key}><h4>{experienceLabels[key]}{record.editedSections.includes(key)&&<small>已由你修订</small>}</h4><p>{record.sections[key]||'已留空'}</p></section>)}
  {!!record.history.length&&<details><summary>整理历史 · {record.history.length} 个版本</summary>{[...record.history].reverse().map(version=><div className="experience-history" key={version.version}><strong>v{version.version} · 作品版本 {version.workRevision}</strong><p className="experience-scope-label">整理范围：{version.targetLabel||experienceScopeLabel(version.target)}</p><p>{version.sections.lessons||'未填写可复用做法'}</p></div>)}</details>}
 </div>;
}
interface Props {work:Work;target:EditTarget;model:string;disabled?:boolean;onBeforeApply?:()=>void;onApplied?:(work:Work)=>void}
export interface ExperiencePanelHandle {organize:(target?:EditTarget)=>void}
export const ExperiencePanel=forwardRef<ExperiencePanelHandle,Props>(function ExperiencePanel({work,target,model,disabled,onBeforeApply,onApplied},ref){
 const state=useStudio(),current=state.works.find(item=>item.id===work.id)||work,record=current.experience;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState<ExperienceSections|null>(null),[editVersion,setEditVersion]=useState<number>();
 const [scopeOpen,setScopeOpen]=useState(false),[scopeKey,setScopeKey]=useState('work');
 const scopes=experienceScopeOptions(current,target),chosenScope=scopes.find(option=>option.key===scopeKey);
 const [skillOpen,setSkillOpen]=useState(false),[skillDraft,setSkillDraft]=useState<Skill|null>(null),[suggestion,setSuggestion]=useState('');
 const request=useRef<AbortController|null>(null),lock=useRef(false),workId=useRef(work.id),latest=useRef({onBeforeApply,onApplied});workId.current=work.id;latest.current={onBeforeApply,onApplied};
 const writable=workspaceCanEdit(state,work.workspaceId||'personal');
 useEffect(()=>{setBusy(false);setError('');setEditing(null);setSkillOpen(false);setScopeOpen(false);lock.current=false;return()=>request.current?.abort()},[work.id]);
 const organize=async(scope:EditTarget={scope:'work'})=>{
  if(lock.current||disabled||!writable)return;const id=work.id;
  lock.current=true;setBusy(true);setError('');
  const controller=new AbortController();request.current=controller;
  try{latest.current.onBeforeApply?.();const next=await organizeExperience(id,{model,target:scope,signal:controller.signal,beforeCommit:()=>latest.current.onBeforeApply?.()});if(workId.current===id)latest.current.onApplied?.(next);}
  catch(reason){if(workId.current===id)setError(reason instanceof Error?reason.message:'整理未完成，请重试。');}
  finally{if(workId.current===id){setBusy(false);lock.current=false;}}
 };
 useImperativeHandle(ref,()=>({organize:(scope?:EditTarget)=>{void organize(scope)}}));
 const saveEdit=()=>{if(!editing)return;try{latest.current.onBeforeApply?.();const next=editExperience(work.id,editing,editVersion);latest.current.onApplied?.(next);setEditing(null);setError('')}catch(reason){setError(reason instanceof Error?reason.message:'无法保存总结。')}};
 const skillCandidates=state.skills.filter(skill=>skillAvailableToActor(skill,state)&&/(制作|编排|历程|时间轴|讲稿|故事|展项|卡片)/.test(`${skill.name}${skill.description}`)).slice(0,6);
 const prepareSkill=()=>{
  if(!record)return;
  try{const ownerAccount=skillActorAccount(useStudio.getState());if(!ownerAccount)throw new Error('当前身份无法创建技能');
   const draft=createExperienceSkill(current,`${work.title.slice(0,50)} · 制作方法`,record.sections.lessons||'请补充可复用的方法说明','当前作品已确认的内容资料、目标受众、屏幕与交互要求','核对资料与适用条件\n按确认的方法组织内容与交互\n预览完整作品，记录未验证效果');
   setSkillDraft({...draft,metadata:{...getSkillMetadata(draft),ownerAccount}});setSuggestion('');setError('');setSkillOpen(true);
  }catch(reason){setError(reason instanceof Error?reason.message:'无法提炼技能。')}
 };
 const saveSkill=()=>{
  if(!skillDraft)return;
  try{const latestState=useStudio.getState(),latestWork=latestState.works.find(item=>item.id===work.id&&!item.deletedAt);if(!latestWork)throw new Error('当前作品已不存在。');
   if(!workspaceCanEdit(latestState,latestWork.workspaceId||'personal'))throw new Error('当前作品已不可编辑。');
   const source=skillCandidates.find(item=>item.id===suggestion);
   if(source&&!skillAvailableToActor(source,latestState))throw new Error('参考方法已不可访问，请重新选择。');
   const draft=prepareSkillForm(skillDraft),skill=syncSkillPackage({...draft,description:source?`对「${source.name}」v${source.version} 的改进建议。\n${draft.description}`:draft.description});
   latestState.addSkill(skill);setSkillOpen(false);toast('已保存未启用的 Skill 草稿，可在 Skills 中继续编辑和投稿');
  }catch(reason){setError(reason instanceof Error?reason.message:'无法保存 Skill 草稿。')}
 };
 return <div className="agent-experience">
  <p className="studio-muted">总结本次制作方法，可提炼为 Skill。</p><div className="experience-shortcuts"><button type="button" disabled={disabled||busy||!writable} onClick={()=>{setScopeKey('work');setScopeOpen(true)}}><BookOpenCheck size={14}/>整理制作经验</button>{busy&&<button type="button" onClick={()=>request.current?.abort()}><Square size={12}/>停止整理</button>}</div>
  {busy&&<p className="experience-progress" role="status"><LoaderCircle size={14} className="spinner"/>正在读取当前成果与制作记录…</p>}
  {record&&<><ExperienceSummary record={record}/>{record.sourceFingerprint!==experienceFingerprint(work)&&<p className="experience-stale">作品已有新调整，可再次整理更新摘要。</p>}<div className="experience-actions"><button type="button" disabled={busy||!writable} onClick={()=>{setEditing({...record.sections});setEditVersion(record.version)}}><Pencil size={13}/>修改整理结果</button><button type="button" disabled={busy||!writable} onClick={prepareSkill}><Sparkles size={13}/>提炼为 Skill</button></div></>}
  {error&&<p className="followup-error" role="alert">{error}</p>}
  <Modal open={scopeOpen} onClose={()=>setScopeOpen(false)} title="选择经验整理范围" description="依据所选范围的成果与制作记录整理，可在结果中继续修订。" footer={<><Button onClick={()=>setScopeOpen(false)}>取消</Button><Button variant="primary" disabled={disabled||busy||!writable||!chosenScope} onClick={()=>{if(chosenScope){setScopeOpen(false);void organize(chosenScope.target)}}}>开始整理</Button></>}>
   <fieldset className="experience-scope-options"><legend>整理范围</legend>{scopes.map(option=><label key={option.key}><input type="radio" name="experience-scope" value={option.key} checked={scopeKey===option.key} onChange={()=>setScopeKey(option.key)}/><span>{option.label}</span></label>)}</fieldset>
   <p className="experience-scope-hint">更新本作品的经验摘要，旧结果保留在整理历史中；已手动修订的段落继续保留。</p>
  </Modal>
  <Modal open={!!editing} onClose={()=>setEditing(null)} title="修改整理结果" footer={<><Button onClick={()=>setEditing(null)}>取消</Button><Button variant="primary" onClick={saveEdit}>保存整理结果</Button></>}><div className="experience-form">{editing&&experienceSectionKeys.map(key=><label key={key}>{experienceLabels[key]}<textarea aria-label={experienceLabels[key]} rows={key==='lessons'?5:3} maxLength={5000} value={editing[key]} onChange={event=>setEditing({...editing,[key]:event.target.value})}/></label>)}<p>已修订的段落会在后续自动整理时保留，包括主动留空的内容。</p></div></Modal>
  <Modal open={skillOpen} wide onClose={()=>setSkillOpen(false)} title="提炼为 Skill" description="已根据制作经验预填候选定义，请检查元信息和权限需求；默认保存未启用草稿。" footer={<><Button onClick={()=>setSkillOpen(false)}>取消</Button><Button variant="primary" onClick={saveSkill}>保存 Skill 草稿</Button></>}><div className="experience-form"><label>与已有方法的关系<select aria-label="与已有方法的关系" value={suggestion} onChange={event=>setSuggestion(event.target.value)}><option value="">保存为新的方法草稿</option>{skillCandidates.map(skill=><option key={skill.id} value={skill.id}>补充建议：{skill.name} v{skill.version}</option>)}</select></label></div>{skillDraft&&<SkillMetadataForm skill={skillDraft} onChange={setSkillDraft} experience/>}<p className="res-muted">作为补充建议保存时，会创建独立草稿，不覆盖已有 Skill。共享前请检查客户专属内容。</p>{error&&<p className="res-error" role="alert">{error}</p>}</Modal>
 </div>;
});
