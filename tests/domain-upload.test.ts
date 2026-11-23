import {beforeEach, describe, expect, it, vi} from 'vitest';
const {blobs}=vi.hoisted(()=>({blobs:new Map<string,Blob>()}));
vi.mock('idb-keyval',()=>({set:vi.fn(async(key:string,blob:Blob)=>{blobs.set(key,blob)}),get:vi.fn(async(key:string)=>blobs.get(key))}));
import {importFile, resolveMedia, readMediaBlob, clearMediaCache, extractFileFacts} from '../src/domain/upload';
beforeEach(()=>{blobs.clear();clearMediaCache()});
describe('persistent imported media',()=>{
 it('stores original media in IndexedDB and exposes a durable reference',async()=>{const f=new File(['image bytes'],'photo.png',{type:'image/png'});const a=await importFile(f);expect(a.source).toBe('uploaded');expect(a.kind).toBe('image');expect(a.src).toMatch(/^idb:/);expect(a.preview).toBe(a.src);expect(a.public).toBe(false);expect(await readMediaBlob(a.src)).toBe(f)});
 it('restores and caches a blob URL without persisting the temporary URL',async()=>{const a=await importFile(new File(['bytes'],'movie.mp4',{type:'video/mp4'}));const first=await resolveMedia(a.src);expect(first).toMatch(/^blob:/);expect(await resolveMedia(a.src)).toBe(first);expect(a.src).toMatch(/^idb:/);clearMediaCache();expect(await resolveMedia(a.src)).not.toBe(first)});
 it('accepts office documents and safe vector images',async()=>{const pdf=await importFile(new File(['%PDF-1.0'],'brief.pdf',{type:'application/pdf'}));expect(pdf.kind).toBe('document');expect(pdf.preview).toBe('/media/technology.svg');const svg=await importFile(new File(['<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'],'icon.svg',{type:'image/svg+xml'}));expect(svg.kind).toBe('image')});
 it.each([['song.wav','audio/wav','audio'],['page.html','text/html','html'],['style.md','text/markdown','document']])('classifies %s',async(name,type,kind)=>{const a=await importFile(new File(['content'],name,{type}));expect(a.kind).toBe(kind)});
 it('rejects empty, executable, mismatched and overly large files before writing',async()=>{await expect(importFile(new File([],'empty.png',{type:'image/png'}))).rejects.toThrow('为空');await expect(importFile(new File(['x'],'program.exe',{type:'application/octet-stream'}))).rejects.toThrow('不支持');await expect(importFile(new File(['x'],'photo.png',{type:'text/html'}))).rejects.toThrow('格式');const big=new File(['x'],'large.png',{type:'image/png'});Object.defineProperty(big,'size',{value:51*1024*1024});await expect(importFile(big)).rejects.toThrow('50 MB');expect(blobs.size).toBe(0)});
 it('rejects active SVG payloads',async()=>{for(const body of ['<svg><script>alert(1)</script></svg>','<svg onload="alert(1)"></svg>','<svg><foreignObject>x</foreignObject></svg>'])await expect(importFile(new File([body],'unsafe.svg',{type:'image/svg+xml'}))).rejects.toThrow('SVG')});
 it('allows local and https assets but blocks executable media URLs',async()=>{expect(await resolveMedia('/media/industrial.svg')).toBe('/media/industrial.svg');expect(await resolveMedia('https://example.com/a.png')).toBe('https://example.com/a.png');await expect(resolveMedia('javascript:alert(1)')).rejects.toThrow('地址');await expect(resolveMedia('idb:missing')).rejects.toThrow('未找到');await expect(readMediaBlob('/media/demo-loop.mp4')).rejects.toThrow('本地导入')});
});
describe('storage failure messages',()=>{
 it('reports failed browser writes instead of returning a non-persistent asset',async()=>{const {set}=await import('idb-keyval');vi.mocked(set).mockRejectedValueOnce(new Error('quota'));await expect(importFile(new File(['x'],'a.png',{type:'image/png'}))).rejects.toThrow('无法保存');expect(blobs.size).toBe(0)});
 it('reports failed browser reads separately from missing files',async()=>{const {get}=await import('idb-keyval');vi.mocked(get).mockRejectedValueOnce(new Error('blocked'));await expect(readMediaBlob('idb:known')).rejects.toThrow('无法读取')});
});

describe('objective upload metadata',()=>{
 it('extracts PNG dimensions from bytes without inferring the meaning of its name',async()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);
  const view=new DataView(bytes.buffer);view.setUint32(16,1920);view.setUint32(20,1080);
  const asset=await importFile(new File([bytes],'信泰蓝色工厂.png',{type:'image/png'}));
  expect(asset.metadata?.facts).toEqual({mime:'image/png',bytes:24,width:1920,height:1080});
  expect(asset.metadata?.analysis?.status).toBe('needs-description');
  expect(asset.metadata?.analysis?.tags).toEqual([]);
  expect(asset.metadata?.business?.subject).toBeUndefined();
 });
 it('reads SVG dimensions and viewBox, but leaves unavailable dimensions unknown',async()=>{
  expect(await extractFileFacts(new File(['<svg width="1920px" height="1080"/>'],'s.svg',{type:'image/svg+xml'}),'image')).toMatchObject({width:1920,height:1080});
  expect(await extractFileFacts(new File(['<svg viewBox="0 0 3840 960"/>'],'v.svg',{type:'image/svg+xml'}),'image')).toMatchObject({width:3840,height:960});
  const facts=await extractFileFacts(new File(['<svg width="100%"/>'],'unknown.svg',{type:'image/svg+xml'}),'image');
  expect(facts.width).toBeUndefined();expect(facts.height).toBeUndefined();
 });
 it('retains basic facts when decoding or reading fails',async()=>{
  const file=new File(['broken'],'broken.svg',{type:'image/svg+xml'});
  vi.spyOn(file,'text').mockRejectedValueOnce(new Error('decode'));
  expect(await extractFileFacts(file,'image')).toEqual({mime:'image/svg+xml',bytes:6});
 });
 it('times out stalled browser metadata loading, revokes the temporary URL and keeps the upload usable',async()=>{
  class FakeMedia {onerror=null;onload=null;onloadedmetadata=null;src='';preload='';removeAttribute=vi.fn();load=vi.fn()}
  class FakeImage {onerror=null;onload=null;naturalWidth=0;naturalHeight=0;src=''}
  vi.stubGlobal('HTMLMediaElement',FakeMedia);vi.stubGlobal('HTMLVideoElement',FakeMedia);vi.stubGlobal('HTMLImageElement',FakeImage);
  const media=new FakeMedia();vi.stubGlobal('document',{createElement:()=>media});
  const revoke=vi.spyOn(URL,'revokeObjectURL');
  try {
   const facts=await extractFileFacts(new File(['movie'],'stalled.mp4',{type:'video/mp4'}),'video',2);
   expect(facts).toEqual({mime:'video/mp4',bytes:5});
   expect(revoke).toHaveBeenCalled();expect(media.removeAttribute).toHaveBeenCalledWith('src');
  } finally {vi.unstubAllGlobals();revoke.mockRestore();}
 });
 it('extracts browser-loaded video dimensions and finite duration',async()=>{
  class FakeMedia {onerror=null;onload=null;onloadedmetadata:(()=>void)|null=null;preload='';duration=12.5;videoWidth=1920;videoHeight=1080;removeAttribute=vi.fn();load=vi.fn();set src(_src:string){queueMicrotask(()=>this.onloadedmetadata?.())}}
  class FakeImage {}
  vi.stubGlobal('HTMLMediaElement',FakeMedia);vi.stubGlobal('HTMLVideoElement',FakeMedia);vi.stubGlobal('HTMLImageElement',FakeImage);
  vi.stubGlobal('document',{createElement:()=>new FakeMedia()});
  try {expect(await extractFileFacts(new File(['movie'],'clip.mp4',{type:'video/mp4'}),'video')).toMatchObject({width:1920,height:1080,duration:12.5});}
  finally {vi.unstubAllGlobals();}
 });
});
