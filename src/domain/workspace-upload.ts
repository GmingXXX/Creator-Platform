import type {Asset} from './types';
import {useStudio} from './store';
import {importFile} from './upload';
import {workspaceCanEdit} from './workspace-management';
import {captureKnowledgeTarget,type KnowledgeTarget} from './workspace-knowledge';

function requireUploadPermission(workspaceId:string):void {
 if(!workspaceCanEdit(useStudio.getState(),workspaceId))throw new Error('当前成员没有此项目空间的上传权限，文件未添加。');
}

/** Local import only. The frozen target is routing provenance, never an ACP ingestion receipt. */
export async function importWorkspaceFile(file:File,workspaceId:string,knowledgeTarget?:KnowledgeTarget):Promise<Asset> {
 requireUploadPermission(workspaceId);
 const target=Object.freeze({...knowledgeTarget??captureKnowledgeTarget(useStudio.getState(),workspaceId)});
 if(target.workspaceId!==workspaceId)throw new Error('上传目标与项目空间归属不一致，请重新选择文件');
 const asset=await importFile(file);
 requireUploadPermission(workspaceId);
 return {...asset,workspaceId,knowledgeTarget:target};
}
