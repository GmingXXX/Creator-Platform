import type {StudioData} from './types';

/** Task-owned project metadata, never the currently browsed workspace or a whole asset library. */
export function taskWorkspaceContext(state:Pick<StudioData,'workspaces'|'workspaceKnowledge'>,workspaceId='personal') {
 const space=state.workspaces.find(item=>item.id===workspaceId);
 if(!space)throw new Error('任务所属空间已不可用，请重新打开作品。');
 const binding=state.workspaceKnowledge[workspaceId];
 return {id:space.id,name:space.name,description:space.description,
  knowledge:{configured:Boolean(binding),retrieved:false,note:'仅依据本次提供的资料与工程记录；知识本地场尚未接通检索，不声称已读取空间全部资料。'},
  constraint:'本次事实以此空间及明确提供的资料为准；其他展项仅用于指定的结构、交互或视觉参考。'};
}
