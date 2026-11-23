import {useEffect,useRef,useState} from 'react';
import {Download,LoaderCircle,Sparkles} from 'lucide-react';
import {Button,Modal,downloadBlob,toast} from '../../components/ui';
import {generateComponentPackage,buildComponentPackage,type ComponentGenerationInput} from '../../domain/component-generation';
import {importFile,readMediaBlob} from '../../domain/upload';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import type {Asset} from '../../domain/types';
import {ComponentImportDialog,type ComponentImportResult} from './ComponentImportDialog';

type Generated=Awaited<ReturnType<typeof generateComponentPackage>>;
export function GeneratedComponentReview({input,workspaceId,onClose,onCreated,open=true}:{input:ComponentGenerationInput;workspaceId:string;onClose:()=>void;onCreated:(asset:Asset)=>void;open?:boolean}){
 const workspaces=useStudio(s=>s.workspaces);
 const [generated,setGenerated]=useState<Generated>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();}},[]);
 const close=()=>{onClose();};
 const generate=async()=>{
  if(!workspaceCanEdit(useStudio.getState(),workspaceId)){setError('当前空间为只读，无法生成组件');return;}
  if(busy)return;const request=new AbortController();controller.current=request;setBusy(true);setError('');
  try{const result=await generateComponentPackage(input,request.signal);if(mounted.current&&!request.signal.aborted)setGenerated(result);}
  catch(cause){if(mounted.current&&!request.signal.aborted)setError(cause instanceof Error?cause.message:'生成失败，请重试。');}
  finally{if(mounted.current&&controller.current===request)setBusy(false);}
 };
 const save=async(result:ComponentImportResult)=>{
  if(!workspaceCanEdit(useStudio.getState(),workspaceId))throw new Error('当前空间为只读，无法保存组件');
  if(!generated)throw new Error('请先生成组件');
  if(!workspaces.some(space=>space.id===workspaceId))throw new Error('目标空间不可用，请重新选择');
  const finalPlan={...generated.plan,name:result.name};
  const file=await buildComponentPackage(finalPlan,input,result.componentImport.values);
  const packageFile=await importFile(file);
  const runtime=await importFile(new File([result.html],`${result.name}.html`,{type:'text/html;charset=utf-8'}));
  const asset:Asset={...runtime,name:result.name,description:result.description,workspaceId,kind:'html',source:'generated',tags:['AI内容编排','悬浮卡片','可试编辑'],componentImport:result.componentImport,
   metadata:{...runtime.metadata,analysis:{status:'ready',summary:result.description,tags:['成果展示','悬浮卡片'],basis:'inherited'},business:{note:'模型依据需求与参考资料编排内容，保存前请核对事实。',subject:'',confirmed:false,usage:'reusable',allowAi:true}},
   package:{id:crypto.randomUUID(),version:'1.0',prompt:input.prompt,skillIds:(input.skills||[]).flatMap(skill=>skill.id?[skill.id]:[]),styleId:input.style?.id,params:{model:input.model,method:'AI内容配置 + 已适配组件装配',referenceText:input.referenceText||''},complete:true,files:[{name:file.name,type:'component',src:packageFile.src},{name:'生成内容.json',type:'configuration',content:JSON.stringify({plan:finalPlan,values:result.componentImport.values},null,2)}]}};
  useStudio.getState().addAsset(asset);onCreated(asset);toast('组件已保存，可继续插入画布；创作资料中保留完整 ZIP');
 };
 if(generated)return <ComponentImportDialog open={open} key={generated.file.name} inspection={generated.inspection} workspaceLabel={workspaces.find(s=>s.id===workspaceId)?.name||'当前空间'} title="检查生成组件" description="已按需求生成内容与样式配置，并装配为组件包。检查真实效果并试编辑后，再保存到素材库。" allowReplace={false}
  extraAction={<Button size="sm" variant="ghost" onClick={()=>downloadBlob(generated.file,generated.file.name)}><Download size={14}/>下载初始组件包</Button>}
  onCancel={close} onReplace={async()=>{throw new Error('请返回素材库上传其他组件包')}} onEntryChange={async()=>{}} onSave={save}/>;
 return <Modal open={open} wide title="生成企业成果组件" onClose={close} description="模型编排内容，已适配的悬浮卡片组件负责呈现，生成后可以检查、试编辑并保存。" footer={<><Button onClick={close}>{busy?'收起生成':'取消'}</Button><Button variant="primary" disabled={busy} onClick={()=>void generate()}>{busy?<LoaderCircle size={16} className="spin"/>:<Sparkles size={16}/>} {busy?'正在生成组件…':error?'重试生成':'生成组件包'}</Button></>}>
  <div className="res-form"><h3>本次创作需求</h3><p style={{whiteSpace:'pre-wrap'}}>{input.prompt}</p><div className="res-soft-panel"><strong>企业成果悬浮卡片组</strong><p>鼠标悬浮倾斜、光晕跟随、点击查看详情，支持键盘和触屏浏览。</p><p>生成后可调整：标题、简介、每张卡片内容、主题色、列数、悬浮强度。</p></div><p className="res-muted">模型：{input.model} · 设计风格：{input.style?.name||'无'} · {input.skills?.length||0} 项 Skill · 已读取 {input.referenceText?.length||0} 字参考资料</p><p className="res-muted">当前采用已适配的成果卡片结构。新类型的任意交互逻辑仍需单独适配。</p>{error&&<p className="res-error" role="alert">{error}</p>}</div>
 </Modal>;
}

/** The saved ZIP contains trial values, unlike the initial generation download. */
export function GeneratedComponentPackageDownload({asset}:{asset:Asset}){
 const [busy,setBusy]=useState(false);
 const file=asset.source==='generated'&&asset.kind==='html'?asset.package?.files.find(f=>/\.zip$/i.test(f.name)&&f.src?.startsWith('idb:')):undefined;
 if(!file?.src)return null;
 return <Button variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{downloadBlob(await readMediaBlob(file.src!),file.name);}catch(cause){toast(cause instanceof Error?cause.message:'组件包读取失败',true);}finally{setBusy(false);}}}><Download size={15}/>{busy?'正在准备…':'下载组件包'}</Button>;
}
