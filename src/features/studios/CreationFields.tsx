import {useEffect,useRef,useState} from 'react';
import {extractDocumentText as documentText} from '../../domain/document-intake';
import type {SourceFile} from '../../domain/document-intake';
export type {SourceFile} from '../../domain/document-intake';
import {FileText,Upload,X} from 'lucide-react';
import {Button} from '../../components/ui';
import {useAIModels} from '../../domain/ai-client';
import {importWorkspaceFile} from '../../domain/workspace-upload';
import {useStudio} from '../../domain/store';
import {Field} from './StudioShared';
import {creationResolutions} from './creationLogic';
import {KnowledgeTargetNotice} from '../workspace/KnowledgeTargetNotice';

export function CreationSize({value,onChange,width,height,onWidth,onHeight}:{value:string;onChange:(v:string)=>void;width:number;height:number;onWidth:(v:number)=>void;onHeight:(v:number)=>void}){
 return <><Field label="画面分辨率"><select value={value} onChange={e=>onChange(e.target.value)}>{creationResolutions.map(r=><option key={`${r.width}×${r.height}`} value={`${r.width}×${r.height}`}>{r.width}×{r.height} · {r.label}</option>)}<option value="custom">自定义尺寸</option></select></Field>{value==='custom'&&<div className="studio-form-row"><Field label="宽度 px"><input type="number" min={320} max={16384} value={width} onChange={e=>onWidth(+e.target.value)}/></Field><Field label="高度 px"><input type="number" min={320} max={16384} value={height} onChange={e=>onHeight(+e.target.value)}/></Field></div>}</>;
}
export function CreationModel({value,onChange}:{value:string;onChange:(v:string)=>void}){const {models}=useAIModels();return <Field label="生成模型"><select value={value} onChange={e=>onChange(e.target.value)}>{models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>;}
export function CreationSources({files,onChange,onBusy,label='添加参考资料',workspaceId='personal'}:{files:SourceFile[];onChange:(files:SourceFile[])=>void;onBusy:(busy:boolean)=>void;label?:string;workspaceId?:string}){
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const upload=async(file?:File)=>{if(!file||busy)return;setBusy(true);onBusy(true);setError('');try{const asset=await importWorkspaceFile(file,workspaceId);useStudio.getState().addAsset(asset);let text='',status='已保存到智创 · 暂不支持解析，请在上方粘贴关键内容';try{text=await documentText(file);if(text.trim())status=text.length>=24000?'已解析文字 · 已截取前 24000 字，请核对内容范围':'已解析文字 · 请核对生成结果';}catch{status='已保存到智创 · 文字解析失败，请粘贴关键内容';}if(mounted.current)onChange([...files,{asset,text,status}]);}catch(e){setError(e instanceof Error?e.message:'上传失败，请重试');}finally{if(mounted.current){setBusy(false);onBusy(false);}if(input.current)input.current.value='';}};
 return <div><input hidden ref={input} type="file" accept=".txt,.md,.csv,.json,.pdf,.ppt,.pptx,.doc,.docx" onChange={e=>void upload(e.target.files?.[0])}/><button disabled={busy} className="studio-upload-zone" onClick={()=>input.current?.click()}><Upload size={20}/><b>{busy?'正在上传与读取…':label}</b><small>支持 TXT、CSV、Markdown、DOCX、PPTX 文字读取；其他文档可留作参考。资料仅保存到智创，尚未提交 ACP。</small></button>{files.map((f,i)=><div key={f.asset.id}><div className="creation-source-file"><FileText size={16}/><span><b>{f.asset.name}</b><small>{f.status}</small></span><Button size="sm" disabled={busy} aria-label={`移除${f.asset.name}`} onClick={()=>onChange(files.filter((_,j)=>i!==j))}><X size={14}/></Button></div>{f.asset.knowledgeTarget&&<KnowledgeTargetNotice target={f.asset.knowledgeTarget} historical/>}</div>)}{error&&<p role="alert" className="form-error">{error}</p>}</div>;
}
