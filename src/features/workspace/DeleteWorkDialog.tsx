import { ArchiveRestore, Trash2 } from 'lucide-react';
import { Button, Modal, toast } from '../../components/ui';
import { useStudio } from '../../domain/store';
import type { Work } from '../../domain/types';

export function DeleteWorkDialog({ work, onClose, onDeleted }: { work: Work | null; onClose: () => void; onDeleted?: () => void }) {
  const deleteWork = useStudio(state => state.deleteWork);
  const contentCount = work?.kind === 'video' ? `${work.shots?.length || 0} 个分镜` : work?.kind === 'story' ? `${work.storyNodes?.length || 0} 个故事节点` : `${work?.pages.length || 0} 个页面`;
  return <Modal open={Boolean(work)} onClose={onClose} title="删除创作文件？" footer={<>
    <Button onClick={onClose}>取消</Button>
    <Button variant="danger" onClick={() => {
      if (work && deleteWork(work.id)) { toast('已移入作品回收站，可随时恢复'); onDeleted?.(); }
      onClose();
    }}><Trash2 size={14} />移入回收站</Button>
  </>}>
    <p className="lifecycle-delete-title">{work?.title}</p>
    <p className="lifecycle-description">这件作品会从作品列表和最近草稿中移除。它包含的 {contentCount}与可编辑工程会保留在回收站，可随时恢复。</p>
    <div className="lifecycle-preserve-note"><ArchiveRestore size={16} /><span>素材库中的文件、其他作品以及已发布的社区版本不受影响。</span></div>
  </Modal>;
}
