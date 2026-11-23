import {useState} from 'react';
import {ChevronDown,Maximize2} from 'lucide-react';
import {Button,Modal,Popover} from '../../components/ui';
import {buildPresentationWork} from '../../domain/presentation-generation';
import type {Work} from '../../domain/types';
import {SlideView} from './StudioShared';
import {applyPresentationTemplate,presentationTemplates} from './presentation-templates';
function example(template:typeof presentationTemplates[number]){
 const base=buildPresentationWork({title:template.name,sections:[{title:'让想法清晰呈现',bullets:['从内容出发，组织清晰的信息层级','用图文讲好每一个章节','讲解与问答共同构成完整体验'],narration:'模板预览',layout:'bullets'}]},{prompt:'',model:'demo',styleId:template.styleId,workspaceId:'personal',width:1920,height:1080,assets:[],referenceText:''});
 return applyPresentationTemplate(base,template.id);
}
export function PresentationTemplatePicker({value,onChange}:{value:string;onChange:(id:string,styleId:string)=>void}){
 const [preview,setPreview]=useState<Work>();
 return <><Popover trigger={<Button className="presentation-template-trigger" aria-label="选择模板">{presentationTemplates.find(t=>t.id===value)?.name||'无 · 根据内容自动编排'}<ChevronDown size={14}/></Button>}><div className="presentation-template-options"><button className="presentation-template-card" data-popover-close aria-pressed={!value} onClick={()=>onChange('','')}><strong>无</strong><small>由 Agent 根据内容与设计风格编排</small></button>{presentationTemplates.map(template=>{
 const work=example(template);
 return <div className="presentation-template-item" key={template.id}><button className="presentation-template-card" aria-pressed={value===template.id} data-popover-close onClick={()=>onChange(template.id,template.styleId)}><div className="creation-template-preview"><SlideView page={work.pages[0]} work={work}/></div><strong>{template.name}</strong><small>{template.description}</small></button><Button size="sm" aria-label={`放大预览${template.name}模板`} onClick={()=>setPreview(work)}><Maximize2 size={12}/>预览模板</Button></div>;
 })}</div></Popover><Modal open={Boolean(preview)} onClose={()=>setPreview(undefined)} title={preview?`${preview.title} · 模板预览`:'模板预览'} wide footer={<Button variant="primary" onClick={()=>{const template=presentationTemplates.find(item=>item.id===preview?.creationPackage?.params.templateId);if(template)onChange(template.id,template.styleId);setPreview(undefined);}}>使用此模板</Button>}>{preview&&<SlideView work={preview} page={preview.pages[0]}/>}</Modal></>;
}
