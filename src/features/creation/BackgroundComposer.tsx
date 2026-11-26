import {useEffect,useState} from 'react';
import {LoaderCircle,RotateCcw} from 'lucide-react';
import {useStudio} from '../../domain/store';
import {beginBackground,beginWorkBackground,advanceBackground,applyBackground} from '../../domain/background-generation';
import {Button,Modal,toast} from '../../components/ui';
import {CurrentWorkPreview} from '../conversation/CurrentWorkPreview';
import {AssetPreview} from '../resources/Shared';
import '../../styles/background-composer.css';

export function BackgroundComposer({runId,pageId,open,onClose}:{runId:string;pageId?:string;open:boolean;onClose:()=>void}){
 const state=useStudio(),run=state.runs.find(r=>r.id===runId),work=state.works.find(w=>w.id===run?.workId&&!w.deletedAt);
 const [prompt,setPrompt]=useState(''),[selection,setSelection]=useState('');
 useEffect(()=>{if(!open)return;const s=useStudio.getState(),r=s.runs.find(r=>r.id===runId);if(!r)return;
  setPrompt(r.backgroundDraft?.prompt||r.aiPlan?.imagePrompt||`为「${s.works.find(w=>w.id===r.workId)?.title||r.prompt}」制作背景，${s.systems.find(x=>x.id===r.styleId)?.name||'简洁风格'}，为文字与内容留出充足空间，不生成文字。`);
  setSelection(r.backgroundDraft?.assetId||r.backgroundAssetId||'');
 },[open,runId]);
 useEffect(()=>{if(run?.backgroundDraft?.status==='ready'&&run.backgroundDraft.assetId)setSelection(run.backgroundDraft.assetId);},[run?.backgroundDraft?.assetId,run?.backgroundDraft?.status]);
 if(!run)return null;
 const draft=run.backgroundDraft,selected=state.assets.find(a=>a.id===selection),busy=draft?.status==='pending',unresolved=draft?.status==='failed'&&draft.retryable;
 const versions=(run.generatedBackgroundIds||[]).map(id=>state.assets.find(a=>a.id===id)).filter(a=>!!a);
 const binding=selected?.package?.params;
 const targetPage=work?.pages.find(p=>p.id===(binding?.targetWorkId===work?.id?binding?.targetPageId:undefined))||work?.pages.find(p=>p.id===pageId)||work?.pages[0];
 const preview=work&&selected?{...work,pages:work.pages.map(p=>p.id===targetPage?.id?{...p,backgroundImage:selected.src,backgroundAssetId:selected.id}:p)}:work;
 const generate=()=>{try{
  if(work)beginWorkBackground(runId,prompt,pageId||targetPage?.id,[],'image-service');
  else beginBackground(runId,prompt);
  void advanceBackground(runId);
 }catch(e){toast(e instanceof Error?e.message:'暂时无法生成',true);}};
 const adopt=()=>{try{applyBackground(runId,selection,targetPage?.id);toast('已采用背景，页面内容与交互已保留');onClose();}catch(e){toast(e instanceof Error?e.message:'暂时无法采用背景',true);}};
 return <Modal open={open} onClose={onClose} title="生成与调整背景" wide footer={<><Button onClick={onClose}>稍后再看</Button><Button variant="primary" disabled={!selected||busy} onClick={adopt}>采用这张背景</Button></>}>
  <div className="background-composer">
   <div className="background-composer-preview" style={{aspectRatio:work?`${work.width}/${work.height}`:'16/9',maxWidth:work?360*work.width/work.height:undefined,width:'100%',justifySelf:'center'}} aria-label="完整页面背景预览">{preview?<CurrentWorkPreview work={preview} pageId={targetPage?.id}/>:selected?<AssetPreview asset={selected} large/>:<div className="background-composer-empty">生成结果将在这里预览</div>}</div>
   <p className="muted">{work?'预览会保留完整页面；点击“采用这张背景”后才替换当前作品。':'确认采用后更新这次创作结果。'}</p>
   {versions.length>0&&<div className="background-versions" aria-label="背景版本">{versions.map((a,i)=><Button size="sm" key={a.id} aria-pressed={selection===a.id} onClick={()=>{setSelection(a.id);setPrompt(a.package?.params.userPrompt||a.package?.prompt||prompt);}}>版本 {i+1}{run.backgroundAssetId===a.id?' · 已采用':''}</Button>)}</div>}
   <label htmlFor="background-prompt">画面描述</label>
   <textarea id="background-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={1500} rows={4}/>
   <div className="background-generation-actions"><small>可修改描述重新生成；每次保留新版本，当前支持整图重生成。</small><Button disabled={busy||!!unresolved||!prompt.trim()} onClick={generate}>{busy?<><LoaderCircle size={15} className="spinner"/>正在生成</>:versions.length?'生成新版本':'生成预览'}</Button></div>
   {busy&&<p role="status">正在生成背景，可以关闭窗口，稍后继续查看。</p>}
   {draft?.status==='failed'&&<div className="background-generation-error" role="alert"><p>{draft.error}</p>{draft.retryable&&<Button size="sm" onClick={()=>void advanceBackground(runId)}><RotateCcw size={14}/>恢复查询原任务</Button>}</div>}
  </div>
 </Modal>;
}
