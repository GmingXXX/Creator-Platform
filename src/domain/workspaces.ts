export interface Workspace { id: string; name: string; description: string; color: string; archivedAt?:string; deletedAt?:string; purgedAt?:string }
/** Demo seeds only. Persisted spaces live in StudioData.workspaces. */
export const workspaces: readonly Workspace[] = [
  {id: 'personal', name: '个人空间', description: '我的草稿与创作素材', color: '#66666f'},
  {id: 'xintai', name: '信泰企业展厅', description: '项目创作空间', color: '#527786'},
  {id: 'dongguan', name: '东莞博物馆', description: '项目创作空间', color: '#94724e'},
  {id: 'aitown', name: 'ai小镇展厅', description: '项目创作空间', color: '#70688b'},
];
export const workspaceOf = (item: {workspaceId?: string}): string => item.workspaceId || 'personal';
export const isWorkspace = (id: string, spaces: readonly Workspace[] = workspaces): boolean => spaces.some(space => space.id === id&&!space.deletedAt&&!space.purgedAt);
