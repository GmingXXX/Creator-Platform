import { describe, expect, it } from 'vitest';
import { isComponentReply, instrumentComponentPreview } from '../src/features/resources/component-preview';

describe('component preview messages', () => {
  const frame = {};
  const event = (data: unknown, source: unknown = frame) => ({ data, source });
  it('accepts only the current isolated frame and a fresh channel', () => {
    const data = { type: 'zhichuang:component:ready', channel: 'session-1', requestId: 3 };
    expect(isComponentReply(event(data), frame, 'session-1')).toBe(true);
    expect(isComponentReply(event(data, {}), frame, 'session-1')).toBe(false);
    expect(isComponentReply(event(data), frame, 'session-2')).toBe(false);
    expect(isComponentReply(event(data), null, 'session-1')).toBe(false);
  });
  it('rejects malformed data and unrelated commands', () => {
    for (const data of [null, 'hello', [], { channel: 'session-1', type: 'navigate' }, { channel: 'session-1', type: 'zhichuang:component:applied', requestId: '3' }]) {
      expect(isComponentReply(event(data), frame, 'session-1')).toBe(false);
    }
  });
  it('instruments a preview without allowing a channel to escape its script', () => {
    const html = '<!doctype html><html><head></head><body><h1>Original</h1></body></html>';
    const result = instrumentComponentPreview(html, '</script><script>bad()</script>');
    expect(result).toContain('<h1>Original</h1>');
    expect(result).not.toContain('</script><script>bad()');
    expect(result).toContain('unhandledrejection');
    expect(result).toContain('zhichuang:preview:loaded');
    expect(result.indexOf('zhichuang:preview:loaded')).toBeLessThan(result.indexOf('<h1>'));
  });
  it('handles HTML fragments and uppercase document heads', () => {
    expect(instrumentComponentPreview('<p>fragment</p>', 'a')).toContain('<p>fragment</p>');
    expect(instrumentComponentPreview('<HTML><HEAD lang="zh"></HEAD></HTML>', 'a')).toMatch(/<HEAD lang="zh"><script>/);
    expect(instrumentComponentPreview('<!doctype html><html><body>standards</body></html>', 'a')).toMatch(/^<!doctype html>/);
  });
});
