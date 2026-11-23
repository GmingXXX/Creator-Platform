import {useState} from 'react';
import {ChevronDown,Check,ClipboardCheck} from 'lucide-react';
import {Button,Modal,Popover} from '../../components/ui';
import {productionStages,productionStageOf,withProductionStage,deliveryChecks,reviewedDeliveryChecks,type ProductionStage} from '../../domain/production-stage';
import type {Work} from '../../domain/types';
import './production-stage.css';
export function DraftStageControl({value,onChange,disabled=false}:{value?:ProductionStage;onChange:(stage:ProductionStage)=>void;disabled?:boolean}){
 const stage=value||'presales';
 return <Popover trigger={<button type="button" className="composer-tool production-stage-trigger" disabled={disabled} aria-label="制作阶段"><span>{productionStages[stage].label}</span><ChevronDown size={13}/></button>}>
  <div className="menu-caption">制作阶段</div>{(['presales','delivery'] as const).map(key=><button type="button" key={key} className="option-row" data-popover-close disabled={disabled} onClick={()=>onChange(key)}><span>{productionStages[key].label}<small>{productionStages[key].description}</small></span>{key===stage&&<Check size={15}/>}</button>)}
 </Popover>;
}
export function WorkStageControl({work,onChange,disabled=false}:{work:Work;onChange:(work:Work)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[checks,setChecks]=useState<string[]>([]);
 const stage=productionStageOf(work),items=deliveryChecks(work),reviewed=reviewedDeliveryChecks(work);
 return <span className="work-stage-controls"><DraftStageControl value={stage} disabled={disabled} onChange={next=>onChange(withProductionStage(work,next))}/>
  {stage==='delivery'&&<Button disabled={disabled} onClick={()=>{setChecks(reviewed);setOpen(true);}}><ClipboardCheck size={14}/>交付检查 {reviewed.length}/{items.length}</Button>}
  <Modal open={open} onClose={()=>setOpen(false)} title="交付检查" description="由制作人员确认当前版本。修改作品并保存后，需要重新核对。" footer={<><Button onClick={()=>setOpen(false)}>取消</Button><Button variant="primary" disabled={disabled} onClick={()=>{onChange({...work,deliveryReview:{revision:work.revision+1,checks:[...checks]}});setOpen(false);}}>保存检查记录</Button></>}>
   <div className="delivery-checklist">{items.map(item=><label key={item.id}><input type="checkbox" checked={checks.includes(item.id)} onChange={e=>setChecks(current=>e.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/>{item.label}</label>)}<p>勾选记录为人工确认，不代表平台已自动完成检测。</p></div>
  </Modal>
 </span>;
}
