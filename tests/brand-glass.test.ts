import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {BrandMark} from '../src/components/BrandMark';

describe('monochrome brand reveal', () => {
  const render = (animate: boolean) => renderToStaticMarkup(createElement(BrandMark, {animate}));

  it('uses the folded mark alone for the persistent navigation logo', () => {
    const markup = render(false);
    expect(markup).toContain('brand-fold-middle');
    expect(markup).not.toContain('brand-liquid-lens');
    expect(markup).not.toMatch(/#BACAFE|#F7F9FF/i);
  });

  it('refracts a second instance of the same silhouette inside the home lens', () => {
    const markup = render(true);
    expect(markup).toContain('brand-liquid-lens');
    expect(markup).toContain('<clipPath');
    const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    for (const match of markup.matchAll(/(?:href="#|url\(#)([^)"]+)/g)) {
      expect(ids).toContain(match[1]);
    }
  });
});
