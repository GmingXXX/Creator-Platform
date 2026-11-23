import {useState} from 'react';
import {Share2} from 'lucide-react';
import {Button,toast} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import type {Work} from '../../domain/types';
import {SubmissionDialog} from '../resources/Shared';
import {prepareStudioSubmission} from './studio-submission';

export function StudioSubmissionAction({work,onSave}:{work:Work;onSave:()=>boolean|void}) {
 const [snapshot,setSnapshot]=useState<Work>();
 const editable=useStudio(state=>workspaceCanEdit(state,work.workspaceId||'personal'));
 const open=()=>{
  try{const next=prepareStudioSubmission(work.id,onSave);if(next)setSnapshot(next);}
  catch(error){toast(error instanceof Error?error.message:'无法准备投稿，请重试。');}
 };
 return <><Button disabled={!editable} onClick={open}><Share2 size={14}/>分享投稿</Button>{snapshot&&<SubmissionDialog work={snapshot} onClose={()=>setSnapshot(undefined)}/>}</>;
}
