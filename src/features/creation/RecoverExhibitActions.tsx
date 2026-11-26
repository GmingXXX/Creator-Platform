import {useState} from 'react';
import {Button, Modal, toast} from '../../components/ui';
import {findRecoverableExhibit, returnToExhibit} from '../../domain/session-artifact-recovery';
import {useStudio} from '../../domain/store';
import {CurrentWorkPreview} from '../conversation/CurrentWorkPreview';

export function RecoverExhibitActions({sessionId}: {sessionId: string}) {
  const match = findRecoverableExhibit(useStudio(), sessionId);
  const [previewPageId, setPreviewPageId] = useState<string>();
  if (!match) return null;
  const {source, work, image, canAdopt} = match;
  const page = work.pages.find(item => item.id === previewPageId);
  const preview = page && {...work, pages: work.pages.map(item => item.id === page.id ? {...item, backgroundImage: image.src, backgroundAssetId: image.id} : item)};
  function restore(pageId?: string) {
    try {
      returnToExhibit(sessionId, source.id, image.id, pageId);
      setPreviewPageId(undefined);
      toast(pageId ? '已采用背景并回到原展项' : '已回到原展项，图片已保留在素材库');
    } catch (error) {
      toast(error instanceof Error ? error.message : '暂时无法返回展项', true);
    }
  }
  return <>
    <Button onClick={() => restore()}>回到原展项</Button>
    {canAdopt && <Button onClick={() => setPreviewPageId(work.pages[0].id)}>在原展项试用此图</Button>}
    <Modal open={!!preview} onClose={() => setPreviewPageId(undefined)} title={`试用背景 · ${work.title}`} wide footer={<>
      <Button onClick={() => setPreviewPageId(undefined)}>取消</Button>
      <Button variant="primary" disabled={!page} onClick={() => restore(page?.id)}>采用背景并回到展项</Button>
    </>}>
      {page && preview && <div className="background-composer">
        {work.pages.length > 1 && <label>试用页面 <select value={page.id} onChange={event => setPreviewPageId(event.target.value)}>{work.pages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <div className="background-composer-preview" style={{width:'100%', maxWidth:360 * work.width / work.height, justifySelf:'center'}}><CurrentWorkPreview work={preview} pageId={page.id}/></div>
      </div>}
    </Modal>
  </>;
}
