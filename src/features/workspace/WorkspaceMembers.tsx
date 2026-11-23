import { useState } from 'react';
import { Copy, Trash2, UsersRound } from 'lucide-react';
import { Badge, Button, Modal, toast } from '../../components/ui';
import { useStudio } from '../../domain/store';
import { workspaceCanManage, workspaceRole } from '../../domain/workspace-management';
import { demoRoleLabels } from './workspace-members';
import '../../styles/workspace-members.css';

type Props = { workspaceId: string; workspaceName: string; open: boolean; onClose: () => void };

export function WorkspaceMembers({ workspaceId, workspaceName, open, onClose }: Props) {
  return <Modal open={open} onClose={onClose} title={`${workspaceName} · 成员与共享`} description="邀请空间成员，设置编辑或查看权限。" footer={<Button onClick={onClose}>完成</Button>}>
    {open && <WorkspaceMembersPanel key={workspaceId} workspaceId={workspaceId} workspaceName={workspaceName}/>}
  </Modal>;
}

export function WorkspaceMembersPanel({ workspaceId, workspaceName }: Pick<Props, 'workspaceId' | 'workspaceName'>) {
  const state = useStudio();
  const members = state.workspaceMembers[workspaceId] || [];
  const canManage = workspaceCanManage(state, workspaceId);
  const actorId = state.workspaceActors[workspaceId] || 'self';
  const actorRole = workspaceRole(state, workspaceId);
  const [account, setAccount] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [error, setError] = useState('');
  const [transferId, setTransferId] = useState<string | null>(null);
  const transferMember = members.find(member => member.id === transferId && member.status === 'member' && member.role !== 'owner');
  const archived = Boolean(state.workspaces.find(space => space.id === workspaceId)?.archivedAt);
  const transfer = () => {
    if (!transferMember) return;
    perform(() => {
      state.transferWorkspaceOwnership(workspaceId, transferMember.id);
      setTransferId(null);
      toast('负责人已转让，原负责人调整为编辑者');
    });
  };
  const perform = (action: () => void) => {
    try { action(); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作未完成，请重试。'); }
  };
  const invite = () => perform(() => {
    state.inviteWorkspaceMember(workspaceId, account, role);
    setAccount('');
    toast('已添加待加入成员；当前为本地邀请演示');
  });
  const copy = async (name: string, memberRole: 'owner' | 'editor' | 'viewer') => {
    try {
      await navigator.clipboard.writeText(`【本地演示邀请说明】\n项目空间：${workspaceName}\n账号或邮箱：${name}\n权限：${demoRoleLabels[memberRole]}\n此信息仅用于演示，未发送真实邀请，不能用于在其他账号或设备加入空间。`);
      toast('已复制本地演示邀请说明');
    } catch { toast('浏览器未允许复制，请检查剪贴板权限', true); }
  };
  return <div className="workspace-members">
      <div className="workspace-members-notice"><Badge>本地协作演示</Badge><p>成员与权限保存在当前浏览器。不会发送真实邀请或同步其他成员的编辑，可模拟加入并体验不同角色。</p></div>
      {canManage ? <form className="workspace-invite-form" onSubmit={event => { event.preventDefault(); invite(); }}>
        <label>账号或邮箱<input value={account} onChange={event => { setAccount(event.target.value); setError(''); }} placeholder="输入成员账号或邮箱" maxLength={120} /></label>
        <label>邀请权限<select value={role} onChange={event => setRole(event.target.value as 'editor' | 'viewer')}><option value="editor">编辑者</option><option value="viewer">查看者</option></select></label>
        <Button type="submit" variant="primary">邀请成员</Button>
      </form> : <p className="workspace-role-note">{archived ? '空间已归档，成员与权限仅供查看；恢复使用后可修改。' : <>当前以{actorRole ? demoRoleLabels[actorRole] : '无权限'}身份浏览，只有负责人可以邀请成员和设置权限。</>}</p>}
      {error && <p className="workspace-members-error" role="alert">{error}</p>}
      <div className="workspace-member-list" aria-label="空间成员">
        {members.map(member => <div className="workspace-member-row" key={member.id}>
          <div className="workspace-member-main">
            <span className="workspace-member-avatar"><UsersRound size={16} /></span>
            <div className="workspace-member-identity"><strong>{member.name}{member.id === actorId && '（当前身份）'}</strong><small>{member.status === 'invited' ? '待加入 · 本地邀请' : '已加入'}{member.account !== member.name && ` · ${member.account}`}</small></div>
            {member.role === 'owner' || !canManage ? <span className="workspace-owner-label">{demoRoleLabels[member.role]}</span> : <select aria-label={`${member.name}的权限`} value={member.role} onChange={event => perform(() => state.changeWorkspaceMemberRole(workspaceId, member.id, event.target.value as 'editor' | 'viewer'))}><option value="editor">编辑者</option><option value="viewer">查看者</option></select>}
          </div>
          {canManage && member.role !== 'owner' && <div className="workspace-member-actions">
            {member.status === 'member' && <Button size="sm" variant="ghost" aria-label={`转让负责人给${member.name}`} onClick={() => {setTransferId(member.id);setError('');}}>转让负责人</Button>}
            {member.status === 'invited' && <><Button size="sm" onClick={() => perform(() => state.acceptWorkspaceInvitation(workspaceId, member.id))} aria-label={`模拟${member.name}接受邀请`}>模拟接受邀请</Button><Button size="icon" variant="ghost" aria-label={`复制${member.name}的模拟邀请说明`} title="复制模拟邀请说明" onClick={() => copy(member.account, member.role)}><Copy size={14} /></Button></>}
            <Button size="icon" variant="ghost" aria-label={member.status === 'invited' ? `撤销${member.name}的邀请` : `移除${member.name}`} title={member.status === 'invited' ? '撤销邀请' : '移除成员'} onClick={() => perform(() => state.removeWorkspaceMember(workspaceId, member.id))}><Trash2 size={14} /></Button>
          </div>}
        </div>)}
      </div>
      {canManage && transferMember && <div className="workspace-transfer-confirm" role="alert">
        <strong>将负责人转让给「{transferMember.name}」？</strong>
        <p>对方将可管理空间、成员、知识本地场绑定及删除空间；你将调整为编辑者，无法继续管理这些设置。</p>
        <div><Button size="sm" onClick={() => setTransferId(null)}>取消转让</Button><Button size="sm" variant="primary" onClick={transfer}>确认转让</Button></div>
      </div>}
      <details className="workspace-permission-preview" open={actorId !== 'self' || undefined}>
        <summary>本地权限体验</summary>
        <p>选择已加入的成员，体验其操作权限。此操作仅切换本地演示身份，不是账号登录。</p>
        <label>体验成员身份<select value={actorId} onChange={event => perform(() => state.setWorkspaceActor(workspaceId, event.target.value))}>{members.filter(member => member.status === 'member').map(member => <option key={member.id} value={member.id}>{member.name} · {demoRoleLabels[member.role]}</option>)}</select></label>
      </details>
      <div className="workspace-sharing-notes"><h3>权限与共享范围</h3><p><strong>负责人：</strong>管理空间、成员与全部作品。<strong>编辑者：</strong>创作作品和管理共享素材。<strong>查看者：</strong>浏览和预览，不可修改。</p><p><strong>个人素材与 Skills：</strong>仍属于个人，不会因加入空间而公开。</p><p><strong>空间采用的资源：</strong>以固定版本副本随空间共享，个人原件后续修改不会影响空间中的作品。</p></div>
    </div>;
}
