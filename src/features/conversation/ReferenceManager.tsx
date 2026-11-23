import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {Layers3,Pencil,Plus,X} from 'lucide-react';
import {Button,Modal,SearchInput} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {createExhibitReference,validateReferences,referenceConflicts,referenceHasScopeConstraint,referenceDimensions,referenceScopeOptions,type ExhibitReference,type ReferenceDimension} from '../../domain/exhibit-references';
import {groupReferenceSources,updateReferenceSelection} from './reference-selection';
import '../../styles/exhibit-references.css';
import {ReferenceSourcePicker} from './ReferenceSourcePicker';
import {referenceSourceChoices,visibleReferenceChoices} from './reference-source-choices';

interface Props {workspaceId:string;references:ExhibitReference[];onChange:(references:ExhibitReference[])=>void;disabled?:boolean}
export interface ReferenceManagerHandle {manage:()=>void}
const dimensions=Object.keys(referenceDimensions) as ReferenceDimension[];
const dimensionLabel=(refs:ExhibitReference[])=>[...new Set(refs.map(ref=>referenceDimensions[ref.dimension]))].join('、');
function bundles(refs:ExhibitReference[]):ExhibitReference[][]{
 return refs.reduce<ExhibitReference[][]>((result,ref)=>{
  const key=(item:ExhibitReference)=>JSON.stringify([item.sourceRevision,item.scope,item.note]);
  const index=result.findIndex(group=>key(group[0])===key(ref));
  return index<0?[...result,[ref]]:result.map((group,i)=>i===index?[...group,ref]:group);
 },[]);
}
export function ReferenceSummary({references,onClick,onRemove,disabled=false}:{references:ExhibitReference[];onClick:()=>void;onRemove:(ids:string[])=>void;disabled?:boolean}){
 const [error,setError]=useState('');
 const remove=(ids:string[])=>{try{onRemove(ids);setError('');}catch(cause){setError(cause instanceof Error?cause.message:'无法移除参考，请重试');}};
 if(!references.length)return null;
 return <div className="reference-summary" aria-label="已选创作参考">{groupReferenceSources(references).map(group=><div className="reference-summary-card" key={group.key} data-testid="exhibit-reference-summary"><button className="reference-summary-open" type="button" disabled={disabled} onClick={onClick} title={`${group.title} · ${dimensionLabel(group.references)}`}><Layers3 size={12}/><strong>{group.title}</strong><span>{dimensionLabel(group.references)}</span></button><button className="reference-summary-remove" type="button" disabled={disabled} aria-label={`移除创作参考 ${group.title}`} title="移除本次引用，保留原作品" onClick={()=>remove(group.references.map(item=>item.id))}><X size={12}/></button></div>)}{error&&<p className="reference-error" role="alert">{error}</p>}</div>;
}
export const ReferenceManager=forwardRef<ReferenceManagerHandle,Props>(function ReferenceManager({workspaceId,references,onChange,disabled=false},ref){
 const state=useStudio();
 const [view,setView]=useState<'closed'|'manage'|'picker'>('closed'),[editingIds,setEditingIds]=useState<string[]>([]),[search,setSearch]=useState('');
 const [source,setSource]=useState(''),[selectedDimensions,setDimensions]=useState<ReferenceDimension[]>(['interaction']),[scope,setScope]=useState('work'),[note,setNote]=useState(''),[error,setError]=useState('');
 const all=useRef<HTMLInputElement>(null);
 useEffect(()=>{setView('closed');setEditingIds([]);setError('');},[workspaceId]);
 useEffect(()=>{if(all.current)all.current.indeterminate=selectedDimensions.length>0&&selectedDimensions.length<dimensions.length;},[selectedDimensions,view]);
 const readonly=disabled||!workspaceCanEdit(state,workspaceId),editing=editingIds.length>0;
 const original=references.filter(item=>editingIds.includes(item.id));
 const choices=referenceSourceChoices(state.works,state.templates,workspaceId);
 const visible=visibleReferenceChoices(choices,search,source),selected=choices.find(choice=>choice.value===source);
 const preservedSource=original[0]&&`${original[0].sourceKind}:${original[0].sourceId}`===source?original[0]:undefined;
 const add=()=>{setEditingIds([]);setSource('');setDimensions(['interaction']);setScope('work');setNote('');setSearch('');setError('');setView('picker');};
 const manage=()=>{if(!references.length)add();else{setError('');setView('manage');}};
 useImperativeHandle(ref,()=>({manage}));
 const edit=(refs:ExhibitReference[])=>{setEditingIds(refs.map(item=>item.id));setSource(`${refs[0].sourceKind}:${refs[0].sourceId}`);setDimensions(refs.map(item=>item.dimension));setScope(refs[0].scope);setNote(refs[0].note);setSearch('');setError('');setView('picker');};
 const save=()=>{
  try{
   if(readonly)throw new Error('当前作品或空间为只读，无法修改参考');
   if(!selected&&!preservedSource)throw new Error('请选择当前空间的作品或社区模板');
   const incoming=selectedDimensions.map(dimension=>{
    const previous=original.find(item=>item.dimension===dimension&&item.scope===scope&&`${item.sourceKind}:${item.sourceId}`===source);
    if(previous)return {...previous,note:note.trim()};
    if(!selected)throw new Error('这是随作品保留的参考快照；新增维度或改变范围时，请重新选择有权访问的来源');
    return createExhibitReference(useStudio.getState(),workspaceId,{sourceKind:selected.kind,sourceId:selected.id,dimension,scope,note});
   });
   const updated=updateReferenceSelection(references,incoming,editingIds);
   onChange(validateReferences(updated,useStudio.getState(),workspaceId));setView('closed');
  }catch(cause){setError(cause instanceof Error?cause.message:'参考保存失败，请重试');}
 };
 const remove=(ids:string[])=>{try{onChange(references.filter(item=>!ids.includes(item.id)));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'无法移除参考');}};
 const unavailable=(item:ExhibitReference)=>{try{validateReferences([item],state,workspaceId);return false;}catch{return true;}};
 const close=()=>{setView('closed');setError('');};
 const currentScopes=selected?referenceScopeOptions(selected.work):[{value:'work',label:'整个展项'}];
 const scopes=preservedSource&&!currentScopes.some(item=>item.value===preservedSource.scope)?[{value:preservedSource.scope,label:`${preservedSource.scopeLabel} · 已保存版本`},...currentScopes]:currentScopes;
 return <>
  <button type="button" className="composer-tool reference-toolbar-trigger" aria-label="创作参考" title="按用途组合参考展项" disabled={readonly} onClick={manage}><Layers3 size={16}/><span>创作参考{references.length?` · ${groupReferenceSources(references).length}`:''}</span></button>
  <Modal open={view==='manage'} onClose={close} title="创作参考" description="分别参考交互、UI、内容组织与局部效果；客户事实仍来自当前项目空间。" footer={<><Button onClick={close}>完成</Button><Button variant="primary" disabled={readonly} onClick={add}><Plus size={14}/>添加参考展项</Button></>}>
   <div className="reference-manager-list">{groupReferenceSources(references).map(group=><article className="exhibit-reference-card" data-testid="exhibit-reference-card" key={group.key}>
    <div className="exhibit-reference-top"><strong>{group.title}</strong></div>
    {bundles(group.references).map(items=><div className="reference-bundle" key={items.map(item=>item.id).join('|')}>
     <div className="exhibit-reference-top"><span>{items[0].scopeLabel} · v{items[0].sourceRevision}</span><button type="button" disabled={readonly} aria-label={`编辑参考 ${group.title} ${dimensionLabel(items)}`} onClick={()=>edit(items)}><Pencil size={12}/></button><button type="button" disabled={readonly} aria-label={`移除参考 ${group.title} ${dimensionLabel(items)}`} onClick={()=>remove(items.map(item=>item.id))}><X size={13}/></button></div>
     {items.map(item=><div className="reference-dimension-record" key={item.id}><div className="exhibit-reference-scope"><b>{referenceDimensions[item.dimension]}</b><small>{unavailable(item)?'来源已不可用':item.status==='adopted'?'已采用':'参考候选'}</small></div>{item.adoptionEvidence&&<p className="reference-adoption-evidence">{item.adoptionEvidence}</p>}</div>)}
     {items[0].note&&<p>{items[0].note}</p>}
     {!choices.some(choice=>choice.value===group.key)&&!items.some(unavailable)&&<p className="reference-manager-hint">随作品保留的参考快照，不开放原私有作品。</p>}
    </div>)}
   </article>)}</div>
   {!references.length&&<p className="reference-manager-hint">尚未添加参考。</p>}
   {referenceConflicts(references).map(message=><p className="reference-conflict" key={message}>{message}</p>)}
   <p className="reference-manager-hint">移除参考不会删除已有作品内容。</p>{error&&<p className="reference-error" role="alert">{error}</p>}
  </Modal>
  <Modal open={view==='picker'} onClose={close} wide title={editing?'编辑参考范围':'添加参考展项'} description="同一来源可同时参考多个方面，来源范围单独选择。" footer={<><Button onClick={close}>取消</Button><Button variant="primary" disabled={readonly||(!selected&&!preservedSource)||!selectedDimensions.length} onClick={save}>{editing?'保存参考':'加入参考'}</Button></>}>
   <div className="reference-picker-form">
    <SearchInput value={search} onChange={setSearch} placeholder="搜索参考展项"/>
    <ReferenceSourcePicker choices={visible} value={source} onChange={value=>{setSource(value);setScope('work');setError('');}}/>
    {preservedSource&&!selected&&<p className="reference-manager-hint">{preservedSource.sourceTitle} · 保留快照；原来源不可访问，仍可修改已有参考说明。</p>}
    <fieldset className="reference-dimensions"><legend>参考什么 · 可多选</legend><label className="reference-dimension-all"><input ref={all} type="checkbox" aria-label="全部参考维度" checked={selectedDimensions.length===dimensions.length} onChange={event=>setDimensions(event.target.checked?[...dimensions]:[])}/>全部</label><div>{dimensions.map(dimension=><label key={dimension}><input type="checkbox" aria-label={referenceDimensions[dimension]} checked={selectedDimensions.includes(dimension)} onChange={event=>setDimensions(current=>event.target.checked?[...current,dimension]:current.filter(value=>value!==dimension))}/>{referenceDimensions[dimension]}</label>)}</div><p className="reference-manager-hint">“全部”只选择以上四种方式，不复制原客户事实或媒体。</p></fieldset>
    <label>来源范围<select aria-label="参考范围" value={scope} disabled={!selected} onChange={event=>setScope(event.target.value)}>{scopes.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>应用位置与补充说明<textarea aria-label="参考补充说明" rows={3} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：借鉴分类展开与卡片外观，仅应用到主内容区。"/></label>
    {referenceHasScopeConstraint({scope,note})&&<p className="reference-conflict">局部范围和补充说明交给 Agent 处理，不自动整项套用；实际采用情况随制作记录。</p>}
    {error&&<p className="reference-error" role="alert">{error}</p>}
   </div>
  </Modal>
 </>;
});
