import {useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import {Button,Modal} from '../../components/ui';
import type {DesignSystem} from '../../domain/types';
import {buildPresentationWork} from '../../domain/presentation-generation';
import {SlideView} from './StudioShared';
import './presentation-editing.css';
import {resolveFontFamily} from '../../domain/text-style';
export function PresentationStylePicker({value,systems,onChange}:{value:string;systems:DesignSystem[];onChange:(id:string)=>void}){
 const [open,setOpen]=useState(false),[preview,setPreview]=useState(value);
 const selected=systems.find(system=>system.id===preview),options=systems.filter(system=>system.id!=='none');
 const sample=buildPresentationWork({title:'设计风格预览',sections:[{title:'让想法清晰呈现',bullets:['从内容出发，组织清晰的信息层级','以图文讲述每一个章节','动态播放、语音讲解与互动问答'],narration:'设计风格预览',layout:'bullets'}]},{prompt:'',model:'demo',styleId:preview,designSystem:selected,workspaceId:'personal',width:1920,height:1080,assets:[],referenceText:''});
 const work=sample;
 return <><Button className="presentation-style-trigger" aria-label="选择设计风格" onClick={()=>{setPreview(value);setOpen(true)}}><span>{systems.find(system=>system.id===value)?.name||'无 · 根据内容自动编排'}</span><ChevronDown size={14}/></Button><Modal open={open} onClose={()=>setOpen(false)} title="选择设计风格" wide footer={<Button variant="primary" onClick={()=>{onChange(preview);setOpen(false)}}>使用此风格</Button>}><div className="presentation-style-picker"><div className="presentation-style-choices"><button type="button" aria-pressed={!preview} onClick={()=>setPreview('')}><div className="presentation-style-swatch style-none">Aa</div><strong>无</strong><small>根据内容自动编排</small>{!preview&&<Check size={14}/>}</button>{options.map(system=><button type="button" key={system.id} aria-pressed={preview===system.id} onClick={()=>setPreview(system.id)}><div className="presentation-style-swatch" style={{background:system.background,color:system.text,fontFamily:resolveFontFamily(system.font)}}><b>Aa</b><i style={{background:system.accent}}/><span>{system.colors.map(color=><em key={color} style={{background:color}}/>)}</span></div><strong>{system.name}</strong><small>{system.subtitle}</small>{preview===system.id&&<Check size={14}/>}</button>)}</div><div className="presentation-style-preview"><SlideView work={work} page={work.pages[0]}/><strong>{selected?.name||'内容自适应'}</strong><p>{selected?.description||'由 Agent 根据内容组织页面，生成后仍可调整。'}</p><small>统一应用配色、字体与排版规则；具体页面布局根据内容编排。</small></div></div></Modal></>;
}
