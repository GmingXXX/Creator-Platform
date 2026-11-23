import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { runInNewContext } from 'node:vm';
import { applyComponentValues, createExampleComponentPackage, inspectComponentFile } from '../src/domain/component-import';

const manifest = { schemaVersion: 1, name: '企业展示卡片', description: '呈现企业概况与经营数据', entry: 'index.html', bridge: 'zhichuang-component-v1', fields: [
  { key: 'title', label: '标题', type: 'text', default: '创新企业' },
  { key: 'count', label: '成果数', type: 'number', default: 12, min: 0, max: 999 },
  { key: 'accent', label: '强调色', type: 'color', default: '#2563eb' },
  { key: 'showCount', label: '显示数据', type: 'boolean', default: true },
] };
async function zipFile(files: Record<string, string | Uint8Array>, name = 'card.zip') {
  const zip = new JSZip();
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));
  return new File([await zip.generateAsync({ type: 'uint8array' })], name, { type: 'application/zip' });
}
async function packageFile(files: Record<string, string> = {}, overrides: Record<string, unknown> = {}) {
  return zipFile({ 'component.json': JSON.stringify({ ...manifest, ...overrides }), 'index.html': '<!doctype html><html><body><h1>企业</h1></body></html>', ...files });
}

describe('component import inspection', () => {
  it('leaves ordinary uploads and ZIP documents in the document flow', async () => {
    expect(await inspectComponentFile(new File(['pdf'], 'brief.pdf'))).toBeNull();
    expect(await inspectComponentFile(await zipFile({ 'brief.txt': '资料' }))).toBeNull();
    const bytes=new Uint8Array(await (await zipFile({'large-document.pdf':'placeholder'})).arrayBuffer());
    const view=new DataView(bytes.buffer);
    const central=bytes.findIndex((_,i)=>i+4<=bytes.length&&view.getUint32(i,true)===0x02014b50);
    view.setUint32(central+24,20*1024*1024,true);
    // Ordinary archive documents are stored, not decompressed as components.
    expect(await inspectComponentFile(new File([bytes],'普通资料.zip'))).toBeNull();
  });
  it('recognizes an ordinary HTML resource ZIP without requiring a component manifest', async () => {
    const file = await zipFile({ '企业展示/index.html': '<link rel="stylesheet" href="style.css"><h1>企业展示</h1>', '企业展示/style.css': 'h1{color:red}', '__MACOSX/._index.html': 'metadata' });
    const result = await inspectComponentFile(file);
    expect(result).toMatchObject({ source: 'package', canPreview: true, bridge: null, fields: [], entryPath: '企业展示/index.html', hasManifest: false });
    expect(atob(result!.html.match(/data:text\/css;base64,([^"']+)/)![1])).toContain('h1{color:red}');
    expect(result?.entryOptions).toEqual(['企业展示/index.html']);
  });
  it('requires a choice when a ZIP has multiple HTML entries and resolves assets relative to the chosen entry', async () => {
    const file = await zipFile({ 'index.html': '<h1>首页</h1>', 'pages/detail.html': '<link rel="stylesheet" href="../style.css"><h1>详情</h1>', 'style.css': 'h1{color:blue}' });
    const pending = await inspectComponentFile(file);
    expect(pending).toMatchObject({ canPreview: false, entryPath: '' });
    expect(pending?.entryOptions).toEqual(['index.html', 'pages/detail.html']);
    const chosen = await inspectComponentFile(file, 'pages/detail.html');
    expect(chosen).toMatchObject({ canPreview: true, entryPath: 'pages/detail.html' });
    expect(atob(chosen!.html.match(/data:text\/css;base64,([^"']+)/)![1])).toContain('h1{color:blue}');
    await expect(inspectComponentFile(file, 'absent.html')).rejects.toThrow('入口');
  });
  it('keeps standalone HTML outer-only and runtime/offline claims unverified', async () => {
    const result = await inspectComponentFile(new File(['<html><head><title>动态卡片</title></head><body>作品</body></html>'], 'card.html'));
    expect(result).toMatchObject({ source: 'html', name: '动态卡片', canPreview: true, bridge: null, fields: [], defaults: {} });
    expect(result?.checks.some(check => check.id === 'runtime' && check.status === 'warning')).toBe(true);
    expect(result?.checks.some(check => check.id === 'offline' && check.status === 'warning')).toBe(true);
  });
  it('writes UTF-8 into the runtime document so Chinese survives blob and offline file loading', async () => {
    const result=await inspectComponentFile(new File(['<!doctype html><html><body><h1>中文标题</h1></body></html>'],'中文.html'));
    expect(result?.html).toMatch(/^<!doctype html>/);
    expect(result?.html).toContain('<meta charset="utf-8">');
    expect(result?.html.indexOf('charset')).toBeLessThan(result!.html.indexOf('<body>'));
  });
  it('blocks missing local dependencies instead of claiming upload success means runnable', async () => {
    const result = await inspectComponentFile(new File(['<script src="lib/runtime.js"></script><img src="assets/logo.png">'], 'broken.html'));
    expect(result?.canPreview).toBe(false);
    expect(result?.checks.filter(check => check.status === 'error').map(check => check.detail).join(' ')).toContain('lib/runtime.js');
    expect(result?.checks.filter(check => check.status === 'error').map(check => check.detail).join(' ')).toContain('assets/logo.png');
  });
  it('flags external dependencies without executing or downloading them', async () => {
    const result = await inspectComponentFile(new File(['<script src="https://cdn.example.com/lib.js"></script>'], 'online.html'));
    expect(result?.canPreview).toBe(true);
    expect(result?.dependencies).toContain('https://cdn.example.com/lib.js');
    expect(result?.checks.some(check => check.id === 'network' && check.status === 'warning')).toBe(true);
  });
  it('recognizes a package, validates its fields and bundles relative styles/scripts/images', async () => {
    const result = await inspectComponentFile(await packageFile({
      'index.html': '<link rel="stylesheet" href="styles/card.css"><h1>卡片</h1><img src="assets/logo.png"><script src="scripts/card.js"></script>',
      'styles/card.css': 'body{background-image:url(../assets/logo.png)}',
      'scripts/card.js': 'window.ZhichuangComponent.subscribe(props=>document.querySelector("h1").textContent=props.title);',
      'assets/logo.png': 'image bytes',
    }));
    expect(result).toMatchObject({ source: 'package', name: manifest.name, canPreview: true, bridge: manifest.bridge, defaults: { title: '创新企业', count: 12, accent: '#2563eb', showCount: true } });
    expect(result?.fields).toHaveLength(4);
    expect(result?.html).toContain('data:image/png;base64,');
    expect(result?.html).not.toContain('src="scripts/card.js"');
    expect(result?.html).toContain('data:text/javascript;base64,');
  });
  it('recognizes a single enclosing directory and ignores unrelated root metadata', async () => {
    const result = await inspectComponentFile(await zipFile({ 'card/component.json': JSON.stringify(manifest), 'card/index.html': '<p>卡片</p>', '__MACOSX/note.txt': 'metadata' }));
    expect(result?.canPreview).toBe(true);
  });
  it('rejects ambiguous packages and invalid editable schemas with actionable errors', async () => {
    await expect(inspectComponentFile(await packageFile({ 'second/component.json': JSON.stringify(manifest) }))).rejects.toThrow('一个');
    await expect(inspectComponentFile(await packageFile({}, { fields: [{ key: '__proto__', label: '危险', type: 'text', default: '' }] }))).rejects.toThrow('参数');
    await expect(inspectComponentFile(await packageFile({}, { fields: [{ key: 'x', label: 'X', type: 'number', default: '1' }] }))).rejects.toThrow('默认');
    await expect(inspectComponentFile(await packageFile({}, { fields: [{ key: 'x', label: 'X', type: 'color', default: 'red' }] }))).rejects.toThrow('默认');
    await expect(inspectComponentFile(await packageFile({}, { fields: manifest.fields, bridge: 'unknown' }))).rejects.toThrow('协议');
  });
  it('rejects malformed ZIP paths, duplicate names and expansion limits before consuming content', async () => {
    await expect(inspectComponentFile(await zipFile({ '../component.json': JSON.stringify(manifest) }))).rejects.toThrow('路径');
    await expect(inspectComponentFile(await zipFile({ 'component.json': JSON.stringify(manifest), 'COMPONENT.JSON': '{}' }))).rejects.toThrow('重复');
    const file = await packageFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const central = bytes.findIndex((_, index) => index + 4 <= bytes.length && view.getUint32(index, true) === 0x02014b50);
    view.setUint32(central + 24, 60 * 1024 * 1024, true);
    await expect(inspectComponentFile(new File([bytes], 'large.zip'))).rejects.toThrow('大小');
  });
  it('rejects forged ZIP directory counts before JSZip can bypass archive preflight', async () => {
    const file=await packageFile(); const bytes=new Uint8Array(await file.arrayBuffer());
    const view=new DataView(bytes.buffer),end=bytes.length-22;
    view.setUint16(end+8,0,true); view.setUint16(end+10,0,true);
    await expect(inspectComponentFile(new File([bytes],'forged.zip'))).rejects.toThrow('目录');
  });
  it('preserves print-only styles and SVG fragment selection', async () => {
    const result=await inspectComponentFile(await zipFile({
      'index.html':'<link rel="stylesheet" media="print" id="print-style" href="print.css"><img src="icon.svg#symbol">',
      'print.css':'body{display:none}', 'icon.svg':'<svg xmlns="http://www.w3.org/2000/svg"><view id="symbol" viewBox="0 0 10 10"/></svg>',
    }));
    expect(result?.html).toContain('media="print"');
    expect(result?.html).toContain('id="print-style"');
    expect(result?.html).toContain('#symbol');
  });
  it('reports unsupported source/build formats without pretending to bundle them', async () => {
    const result = await inspectComponentFile(await packageFile({ 'index.html': '<script type="module" src="main.js"></script>', 'main.js': 'import {x} from "./dep.js"', 'dep.js': 'export const x=1' }));
    expect(result?.canPreview).toBe(false);
    expect(result?.checks.some(check => check.status === 'error' && /模块/.test(check.detail))).toBe(true);
    const dynamic = await inspectComponentFile(await packageFile({ 'index.html': '<script>fetch("./scene.json")</script>', 'scene.json': '{}' }));
    expect(dynamic?.canPreview).toBe(false);
    expect(dynamic?.checks.some(check => check.status === 'error' && /动态/.test(check.detail))).toBe(true);
  });
  it('blocks unsupported nested HTML, srcset, base tags and executable URL references', async () => {
    for (const html of ['<iframe src="child.html"></iframe>', '<img srcset="a.png 1x,b.png 2x">', '<base href="https://example.com/">', '<img src="javascript:alert(1)">']) {
      const result = await inspectComponentFile(await packageFile({ 'index.html': html, 'child.html': '<p>x</p>' }));
      expect(result?.canPreview).toBe(false);
    }
  });
  it('validates package shape, schema constraints and missing entry separately', async () => {
    await expect(inspectComponentFile(new File([], 'empty.html'))).rejects.toThrow('为空');
    await expect(inspectComponentFile(await packageFile({ 'component.json': '{' }))).rejects.toThrow('JSON');
    for (const overrides of [{ schemaVersion: 2 }, { name: '' }, { entry: 'main.ts' }, { description: 7 }, { fields: 'title' }, { fields: [null] }, { fields: [{ key: 'x', label: '', type: 'text' }] }, { fields: [{ key: 'x', label: 'X', type: 'number', default: 0, min: 2, max: 1 }] }]) {
      await expect(inspectComponentFile(await packageFile({}, overrides))).rejects.toThrow();
    }
    const missing = await inspectComponentFile(await packageFile({}, { entry: 'missing.html' }));
    expect(missing).toMatchObject({ canPreview: false });
    expect(missing?.checks.find(check => check.id === 'entry')?.detail).toContain('missing.html');
    const noFields = await inspectComponentFile(await packageFile({}, { fields: undefined, bridge: undefined }));
    expect(noFields).toMatchObject({ bridge: null, fields: [] });
  });
  it('handles inline styles, unquoted attributes, query strings and non-media dependencies conservatively', async () => {
    const result = await inspectComponentFile(await packageFile({
      'index.html': '<link rel=icon href=logo.png><style>h1{color:red}</style><div style="background:url(logo.png)"></div><img src=logo.png?v=1><video poster="logo.png"></video>',
      'logo.png': 'logo',
    }));
    expect(result?.canPreview).toBe(true);
    expect(result?.html).not.toContain('logo.png');
    const unsupported = await inspectComponentFile(await packageFile({ 'index.html': '<img src="data.json"><style>@import "other.css";</style>', 'data.json': '{}' }));
    expect(unsupported?.canPreview).toBe(false);
    const invalid = await inspectComponentFile(await packageFile({ 'index.html': '<img src="%ZZ.png"><img src="/outside.png"><img src="../../outside.png">' }));
    expect(invalid?.canPreview).toBe(false);
    const online = await inspectComponentFile(await packageFile({ 'index.html': '<script>fetch("https://example.com/data");</script><link rel="stylesheet" href="https://example.com/style.css">' }));
    expect(online?.canPreview).toBe(true);
    expect(online?.dependencies).toContain('https://example.com/data');
  });
  it('rejects unsupported archive headers and compression modes before unzip', async () => {
    await expect(inspectComponentFile(new File(['no zip'], 'bad.zip'))).rejects.toThrow('ZIP');
    const base = new Uint8Array(await (await packageFile()).arrayBuffer());
    const central = base.findIndex((_, index) => index + 4 <= base.length && new DataView(base.buffer).getUint32(index, true) === 0x02014b50);
    for (const [offset, value] of [[8, 1], [10, 12]] as const) {
      const bytes = base.slice(); new DataView(bytes.buffer).setUint16(central + offset, value, true);
      await expect(inspectComponentFile(new File([bytes], 'bad.zip'))).rejects.toThrow('ZIP');
    }
    const linked = base.slice(); new DataView(linked.buffer).setUint32(central + 38, 0xa000 << 16, true);
    await expect(inspectComponentFile(new File([linked], 'link.zip'))).rejects.toThrow('符号链接');
    const multi = base.slice(); new DataView(multi.buffer).setUint16(multi.length - 22 + 4, 1, true);
    await expect(inspectComponentFile(new File([multi], 'multi.zip'))).rejects.toThrow('分卷');
    const truncated = base.slice(0, -1);
    await expect(inspectComponentFile(new File([truncated], 'short.zip'))).rejects.toThrow('完整');
    const many = new JSZip(); many.file('index.html','<p>demo</p>'); for (let i = 0; i < 251; i++) many.file(`${i}.txt`, 'x');
    await expect(inspectComponentFile(new File([await many.generateAsync({ type: 'uint8array' })], 'many.zip'))).rejects.toThrow('250');
  });
});

describe('persisted editable component document', () => {
  it('validates supplied values and prevents script closing injection', async () => {
    const inspected = (await inspectComponentFile(await packageFile()))!;
    expect(() => applyComponentValues(inspected.html, inspected.fields, { count: -1 })).toThrow('参数');
    expect(() => applyComponentValues(inspected.html, inspected.fields, { title: 42 })).toThrow('参数');
    const html = applyComponentValues('<h1>test</h1>', inspected.fields, { title: '</script><script>alert(1)</script>' });
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
    expect(() => applyComponentValues(inspected.html, inspected.fields, { nonexistent: 'x' })).toThrow('参数');
    const twice = applyComponentValues(html, inspected.fields, { title: '第二次' });
    expect(twice.match(/data-zhichuang-component-sdk/g)).toHaveLength(1);
    expect(applyComponentValues('<!doctype html><html></html>', [], {})).toMatch(/^<!doctype html><script/);
    expect(applyComponentValues('<html><head></head></html>', [], {})).toContain('<head><script');
  });
  it('renders persisted values independently and only acknowledges edits after subscribers run', async () => {
    const inspected = (await inspectComponentFile(await packageFile()))!;
    const html = applyComponentValues('<h1>test</h1>', inspected.fields, { title: '已保存标题' });
    const bootstrap = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
    const messages: unknown[] = [];
    let receive: (event: { source: unknown; data: unknown }) => void = () => undefined;
    const parent = { postMessage: (message: unknown) => messages.push(message) };
    const window: { ZhichuangComponent?: { subscribe: (fn: (props: Record<string, unknown>) => void) => void; getProps: () => Record<string, unknown> } } = {};
    runInNewContext(bootstrap, { window, parent, addEventListener: (_: string, callback: typeof receive) => { receive = callback; }, console, Promise, setTimeout, clearTimeout });
    receive({ source: parent, data: { type: 'zhichuang:component:init', channel: 'abc', requestId: 1, props: { title: '初始标题' } } });
    expect(messages).toEqual([]);
    const rendered: unknown[] = [];
    window.ZhichuangComponent!.subscribe(props => rendered.push(props.title));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(rendered).toContain('初始标题');
    expect(messages.some(message => (message as { type: string }).type === 'zhichuang:component:ready')).toBe(true);
    receive({ source: {}, data: { type: 'zhichuang:component:props', channel: 'abc', requestId: 2, props: { title: 'spoof' } } });
    receive({ source: parent, data: { type: 'zhichuang:component:props', channel: 'wrong', requestId: 2, props: { title: 'spoof' } } });
    expect(window.ZhichuangComponent!.getProps().title).toBe('初始标题');
    receive({ source: parent, data: { type: 'zhichuang:component:props', channel: 'abc', requestId: 3, props: { title: '修改标题' } } });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(rendered).toContain('修改标题');
    expect(messages).toContainEqual(expect.objectContaining({ type: 'zhichuang:component:applied', channel: 'abc', requestId: 3 }));
  });
  it('ships a complete working example package with no unfulfilled local dependencies', async () => {
    const bytes = await createExampleComponentPackage();
    const result = await inspectComponentFile(new File([bytes], 'example.zip'));
    expect(result?.canPreview).toBe(true);
    expect(result?.fields.map(field => field.type)).toEqual(expect.arrayContaining(['text', 'textarea', 'color', 'number', 'boolean']));
    expect(result?.html).toContain('data:text/javascript;base64,');
  });
});
