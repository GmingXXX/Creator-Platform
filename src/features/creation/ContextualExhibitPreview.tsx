import {useState} from 'react';
import {Button,toast} from '../../components/ui';
import {advanceBackground,applyBackground} from '../../domain/background-generation';
import {useStudio} from '../../domain/store';
import type {Run,Work} from '../../domain/types';
import {CurrentWorkPreview} from '../conversation/CurrentWorkPreview';

export function ContextualExhibitPreview({work,run,pageId}:{work:Work;run:Run;pageId?:string}) {
  const draft=run.backgroundDraft;
  const asset=useStudio(state=>state.assets.find(a=>a.id===draft?.assetId&&!a.deletedAt));
  const [originalRequest,setOriginalRequest]=useState('');
  const page=draft?.targetWorkId===work.id?work.pages.find(p=>p.id===draft.targetPageId):undefined;
  if(!draft||!page||page.id!==pageId&&pageId!==undefined)return <CurrentWorkPreview work={work} pageId={pageId}/>;
  const candidate=draft.status==='ready'&&asset;
  const adopted=candidate&&page.backgroundAssetId===candidate.id;
  const compare=candidate&&!adopted&&originalRequest!==draft.requestId;
  const preview=compare?{...work,pages:work.pages.map(p=>p.id===page.id?{...p,backgroundImage:candidate.src,backgroundAssetId:candidate.id}:p)}:work;
  const adopt=()=>{
    if(!candidate)return;
    try{applyBackground(run.id,candidate.id);toast('已采用新背景');}
    catch(error){toast(error instanceof Error?error.message:'未能采用背景',true);}
  };
  return <>
    <CurrentWorkPreview work={preview} pageId={page.id}/>
    <div className="exhibit-background-comparison">
      <span role="status">{draft.status==='pending'?'正在生成背景':draft.status==='failed'?'背景生成失败':adopted?'已采用新背景':!candidate?'候选素材已不可用':compare?'新背景预览':'原背景'} · {page.name}</span>
      {candidate&&!adopted&&<><Button size="sm" aria-pressed={!compare} onClick={()=>setOriginalRequest(compare?draft.requestId:'')}>{compare?'查看原背景':'预览新背景'}</Button><Button size="sm" variant="primary" onClick={adopt}>采用这张背景</Button></>}
      {draft.status==='failed'&&<span role="alert">{draft.error} {draft.retryable&&<Button size="sm" onClick={()=>void advanceBackground(run.id)}>恢复查询</Button>}</span>}
    </div>
  </>;
}
