import { useEffect, useRef, useState } from 'react';
import type { Work } from '../../domain/types';
import { SceneRenderer } from '../editor/SceneRenderer';

/** A scaled view of the saved scene, using the same renderer as the editor. */
export function CurrentWorkPreview({ work, pageId }: { work: Work; pageId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const scale = width / work.width;
  return <div ref={host} className="current-work-preview" aria-label="完整展项预览" style={{ aspectRatio: `${work.width}/${work.height}` }}>
    <div style={{ width: work.width, height: work.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      <SceneRenderer work={work} pageId={pageId} />
    </div>
  </div>;
}
