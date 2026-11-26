import {useState} from 'react';
import {DeliveryReview} from '../editor/ProjectAppearance';
import {ArrowUpRight,Play,Save} from 'lucide-react';
import {Button,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import type {Work} from '../../domain/types';
import {workspaceCanEdit} from '../../domain/workspace-management';
import {getProjectCategory} from '../../domain/project-taxonomy';
import {workRoute} from '../AppShell';

export function ResultWorkActions({work,onOpen}:{work:Work;onOpen:(destination:string)=>void}){
 const [confirmedRevision,setConfirmedRevision]=useState<number|null>(null);
 const canSave=useStudio(state=>workspaceCanEdit(state,work.workspaceId||'personal'));
 const save=()=>{
  try{
   const state=useStudio.getState(),latest=state.works.find(item=>item.id===work.id);
   if(!latest||latest.deletedAt)throw new Error('作品已不可用，请前往作品库查看或恢复后再保存。');
   setConfirmedRevision(latest.revision);
   const space=useStudio.getState().workspaces.find(item=>item.id===(latest.workspaceId||'personal'));
   toast(`已保存至「${space?.name||'个人空间'}」的作品库`);
  }catch(error){toast(error instanceof Error?error.message:'保存失败，请重试。',true);}
 };
 return <>
  <DeliveryReview work={work} disabled={!canSave} onChange={next=>{try{useStudio.getState().saveWork(next);}catch(error){toast(error instanceof Error?error.message:'无法保存交付检查',true);}}}/>
  <Button onClick={()=>onOpen(`/projects?category=${getProjectCategory(work)}`)}>前往作品库</Button>
  <Button onClick={()=>onOpen(`/preview/${work.id}`)}><Play size={15}/>运行预览</Button>
  <Button onClick={()=>onOpen(workRoute(work))}>继续编辑<ArrowUpRight size={15}/></Button>
  <Button variant="primary" disabled={!canSave||confirmedRevision===work.revision} title={canSave?'保存当前成果，无需进入编辑器':'当前空间只读，无法保存修改'} onClick={save}><Save size={15}/>{confirmedRevision===work.revision?'已保存':'确认并保存'}</Button>
 </>;
}
