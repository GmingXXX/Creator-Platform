import type {ExhibitReference} from '../../domain/exhibit-references';
export interface ReferenceSourceGroup {key:string;title:string;references:ExhibitReference[]}
const sourceKey=(ref:ExhibitReference)=>`${ref.sourceKind}:${ref.sourceId}`;
const selectionKey=(ref:ExhibitReference)=>`${sourceKey(ref)}:${ref.dimension}:${ref.scope}`;
export function groupReferenceSources(references:ExhibitReference[]):ReferenceSourceGroup[]{
 return references.reduce<ReferenceSourceGroup[]>((groups,reference)=>{
  const key=sourceKey(reference),found=groups.some(group=>group.key===key);
  return found?groups.map(group=>group.key===key?{...group,references:[...group.references,reference]}:group):[...groups,{key,title:reference.sourceTitle,references:[reference]}];
 },[]);
}
/** An edit is atomic, and unchanged dimensions retain their original version and adoption record. */
export function updateReferenceSelection(existing:ExhibitReference[],incoming:ExhibitReference[],editingIds:string[]=[]):ExhibitReference[]{
 if(!incoming.length)throw new Error('请至少选择一项参考内容');
 const others=existing.filter(ref=>!editingIds.includes(ref.id));
 const keys=[...others,...incoming].map(selectionKey);
 if(new Set(keys).size!==keys.length)throw new Error('这一来源的相同参考范围已添加，请编辑已有参考');
 if(keys.length>12)throw new Error('本次最多使用 12 项参考维度，请先移除不需要的参考');
 const selected=incoming.map(ref=>{
  const previous=existing.find(old=>editingIds.includes(old.id)&&selectionKey(old)===selectionKey(ref));
  if(!previous)return structuredClone(ref);
  return previous.note===ref.note?structuredClone(previous):{...structuredClone(previous),note:ref.note,status:'reference' as const,adoptionEvidence:undefined};
 });
 return [...others,...selected];
}
