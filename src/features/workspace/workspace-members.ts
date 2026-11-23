import { isWorkspace } from '../../domain/workspaces';

export type DemoMemberRole = 'owner' | 'editor' | 'viewer';
export type DemoMember = { id: string; name: string; role: DemoMemberRole; status: 'member' | 'invited' };
export const demoRoleLabels: Record<DemoMemberRole, string> = { owner: '负责人', editor: '编辑者', viewer: '查看者' };
export const initialDemoMembers = (): DemoMember[] => [{ id: 'self', name: '纪鸣', role: 'owner', status: 'member' }];

export function memberStorageKey(workspaceId: string): string {
  if (workspaceId === 'personal' || !isWorkspace(workspaceId)) throw new Error('请选择项目共创空间');
  return `zhichuang.demo-members.v1.${workspaceId}`;
}

function validateInviteRole(role: string): asserts role is 'editor' | 'viewer' {
  if (role !== 'editor' && role !== 'viewer') throw new Error('请选择编辑者或查看者');
}

export function addDemoInvitation(members: DemoMember[], inputName: string, role: string, id: string): DemoMember[] {
  const name = inputName.trim();
  validateInviteRole(role);
  if (!name || name.length > 40) throw new Error('请填写 1–40 个字的成员名称');
  if (!id || members.some(member => member.id === id || member.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('该成员已存在，请勿重复添加');
  return [...members, { id, name, role, status: 'invited' }];
}

function ensureEditableMember(members: DemoMember[], id: string) {
  const member = members.find(item => item.id === id);
  if (!member) throw new Error('未找到该成员');
  if (member.role === 'owner' || member.id === 'self') throw new Error('演示中不能更改或移除负责人');
}

export function changeDemoRole(members: DemoMember[], id: string, role: string): DemoMember[] {
  ensureEditableMember(members, id);
  validateInviteRole(role);
  return members.map(member => member.id === id ? { ...member, role } : member);
}

export function removeDemoMember(members: DemoMember[], id: string): DemoMember[] {
  ensureEditableMember(members, id);
  return members.filter(member => member.id !== id);
}

export function parseDemoMembers(raw: string | null): DemoMember[] {
  if (!raw) return initialDemoMembers();
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return initialDemoMembers();
    return data.reduce<DemoMember[]>((members, item: unknown) => {
      if (!item || typeof item !== 'object') return members;
      const value = item as Partial<DemoMember>;
      if (value.id === 'self' || typeof value.id !== 'string' || typeof value.name !== 'string' || value.status !== 'invited') return members;
      try { return addDemoInvitation(members, value.name, value.role || '', value.id); }
      catch { return members; }
    }, initialDemoMembers());
  } catch { return initialDemoMembers(); }
}

export function demoInvitationText(workspaceName: string, member: DemoMember): string {
  return `【本地演示邀请说明】\n项目空间：${workspaceName}\n成员：${member.name}\n角色：${demoRoleLabels[member.role]}\n此信息仅用于演示成员管理，未发送真实邀请，不能用于加入空间。`;
}
