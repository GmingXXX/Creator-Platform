import {useState} from 'react';
import {FolderInput} from 'lucide-react';
import type {Work} from '../../domain/types';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {previewWorkTransfer} from '../../domain/workspace-transfer';
import {Button,Modal,toast} from '../../components/ui';

export function MoveWorkDialog({work,onClose,onMoved}:{work:Work;onClose:()=>void;onMoved:()=>void}){
 const state=useStudio(),spaces=state.workspaces.filter(space=>space.id!=='personal'&&workspaceCanEdit(state,space.id));
 const [target,setTarget]=useState(''),[error,setError]=useState('');
 let preview:ReturnType<typeof previewWorkTransfer>|undefined,problem='';
 if(target)try{preview=previewWorkTransfer(state,work.id,target);}catch(cause){problem=cause instanceof Error?cause.message:'暂时无法移动，请重试。';}
 const move=()=>{
  try{state.moveWorkToWorkspace(work.id,target);toast('作品及相关制作记录已移动到项目空间');onClose();onMoved();}
  catch(cause){setError(cause instanceof Error?cause.message:'移动失败，原作品已保留。');}
 };
 return <Modal open onClose={onClose} title="移动到项目空间" description="将作品和相关制作上下文归入一个项目空间。" footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!preview||!!problem} onClick={move}><FolderInput size={15}/>确认移动</Button></>}>
  <div className="res-form">
   <p>当前作品：<strong>{work.title}</strong></p>
   <label>目标项目空间<select aria-label="目标项目空间" value={target} onChange={event=>{setTarget(event.target.value);setError('');}}><option value="">请选择项目空间</option>{spaces.map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
   {!spaces.length&&<p className="res-muted">暂无可编辑的项目空间，请先创建项目空间或获得编辑权限。</p>}
   {preview&&<section aria-label="随迁内容" className="res-soft-panel"><h3>随迁内容</h3><p>当前工程、版本与制作经验；{preview.runsCount} 项关联任务、{preview.turnsCount} 条修改记录。</p><p>需复制 {preview.assetsToCopy.length} 项依赖素材，保留来源及固定版本。</p>{preview.warnings.map(text=><p key={text}>{text}</p>)}<p>无关个人草稿、对话和素材不会迁移。移动后进入目标项目空间，继续使用该空间上下文。</p></section>}
   {(error||problem)&&<p role="alert" className="res-error">{error||problem}</p>}
  </div>
 </Modal>;
}
