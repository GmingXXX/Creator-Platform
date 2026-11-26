import {registeredPlugin} from '../../domain/creation-plugins';
import type {RunActivity} from './RunProgress';
import {useEffect,useState} from 'react';
import type {Asset,Run,Work} from '../../domain/types';
import {readAssetSources,type SourceFile} from '../../domain/document-intake';
import {useStudio} from '../../domain/store';
import {assetAvailableForAI} from '../../domain/asset-access';
import {PresentationCreationDialog} from '../studios/PresentationCreationDialog';
import {StoryCreationDialog} from '../studios/StoryCreationDialog';
import {GeneratedComponentReview} from '../resources/GeneratedComponentReview';
import {Button} from '../../components/ui';
export function RunStudioReview({run,onActivity}:{run:Run;onActivity?:(activity?:RunActivity)=>void}){
 const state=useStudio(),[files,setFiles]=useState<SourceFile[]>(),[open,setOpen]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;const studio=useStudio.getState();const assets=studio.assets.filter(a=>run.attachmentIds.includes(a.id)&&assetAvailableForAI(a,run.workspaceId));
  readAssetSources(assets).then(result=>{if(active)setFiles(result)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'资料读取失败')});return()=>{active=false};
 },[run.id]);
 const kind=run.outputKind==='story'?'互动影片':run.outputKind==='presentation'?'智能演示':run.outputKind==='video'?'视频作品':'组件';
 const doneWork=(work:Work)=>state.updateRun(run.id,registeredPlugin(run.outputKind)?.completeCreation(run,work)??{status:'complete',step:5,workId:work.id,error:undefined});
 const doneAsset=(asset:Asset)=>state.updateRun(run.id,{status:'complete',step:5,assetId:asset.id,error:undefined});
 const system=state.systems.find(s=>s.id===run.styleId);
 const skills=state.skills.filter(s=>run.skillIds.includes(s.id));
 const componentReview=!['story','presentation','video'].includes(run.outputKind||'');
 return <>{(!files||componentReview&&!open)&&<div className="creation-review"><h2>{kind} · 确认制作方案</h2><p>已带入需求、模型、设计风格、Skills 和附件。确认内容结构与素材后再创建作品。</p>{error&&<p role="alert">{error}</p>}<Button variant="primary" disabled={!files} onClick={()=>setOpen(true)}>{files?'继续确认方案':'正在读取资料…'}</Button></div>}
 {files&&(run.outputKind==='story'?<StoryCreationDialog inline onActivity={onActivity} requestKey={run.id} open={true} keepDraftOnClose initialTopic={run.prompt} initialModel={run.model} initialStyleId={run.styleId} initialSkillIds={run.skillIds} initialReferences={run.references} initialFiles={files} initialWorkspaceId={run.workspaceId||'personal'} initialAutoGenerate onCreated={doneWork} onClose={()=>setOpen(false)}/>:run.outputKind==='presentation'||run.outputKind==='video'?<PresentationCreationDialog inline onActivity={onActivity} requestKey={run.id} open={true} keepDraftOnClose initialKind='presentation' initialTopic={run.prompt} initialModel={run.model} initialStyleId={run.styleId} initialSkillIds={run.skillIds} initialReferences={run.references} initialFiles={files} initialWorkspaceId={run.workspaceId||'personal'} initialAutoGenerate onCreated={doneWork} onClose={()=>setOpen(false)}/>:<GeneratedComponentReview open={open} input={{prompt:run.prompt,model:run.model,style:system?{id:system.id,name:system.name,accent:system.accent,background:system.background}:undefined,skills:skills.map(s=>({id:s.id,name:s.name,steps:s.steps,instructions:s.sourcePackage?.instructions})),referenceText:files.filter(f=>f.text).map(f=>`文件：${f.asset.intake?.relativePath||f.asset.name}\n${f.text}`).join('\n\n')}} workspaceId={run.workspaceId||'personal'} onCreated={doneAsset} onClose={()=>setOpen(false)}/>)}
 </>;
}
