import {useEffect,useRef,useState} from 'react';
import type {Run} from '../../domain/types';
import type {AIPlan} from '../../domain/ai-plan';
import {confirmExhibitPlan} from '../../domain/exhibit-review';
import {visualGenerationPrompt} from '../../domain/visual-guidelines';
import {useStudio} from '../../domain/store';
import {assetAvailableForInsertion} from '../../domain/asset-access';
import {Button} from '../../components/ui';
import {AssetReview} from './AssetReview';
import {generateReviewImage} from './generation-materials';
import type {RunActivity} from './RunProgress';
import '../../styles/creation-review.css';
type Section=NonNullable<AIPlan['sections']>[number];
const imageDescription=(section:Section)=>section.imagePrompt??`为企业事件「${section.title}」制作概念插画。内容参考：${section.body.slice(0,1100)}。不重绘客户照片，不呈现未经提供的真实厂房或人物。`;
export function ExhibitPlanReview({run,onActivity}:{run:Run;onActivity?:(activity?:RunActivity)=>void}){
 const studio=useStudio(),[plan,setPlan]=useState(run.aiPlan!),[error,setError]=useState('');
 const [busySlots,setBusySlots]=useState<Record<number,boolean>>({}),[autoImages,setAutoImages]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const controller=useRef<AbortController|null>(null),mounted=useRef(true),working=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();}},[]);
 useEffect(() => {
  if (!busy || !onActivity) return;
  onActivity({step: 2, label: progress || '正在确认内容与配图'});
  return () => onActivity();
 }, [busy, progress, onActivity]);
 const images=studio.assets.filter(a=>a.kind==='image'&&assetAvailableForInsertion(a,run.workspaceId));
 const persist=(next:AIPlan)=>{setPlan(next);studio.updateRun(run.id,{aiPlan:next});};
 const update=(index:number,patch:Partial<Section>)=>persist({...plan,sections:plan.sections?.map((s,i)=>i===index?{...s,...patch}:s)});
 const missing=plan.sections?.filter(section=>!section.imageAssetId).length||0;
 const confirm=async()=>{
  if(working.current||Object.values(busySlots).some(Boolean))return;
  working.current=true;setBusy(true);setError('');
  const abort=new AbortController();controller.current=abort;let next=structuredClone(plan);
  try{
   // Check before making any paid request. Existing customer pictures are preserved.
   confirmExhibitPlan(next,run.attachmentIds,useStudio.getState().assets,run.workspaceId||'personal');
   if(autoImages){
    for(let index=0;index<(next.sections?.length||0);index++){
     const section=next.sections![index];if(section.imageAssetId)continue;
     setProgress(`正在生成事件 ${index+1} 的概念配图，已完成的素材会保留…`);
     const asset=await generateReviewImage({prompt:visualGenerationPrompt(imageDescription(section),studio.systems.find(s=>s.id===run.styleId)),workspaceId:run.workspaceId||'personal',styleId:run.styleId,requestKey:`${run.id}:event:${index}`,signal:abort.signal});
     if(abort.signal.aborted||!mounted.current)return;
     next={...next,sections:next.sections!.map((item,i)=>i===index?{...item,imageAssetId:asset.id}:item)};persist(next);
    }
   }
   const checked=confirmExhibitPlan(next,run.attachmentIds,useStudio.getState().assets,run.workspaceId||'personal');
   if(!abort.signal.aborted)studio.updateRun(run.id,{...checked,structureConfirmed:true,status:'running',step:2});
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'请核对内容');}
  finally{working.current=false;if(mounted.current){setBusy(false);setProgress('');}}
 };
 return <div className="creation-review creation-review--exhibit"><header><h2>确认内容与配图</h2><p>核对事件、顺序与配图。客户图片会保留；缺少的画面可以生成概念插画，也可以暂不配图。</p></header>
 <fieldset disabled={busy||Object.values(busySlots).some(Boolean)} className="creation-review-fields"><label>作品标题<input aria-label="确认作品标题" value={plan.title||''} maxLength={80} onChange={e=>persist({...plan,title:e.target.value})}/></label>
 <div className="creation-review-list">{plan.sections?.map((s,i)=><article key={i}><span>{String(i+1).padStart(2,'0')}</span><div><div className="creation-review-row"><input aria-label={`事件${i+1}年份`} value={s.year||''} maxLength={20} onChange={e=>update(i,{year:e.target.value})}/><input aria-label={`事件${i+1}标题`} value={s.title} maxLength={100} onChange={e=>update(i,{title:e.target.value})}/></div><textarea aria-label={`事件${i+1}详情`} rows={3} maxLength={1500} value={s.body} onChange={e=>update(i,{body:e.target.value})}/>{!s.imageAssetId&&<details><summary>配图生成描述</summary><textarea aria-label={`事件${i+1}配图描述`} rows={3} maxLength={1500} value={imageDescription(s)} onChange={e=>update(i,{imagePrompt:e.target.value})}/></details>}<AssetReview value={images.find(a=>a.id===s.imageAssetId)} workspaceId={run.workspaceId||'personal'} styleId={run.styleId} prompt={imageDescription(s)} requestKey={`${run.id}:event:${i}`} onChange={asset=>update(i,{imageAssetId:asset.id})} onBusy={value=>setBusySlots(old=>old[i]===value?old:{...old,[i]:value})}/>{s.imageAssetId&&<Button size="sm" onClick={()=>update(i,{imageAssetId:undefined})}>移除配图</Button>}</div></article>)}</div>
 {!!missing&&<label className="creation-review-auto"><input type="checkbox" checked={autoImages} onChange={event=>setAutoImages(event.target.checked)}/>自动补齐 {missing} 张概念配图，再生成作品</label>}</fieldset>
 <footer className="creation-review-footer">
  {error&&<p className="res-error" role="alert">{error}</p>}
  <Button variant="primary" disabled={busy||Object.values(busySlots).some(Boolean)} onClick={()=>void confirm()}>{busy?'正在生成素材…':'确认内容，继续生成'}</Button>
 </footer>
 </div>;
}
