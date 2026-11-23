import {useStudio} from './store';
import {workspaceCanEdit} from './workspace-management';

/** Recheck the originating space after async work; switching spaces is not a transfer. */
export function canWriteAIWorkspace(workspaceId?:string):boolean {
 return workspaceCanEdit(useStudio.getState(),workspaceId||'personal');
}
export function assertAIWorkspaceWrite(workspaceId?:string):void {
 if(!canWriteAIWorkspace(workspaceId))throw new Error('当前成员没有此项目空间的编辑权限，生成或修改结果未写入。');
}
