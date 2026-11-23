import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { exportWork } from '../src/domain/export';
import type { SceneNode, Work } from '../src/domain/types';
import { exportRuntime } from '../src/domain/export-runtime';
import { readMediaBlob } from '../src/domain/upload';

vi.mock('../src/domain/upload', () => ({ readMediaBlob: vi.fn(async () => new Blob(['local image'], {type:'image/png'})) }));
afterEach(() => vi.restoreAllMocks());

const node = (patch: Partial<SceneNode> = {}): SceneNode => ({ id: 'node-1', type: 'text', name: '标题', x: 10, y: 20, w: 800, h: 120, rotation: 0, opacity: 1, hidden: false, locked: false, content: '创新发展', color: '#ffffff', background: 'transparent', fontSize: 60, radius: 8, ...patch });
const work = (): Work => ({id:'work-test', projectId:'project-test', title:'企业发展历程', kind:'exhibit', type:'时间演进型', width:1920, height:1080, styleId:'industrial', pages:[{id:'page-1',name:'首页',background:'#08263b',nodes:[node()]}], revision:7, createdAt:'2026-11-06T00:00:00Z',updatedAt:'2026-11-06T00:00:00Z'});
const unzip = async (blob: Blob) => JSZip.loadAsync(await blob.arrayBuffer());

describe('browser export package', () => {
  it('exports the selected scene revision with embedded JSON and a local runtime', async () => {
    const result = await exportWork(work(), 'browser');
    const zip = await unzip(result.blob);
    const html = await zip.file('index.html')!.async('string');
    expect(result.filename).toMatch(/管理平台运行包\.zip$/);
    expect(html).toContain('id="scene-data"');
    expect(html).toContain('"revision":7');
    expect(html).toContain('创新发展');
    expect(html).not.toContain('fetch(');
    expect(html).not.toMatch(/src="https?:/);
    expect(await zip.file('runtime.js')!.async('string')).toContain('textContent');
    expect(zip.file('README.txt')).not.toBeNull();
  });

  it('captures the input synchronously so further edits do not change an ongoing export', async () => {
    const input = work();
    input.pages[0].backgroundImage='/media/background.svg';
    let release: (blob: Blob) => void = () => {};
    const media = new Promise<Blob>(resolve => { release=resolve; });
    const pending = exportWork(input, 'browser', {loadMedia: () => media});
    input.pages[0].nodes[0].content='CHANGED AFTER EXPORT';
    input.revision=99;
    release(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'],{type:'image/svg+xml'}));
    const zip=await unzip((await pending).blob);
    const scene=JSON.parse(await zip.file('scene.json')!.async('string'));
    expect(scene.revision).toBe(7);
    expect(scene.pages[0].nodes[0].content).toBe('创新发展');
  });

  it('deduplicates backgrounds, nodes and item images and rewrites every reference', async () => {
    const input=work();
    input.pages[0].backgroundImage='/media/a.svg';
    input.pages[0].nodes=[node({type:'image',src:'/media/a.svg'}),node({id:'node-2',type:'gallery',items:[{id:'a',title:'事件',description:'描述',image:'idb:asset-1'}]})];
    const loadMedia=vi.fn(async () => new Blob(['image bytes'],{type:'image/png'}));
    const zip=await unzip((await exportWork(input,'browser',{loadMedia})).blob);
    const scene=JSON.parse(await zip.file('scene.json')!.async('string'));
    expect(loadMedia).toHaveBeenCalledTimes(2);
    expect(scene.pages[0].backgroundImage).toBe(scene.pages[0].nodes[0].src);
    expect(scene.pages[0].nodes[1].items[0].image).toMatch(/^assets\//);
    expect(JSON.stringify(scene)).not.toContain('idb:');
    expect(Object.keys(zip.files).filter(name => name.startsWith('assets/') && !zip.files[name].dir)).toHaveLength(2);
    const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.resources[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails with a useful missing-resource error instead of silently omitting media', async () => {
    const input=work(); input.pages[0].nodes[0].src='/media/missing.png';
    await expect(exportWork(input,'browser',{loadMedia: async () => {throw new Error('404');}})).rejects.toThrow('资源无法打包');
  });

  it('escapes script boundaries and unsafe title text while retaining original text in JSON', async () => {
    const input=work(); input.title='</title><script>alert(1)</script>';
    input.pages[0].nodes[0].content='</script><script>window.pwned=true</script>';
    const zip=await unzip((await exportWork(input,'browser')).blob);
    const html=await zip.file('index.html')!.async('string');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>window.pwned');
    expect(html).toContain('\\u003c/script\\u003e');
    const scene=JSON.parse(await zip.file('scene.json')!.async('string'));
    expect(scene.pages[0].nodes[0].content).toContain('</script>');
  });

  it('rejects an invalid canvas or empty project before loading resources', async () => {
    await expect(exportWork({...work(),width:0},'browser')).rejects.toThrow('分辨率');
    await expect(exportWork({...work(),pages:[]},'browser')).rejects.toThrow('页面');
  });

  it('supports cancellation and does not return a partial file', async () => {
    const controller=new AbortController(); controller.abort();
    await expect(exportWork(work(),'browser',{signal:controller.signal})).rejects.toThrow('取消');
  });

  it('cancels promptly even when a media loader never settles', async () => {
    const input=work(); input.pages[0].backgroundImage='/stalled.png';
    const controller=new AbortController();
    const pending=exportWork(input,'browser',{signal:controller.signal,loadMedia:()=>new Promise<Blob>(()=>{})});
    controller.abort();
    await expect(pending).rejects.toThrow('取消');
  },500);
});

describe('resource integrity and validation', () => {
  it('checks bundled data scripts for network dependencies before claiming a self-contained export', async () => {
    const input = work(); input.pages[0].nodes = [node({type:'html',src:'idb:component'})];
    const source = `<html><script defer src="data:text/javascript;base64,${btoa('fetch("https://example.com/data")')}"></script></html>`;
    await expect(exportWork(input,'browser',{loadMedia:async()=>new Blob([source],{type:'text/html'})})).rejects.toThrow('外部依赖');
  });
  it('checks external images inside compiled CSS data URLs', async () => {
    const input=work(); input.pages[0].nodes=[node({type:'html',src:'idb:component'})];
    const source=`<link rel="stylesheet" href="data:text/css;base64,${btoa('body{background:url(https://example.com/bg.png)}')}">`;
    await expect(exportWork(input,'browser',{loadMedia:async()=>new Blob([source],{type:'text/html'})})).rejects.toThrow('外部依赖');
  });
  it('includes story and video-shot dependencies without mutating original URLs', async () => {
    const input=work();
    input.shots=[{id:'shot',title:'片头',narration:'你好',duration:8,src:'/clip.mp4'}];
    input.storyNodes=[{id:'story',type:'scene',x:0,y:0,title:'起点',text:'开始',media:'/picture.webp'}];
    const loadMedia=vi.fn(async () => new Blob(['binary media']));
    const zip=await unzip((await exportWork(input,'browser',{loadMedia})).blob);
    const scene=JSON.parse(await zip.file('scene.json')!.async('string'));
    expect(scene.shots[0].src).toBe('assets/resource-1.mp4');
    expect(scene.storyNodes[0].media).toBe('assets/resource-2.webp');
    expect(input.shots[0].src).toBe('/clip.mp4');
    expect(zip.file(scene.shots[0].src)).not.toBeNull();
  });

  it('loads imported files from persistent storage without creating temporary blob URLs', async () => {
    const input=work(); input.pages[0].nodes[0].src='idb:imported-image';
    const createUrl=vi.spyOn(URL,'createObjectURL');
    const zip=await unzip((await exportWork(input,'browser')).blob);
    expect(readMediaBlob).toHaveBeenCalledWith('idb:imported-image');
    expect(createUrl).not.toHaveBeenCalled();
    expect(await zip.file('assets/resource-1.png')!.async('string')).toBe('local image');
  });

  it('loads local static media and reports HTTP failures', async () => {
    const input=work(); input.pages[0].nodes[0].src='/local.png';
    const request=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('image',{headers:{'content-type':'image/png'}})).mockResolvedValueOnce(new Response('',{status:404}));
    const zip=await unzip((await exportWork(input,'browser')).blob);
    expect(await zip.file('assets/resource-1.png')!.async('string')).toBe('image');
    expect(request).toHaveBeenCalledWith('/local.png',{signal:undefined});
    await expect(exportWork(input,'browser')).rejects.toThrow('404');
  });

  it('refuses empty media, forbidden URI schemes, and unexpected loader errors', async () => {
    const input=work(); input.pages[0].backgroundImage='/empty.png';
    await expect(exportWork(input,'browser',{loadMedia:async()=>new Blob()})).rejects.toThrow('资源为空');
    await expect(exportWork(input,'browser',{loadMedia:async()=>{throw null;}})).rejects.toThrow('请重新选择资源');
    input.pages[0].backgroundImage=' javascript:alert(1)';
    await expect(exportWork(input,'browser')).rejects.toThrow('资源地址不受支持');
  });

  it.each([
    ['text/html','<img src="https://example.org/a.png">'],
    ['text/html','<script src=./unlisted.js></script>'],
    ['text/html','<style>.x{background:url(./missing.png)}</style>'],
    ['image/svg+xml','<svg><image href="https://example.org/a.png"/></svg>'],
    ['image/svg+xml','<!ENTITY external SYSTEM "https://example.org/x">'],
  ])('refuses unbundled external references in %s', async (type,source) => {
    const input=work(); input.pages[0].nodes[0].src='/embedded';
    await expect(exportWork(input,'browser',{loadMedia:async()=>new Blob([source],{type})})).rejects.toThrow('外部依赖');
  });

  it('accepts self-contained HTML and embedded SVG references', async () => {
    const input=work(); input.pages[0].nodes[0].src='/embedded.html';
    const html='<html><body><a href="#section">跳转</a><svg><use href="#symbol"/></svg><img src="data:image/png;base64,eA=="></body></html>';
    const zip=await unzip((await exportWork(input,'browser',{loadMedia:async()=>new Blob([html],{type:'text/html'})})).blob);
    expect(await zip.file('assets/resource-1.html')!.async('string')).toBe(html);
  });

  it('cancels while loading media and reports monotonic progress on success', async () => {
    const input=work(); input.pages[0].nodes[0].src='/x.png';
    const controller=new AbortController();
    await expect(exportWork(input,'browser',{signal:controller.signal,loadMedia:async()=>{controller.abort();return new Blob(['x']);}})).rejects.toThrow('取消');
    const progress:number[]=[];
    await exportWork(input,'browser',{loadMedia:async()=>new Blob(['x']),onProgress:value=>progress.push(value)});
    expect(progress[0]).toBe(0); expect(progress.at(-1)).toBe(100);
    expect(progress).toEqual([...progress].sort((a,b)=>a-b));
  });

  it('validates malformed pages, duplicate nodes and invalid geometry', async () => {
    const input=work(); input.pages[0].id='';
    await expect(exportWork(input,'browser')).rejects.toThrow('页面数据');
    input.pages[0].id='page'; input.pages[0].nodes=[node(),node()];
    await expect(exportWork(input,'browser')).rejects.toThrow('组件 ID');
    input.pages[0].nodes=[node({w:0})];
    await expect(exportWork(input,'browser')).rejects.toThrow('尺寸无效');
  });

  it('handles unknown formats, binary fallback and safe empty filenames', async () => {
    await expect(exportWork(work(),'unknown' as 'browser')).rejects.toThrow('不支持');
    const input=work(); input.title='  '; input.pages[0].nodes[0].src='data:unknown';
    const result=await exportWork(input,'browser',{loadMedia:async()=>new Blob(['opaque'])});
    expect(result.filename).toBe('未命名展项_管理平台运行包.zip');
    expect((await unzip(result.blob)).file('assets/resource-1.bin')).not.toBeNull();
  });

  it('emits parseable browser JavaScript without imports or network fetches', () => {
    const runtime=exportRuntime();
    expect(()=>new Function(runtime)).not.toThrow();
    expect(runtime).not.toMatch(/\b(?:import|fetch)\s*\(/);
    expect(runtime).not.toContain('innerHTML');
  });
});

describe('player protocol examples', () => {
  it('keeps online manifest URLs unset until real hosting exists', async () => {
    const input=work(); input.pages[0].backgroundImage='/media/industrial.svg';
    const result=await exportWork(input,'player-online',{loadMedia:async () => new Blob(['x'],{type:'image/svg+xml'})});
    const manifest=JSON.parse(await result.blob.text());
    expect(result.filename).toMatch(/协议示例\.json$/);
    expect(manifest.protocolStatus).toBe('protocol-example');
    expect(manifest.readyForPlayer).toBe(false);
    expect(manifest.resources[0].url).toBeNull();
    expect(manifest.work.revision).toBe(7);
  });

  it('writes offline sample configuration and media into a real ZIP', async () => {
    const result=await exportWork(work(),'player-offline');
    const zip=await unzip(result.blob);
    const config=JSON.parse(await zip.file('player-manifest.example.json')!.async('string'));
    expect(config.protocolStatus).toBe('protocol-example');
    expect(await zip.file('README.txt')!.async('string')).toContain('待播放器适配');
    expect(zip.file('scene.json')).not.toBeNull();
  });
});
