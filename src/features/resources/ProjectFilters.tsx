import {ChevronDown} from 'lucide-react';
import {contentPurposes,projectCategories} from '../../domain/project-taxonomy';
import {exhibitTypes} from '../../domain/scenes';
import {Popover} from '../../components/ui';
import '../../styles/community-v14.css';

export function ProjectCategoryFilter({value,onChange,testId}:{value:string;onChange:(value:string)=>void;testId?:string}) {
 return <div className="community-taxonomy"><div className="community-filter-row"><span className="community-filter-label">作品类型</span><div className="res-chip-list" aria-label="作品大类" data-testid={testId}>
  {[{id:'all',label:'全部类型'},...projectCategories].map(item=><button key={item.id} className={value===item.id?'active':''} aria-pressed={value===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>)}
 </div></div></div>;
}
export function ProjectDetailFilters({category,purpose,form,onPurpose,onForm}:{category:string;purpose:string;form:string;onPurpose:(value:string)=>void;onForm:(value:string)=>void}) {
 return <div className="community-dropdowns"><label><span>展示内容</span><select aria-label="展示内容" value={purpose} onChange={e=>onPurpose(e.target.value)}><option value="all">全部内容</option>{contentPurposes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
  {category==='interactive'&&<label><span>展示形式</span><select aria-label="展示形式" value={form} onChange={e=>onForm(e.target.value)}><option value="">全部展示形式</option><option value="none">未分类</option>{exhibitTypes.map(item=><option key={item}>{item}</option>)}</select></label>}
 </div>;
}
export function ContentPurposePicker({value,onChange}:{value:string[];onChange:(value:string[])=>void}) {
 const names=contentPurposes.filter(item=>value.includes(item.id)).map(item=>item.label);
 return <div className="res-field"><span>展示内容</span><Popover trigger={<button type="button" className="classification-select" aria-label="展示内容">{names.join('、')||'无'}<ChevronDown size={15}/></button>}><div className="classification-options" role="group" aria-label="选择展示内容">
  <button type="button" aria-pressed={!value.length} onClick={()=>onChange([])}>无</button>
  {contentPurposes.map(item=><button type="button" key={item.id} title={item.description} aria-pressed={value.includes(item.id)} onClick={()=>onChange(value.includes(item.id)?value.filter(id=>id!==item.id):[...value,item.id])}>{item.label}</button>)}
  <button type="button" className="classification-done" data-popover-close>完成</button>
 </div></Popover></div>;
}
