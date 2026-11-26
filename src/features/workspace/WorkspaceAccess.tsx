import {useLayoutEffect,type ReactNode} from 'react';
import {Navigate,useNavigate,useParams} from 'react-router-dom';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit,workspaceRole} from '../../domain/workspace-management';
import {Button,EmptyState} from '../../components/ui';

/** Local prototype access boundary; service-side authorization remains a separate integration. */
export function WorkspaceCreationAccess({children}:{children:ReactNode}){
 const state=useStudio(),navigate=useNavigate(),{id}=useParams();
 const run=id?state.runs.find(item=>item.id===id):undefined;
 const thread=state.creationSessions?.find(s=>s.id===id);
 const workspaceId=thread?.workspaceId||(run?(run.workspaceId||'personal'):state.activeWorkspaceId);
 const space=state.workspaces.find(item=>item.id===workspaceId);
 // Align a deep link on entry; an explicit space switch must be free to leave this task.
 useLayoutEffect(()=>{if((run||thread)&&workspaceRole(state,workspaceId)&&state.activeWorkspaceId!==workspaceId)state.setWorkspace(workspaceId);},[run?.id,thread?.id,workspaceId]);
 if(!workspaceRole(state,workspaceId))return <Navigate to="/projects" replace/>;
 if(!workspaceCanEdit(state,workspaceId))return <EmptyState title={space?.archivedAt?'当前空间已归档':'当前空间为只读'} description={space?.archivedAt?'作品与共享资料已保留，可以浏览和预览。继续创作需由负责人恢复空间。':'你以查看者身份浏览，可以查看作品和体验成果。创作内容请联系负责人调整权限，或切换到个人空间。'} action={<Button onClick={()=>{state.setWorkspace(workspaceId);navigate('/projects')}}>查看作品</Button>}/>;
 return children;
}
export function WorkspaceWorkAccess({children,preview=false}:{children:ReactNode;preview?:boolean}){
 const {id}=useParams(),state=useStudio();const work=state.works.find(w=>w.id===id);
 const workspaceId=work?.workspaceId||'personal',role=work?workspaceRole(state,workspaceId):undefined;
 useLayoutEffect(()=>{if(work&&role&&state.activeWorkspaceId!==workspaceId)state.setWorkspace(workspaceId);},[work?.id,workspaceId,role]);
 if(!work)return children;
 if(!role)return <Navigate to="/projects" replace/>;
 if(!preview&&!workspaceCanEdit(state,work.workspaceId||'personal'))return <Navigate to={`/preview/${work.id}`} replace/>;
 return children;
}
