import { describe, expect, it } from 'vitest';
import { addDemoInvitation, changeDemoRole, demoInvitationText, initialDemoMembers, memberStorageKey, parseDemoMembers, removeDemoMember } from '../src/features/workspace/workspace-members';

describe('local workspace membership demonstration', () => {
  it('starts with only the real current owner and never invents online members', () => {
    expect(initialDemoMembers()).toEqual([{ id: 'self', name: '纪鸣', role: 'owner', status: 'member' }]);
  });
  it('adds an immutable, explicitly simulated invitation', () => {
    const before = initialDemoMembers();
    const after = addDemoInvitation(before, '  王设计  ', 'editor', 'invite-1');
    expect(before).toHaveLength(1);
    expect(after[1]).toEqual({ id: 'invite-1', name: '王设计', role: 'editor', status: 'invited' });
  });
  it('rejects empty or oversized names, duplicate identities, and invalid roles', () => {
    const before = initialDemoMembers();
    for (const name of ['', '  ', 'x'.repeat(41), '纪鸣']) expect(() => addDemoInvitation(before, name, 'viewer', 'a')).toThrow();
    expect(() => addDemoInvitation(before, '小张', 'owner', 'a')).toThrow();
    expect(() => addDemoInvitation(before, '小张', 'viewer', 'self')).toThrow();
  });
  it('keeps the owner fixed while permitting invite role changes and removal', () => {
    const before = addDemoInvitation(initialDemoMembers(), '小张', 'editor', 'invite-1');
    expect(() => changeDemoRole(before, 'self', 'viewer')).toThrow();
    expect(() => removeDemoMember(before, 'self')).toThrow();
    expect(changeDemoRole(before, 'invite-1', 'viewer')[1].role).toBe('viewer');
    expect(before[1].role).toBe('editor');
    expect(removeDemoMember(before, 'invite-1')).toEqual(initialDemoMembers());
  });
  it('isolates storage by existing shared workspace and rejects unknown spaces', () => {
    expect(memberStorageKey('xintai')).not.toBe(memberStorageKey('dongguan'));
    expect(() => memberStorageKey('personal')).toThrow();
    expect(() => memberStorageKey('not-a-workspace')).toThrow();
  });
  it('validates persisted membership data and always preserves the real owner', () => {
    expect(parseDemoMembers('{bad')).toEqual(initialDemoMembers());
    expect(parseDemoMembers(JSON.stringify([{ id: 'self', name: '伪造', role: 'viewer', status: 'member' }]))).toEqual(initialDemoMembers());
    const members = addDemoInvitation(initialDemoMembers(), '小张', 'viewer', 'invite-1');
    expect(parseDemoMembers(JSON.stringify(members))).toEqual(members);
    expect(parseDemoMembers(JSON.stringify([{ id: 'x', name: '小张', role: 'owner', status: 'member' }]))).toEqual(initialDemoMembers());
  });
  it('copied invitation information clearly states it cannot grant access', () => {
    const invitation = addDemoInvitation(initialDemoMembers(), '小张', 'viewer', 'invite-1')[1];
    expect(demoInvitationText('信泰企业展厅', invitation)).toContain('本地演示');
    expect(demoInvitationText('信泰企业展厅', invitation)).toContain('不能用于加入空间');
    expect(demoInvitationText('信泰企业展厅', invitation)).toContain('查看者');
  });
});
