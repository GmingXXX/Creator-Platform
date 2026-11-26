import {useId,useState,type ReactNode} from 'react';
import {ChevronRight,Component,Layers3,Shapes} from 'lucide-react';
import type {NodeKind} from '../../domain/types';
import {componentCatalog} from './editor-capabilities';
import './panel-hierarchy.css';

interface CatalogProps {
  query:string;
  add:(type:NodeKind,variant?:string)=>void;
  glyph:(type:NodeKind)=>ReactNode;
}
const groupIcons=[Component,Layers3,Shapes];

function toggle(list:string[],id:string) {
  return list.includes(id)?list.filter(item=>item!==id):[...list,id];
}

export function ComponentCatalog({query,add,glyph}:CatalogProps) {
  const term=query.trim().toLowerCase();
  const prefix=useId();
  const [closedGroups,setClosedGroups]=useState<string[]>([]);
  const [openFamily,setOpenFamily]=useState('');
  const [searchState,setSearchState]=useState({term:'',closed:[] as string[]});
  const hiddenResults=searchState.term===term?searchState.closed:[];
  const toggleSearch=(id:string)=>setSearchState({term,closed:toggle(hiddenResults,id)});
  const matches=(name:string)=>name.toLowerCase().includes(term);
  const groups=componentCatalog.map((group,index)=>({
    ...group, Icon:groupIcons[index],
    families:group.families.map(family=>{
      const all=matches(group.title)||matches(family.name);
      const items=all?family.variants:family.variants.filter(matches);
      return {...family,items,visible:all||items.length>0};
    }).filter(family=>family.visible),
  })).filter(group=>group.families.length);

  function tile(type:NodeKind,label:string,variant?:string) {
    return <button key={label} className="component-tile" aria-label={label} draggable
      onClick={()=>add(type,variant)} title={'点击或拖入画布添加'+label}
      onDragStart={event=>{
        event.dataTransfer.effectAllowed='copy';
        event.dataTransfer.setData('application/zhichuang-component',type);
        if(variant)event.dataTransfer.setData('application/zhichuang-variant',variant);
      }}>{glyph(type)}<span>{label}</span></button>;
  }

  if(!groups.length)return <p role="status" className="catalog-empty">未找到匹配的组件</p>;
  return <div className="editor-catalog">{groups.map(({title,Icon,families})=>{
    const groupId=prefix+title;
    const expanded=term?!hiddenResults.includes(groupId):!closedGroups.includes(title);
    return <section className="component-group" key={title}>
      <h2><button className="component-group-title" aria-expanded={expanded} aria-controls={groupId}
        onClick={()=>term?toggleSearch(groupId):setClosedGroups(previous=>toggle(previous,title))}>
        <Icon className="catalog-group-icon" size={16} aria-hidden="true"/><span>{title}</span>
        <ChevronRight className="catalog-chevron" size={15} aria-hidden="true"/>
      </button></h2>
      <div id={groupId} className="catalog-children component-grid" hidden={!expanded}>{families.map(family=>{
        if(!family.variants.length)return tile(family.type,family.name);
        const familyId=groupId+'-'+encodeURIComponent(family.name);
        const open=term?!hiddenResults.includes(familyId):openFamily===familyId;
        return <div className="catalog-branch" key={family.name}>
          <h3 className="catalog-family"><button aria-expanded={open} aria-controls={familyId}
            onClick={()=>term?toggleSearch(familyId):setOpenFamily(open?'':familyId)}>
            <ChevronRight className="catalog-chevron" size={13} aria-hidden="true"/>
            <span>{family.name}</span><small aria-hidden="true">{family.items.length}</small>
          </button></h3>
          <div className="catalog-variants component-grid" id={familyId} hidden={!open}>
            {open&&family.items.map(variant=>tile(family.type,variant,variant))}
          </div>
        </div>;
      })}</div>
    </section>;
  })}</div>;
}
