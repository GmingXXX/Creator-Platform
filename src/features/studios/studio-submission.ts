import {useStudio} from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import type {Work} from '../../domain/types';

function editableWork(id:string):Work {
 const state=useStudio.getState(),work=state.works.find(item=>item.id===id&&!item.deletedAt);
 if(!work)throw new Error('当前作品已不存在，请返回作品列表。');
 if(!workspaceCanEdit(state,work.workspaceId||'personal'))throw new Error('当前空间没有编辑和投稿权限。');
 return work;
}

// Flush the editor first so the review dialog reflects its latest local edits.
export function prepareStudioSubmission(id:string,save:()=>boolean|void):Work|undefined {
 editableWork(id);
 if(save()===false)return undefined;
 return structuredClone(editableWork(id));
}
