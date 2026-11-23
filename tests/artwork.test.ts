import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Artwork } from '../src/components/Artwork';
import { createSceneWork } from '../src/domain/scenes';

describe('saved artwork previews', () => {
  it('preserves a removed background and the actual component text color', () => {
    const initial = createSceneWork({ title: '文字保留', type: '关系图谱型', width: 1920, height: 1080 });
    const work = { ...initial, styleId: '', pages: initial.pages.map(page => ({ ...page, background: '#f7f4ee', backgroundImage: undefined, nodes: page.nodes.map(node => ({ ...node, color: '#302a23' })) })) };
    const html = renderToStaticMarkup(createElement(Artwork, { work }));
    expect(html).not.toContain('/media/industrial.svg');
    expect(html).toContain('fill="#f7f4ee"');
    expect(html).not.toContain('fill="#edf5fb"');
  });
  it('keeps an empty saved canvas empty instead of inventing sample content', () => {
    const initial = createSceneWork({ title: '空白作品', type: '时间演进型', width: 1080, height: 1920, blank: true });
    const work = { ...initial, pages: initial.pages.map(page => ({ ...page, background: '#ffffff', backgroundImage: undefined })) };
    const html = renderToStaticMarkup(createElement(Artwork, { work }));
    expect(html).toContain('viewBox="0 0 1080 1920"');
    expect(html).not.toContain('始于探索');
    expect(html).not.toContain('/media/industrial.svg');
  });
});
