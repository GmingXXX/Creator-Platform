import JSZip from 'jszip';
import type { Work } from './types';
import { exportRuntime, exportStyles } from './export-runtime';

export type ExportFormat = 'browser' | 'player-offline' | 'player-online';
export interface ExportOptions {
  loadMedia?: (src: string, signal?: AbortSignal) => Promise<Blob>;
  signal?: AbortSignal;
  onProgress?: (progress: number, label: string) => void;
}
interface Resource { original: string; path: string; mime: string; bytes: Uint8Array<ArrayBuffer>; sha256: string }

const extensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'text/html': 'html',
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const checkCancelled = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error('导出已取消'); };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const embeddedJson = (value: unknown) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
const safeName = (title: string) => title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 70) || '未命名展项';

function validateWork(work: Work) {
  if (!work || !Number.isInteger(work.width) || !Number.isInteger(work.height) || work.width < 1 || work.height < 1 || work.width > 32768 || work.height > 32768) throw new Error('导出分辨率无效，请检查画布尺寸');
  if (!Array.isArray(work.pages) || work.pages.length === 0) throw new Error('没有可导出的页面');
  const ids = new Set<string>();
  for (const page of work.pages) {
    if (!page.id || !Array.isArray(page.nodes)) throw new Error('页面数据不完整');
    for (const node of page.nodes) {
      if (!node.id || ids.has(node.id)) throw new Error('存在重复或无效的组件 ID，请先修复工程');
      ids.add(node.id);
      if (![node.x, node.y, node.w, node.h].every(Number.isFinite) || node.w <= 0 || node.h <= 0) throw new Error(`组件「${node.name}」的尺寸无效`);
    }
  }
}

function mediaReferences(work: Work): string[] {
  const references = work.pages.flatMap(page => [page.backgroundImage, ...page.nodes.flatMap(node => [node.src, ...(node.items ?? []).map(item => item.image)])]);
  return [...new Set([work.cover,...references, ...(work.shots ?? []).map(shot => shot.src), ...(work.storyNodes ?? []).map(node => node.media)].filter((src): src is string => Boolean(src)))];
}

async function defaultLoadMedia(src: string, signal?: AbortSignal): Promise<Blob> {
  if (src.startsWith('idb:')) {
    const { readMediaBlob } = await import('./upload');
    return readMediaBlob(src);
  }
  const response = await fetch(src, {signal});
  if (!response.ok) throw new Error(`资源读取失败 (${response.status})`);
  return response.blob();
}

function cancellableLoad(load: NonNullable<ExportOptions['loadMedia']>, source: string, signal?: AbortSignal): Promise<Blob> {
  if (!signal) return load(source);
  checkCancelled(signal);
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('导出已取消'));
    signal.addEventListener('abort', abort, {once: true});
    Promise.resolve().then(() => { checkCancelled(signal); return load(source, signal); }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function extensionFor(blob: Blob, source: string) {
  const mime = blob.type.split(';')[0];
  if (extensions[mime]) return extensions[mime];
  const match = source.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return match && /^(png|jpe?g|svg|webp|gif|mp4|webm|mp3|wav|ogg|html)$/i.test(match[1]) ? match[1].toLowerCase() : 'bin';
}

async function loadResources(work: Work, options: ExportOptions): Promise<Resource[]> {
  const sources = mediaReferences(work);
  const load = options.loadMedia ?? defaultLoadMedia;
  const resources: Resource[] = [];
  for (const [index, source] of sources.entries()) {
    checkCancelled(options.signal);
    if (/^(javascript|file|vbscript):/i.test(source.trim())) throw new Error('资源地址不受支持，请先导入素材库');
    try {
      const blob = await cancellableLoad(load, source, options.signal);
      if (!blob.size) throw new Error('资源为空');
      const ext = extensionFor(blob, source);
      if (ext === 'html' || ext === 'svg') await validateEmbeddedDocument(blob, ext);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      resources.push({original: source, path: `assets/resource-${index + 1}.${ext}`, mime: blob.type || 'application/octet-stream', bytes, sha256: [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('')});
      options.onProgress?.(Math.round((index + 1) / Math.max(1, sources.length) * 65), `正在打包资源 ${index + 1}/${sources.length}`);
    } catch (error) {
      throw new Error(`资源无法打包：${source.startsWith('data:') ? '内嵌资源' : source.slice(0, 100)}。${error instanceof Error ? error.message : '请重新选择资源'}`);
    }
  }
  checkCancelled(options.signal);
  return resources;
}

async function validateEmbeddedDocument(blob: Blob, kind: string) {
  let source = await blob.text();
  // Compiled component ZIPs keep deferred scripts as data URLs to preserve
  // execution order. Inspect those bytes as well, not just their wrapper URL.
  const encodedScripts = [
    ...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](data:[^"']+)["'][^>]*>/gi),
    ...source.matchAll(/<link\b[^>]*\bhref\s*=\s*["'](data:text\/css[^"']+)["'][^>]*>/gi),
  ];
  for (const match of encodedScripts) {
    const comma = match[1].indexOf(',');
    if (comma < 0) throw new Error('HTML 内嵌脚本格式无效');
    try {
      const payload = decodeURIComponent(match[1].slice(comma + 1));
      const content = /;base64$/i.test(match[1].slice(0, comma)) ? new TextDecoder().decode(Uint8Array.from(atob(payload), char => char.charCodeAt(0))) : payload;
      source += '\n' + content;
    } catch { throw new Error('HTML 内嵌脚本无法检查，请重新导入组件'); }
  }
  const references = [...source.matchAll(/(?:\bsrc|\bhref|\bxlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(match => match[1] ?? match[2] ?? match[3]);
  const cssReferences = [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(match => match[1].trim());
  if ([...references, ...cssReferences].some(ref => ref && !ref.startsWith('#') && !ref.startsWith('data:')) || /(?:fetch\s*\(|import\s*\(|@import\s|<!ENTITY)/i.test(source)) throw new Error(`${kind.toUpperCase()} 含未声明的外部依赖，请先改为自包含程序`);
}

function rewriteMedia(work: Work, resources: Resource[]): Work {
  const paths = new Map(resources.map(item => [item.original, item.path]));
  const ref = (src: string | undefined) => src ? paths.get(src) ?? src : undefined;
  return {...work, cover:ref(work.cover), pages: work.pages.map(page => ({...page, backgroundImage: ref(page.backgroundImage), nodes: page.nodes.map(node => ({...node, src: ref(node.src), items: node.items?.map(item => ({...item, image: ref(item.image)}))}))})), shots: work.shots?.map(shot => ({...shot, src: ref(shot.src)!})), storyNodes: work.storyNodes?.map(node => ({...node, media: ref(node.media)}))};
}

function makeManifest(work: Work, resources: Resource[], format: ExportFormat) {
  return {
    schemaVersion: 'zhichuang-demo/1.0', format,
    protocolStatus: format === 'browser' ? 'browser-runtime' : 'protocol-example',
    readyForPlayer: false,
    notice: format === 'browser' ? '浏览器自包含演示运行包' : '协议示例，待播放器适配；不代表已兼容实际展项播放器。',
    work: {id: work.id, title: work.title, revision: work.revision, width: work.width, height: work.height, updatedAt: work.updatedAt, pageCount: work.pages.length},
    resources: resources.map(item => ({path: item.path, bytes: item.bytes.length, mime: item.mime, sha256: item.sha256, ...(format === 'player-online' ? {url: null, status: 'requires-hosting'} : {})})),
  };
}

function makeHtml(work: Work) {
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(work.title)}</title><link rel="stylesheet" href="runtime.css"></head><body><main id="viewport"><div id="stage" aria-label="展项画布"></div></main><nav id="page-nav" aria-label="页面导航"></nav><button id="fullscreen" aria-label="全屏">⛶</button><dialog id="detail"><button id="close-detail" aria-label="关闭详情">×</button><div id="detail-body"></div></dialog><aside id="command-panel"><label for="command-input">语音命令模拟</label><form id="command-form"><input id="command-input" placeholder="输入口令，例如：返回首页"><button>执行</button></form><output id="command-result"></output></aside><button id="command-toggle">命令测试</button><script id="scene-data" type="application/json">${embeddedJson(work)}</script><script src="runtime.js"></script></body></html>`;
}

export async function exportWork(input: Work, format: ExportFormat, options: ExportOptions = {}): Promise<{blob: Blob; filename: string}> {
  checkCancelled(options.signal);
  const snapshot = clone(input);
  validateWork(snapshot);
  if (!['browser', 'player-offline', 'player-online'].includes(format)) throw new Error('不支持的导出格式');
  options.onProgress?.(0, '正在检查当前版本与依赖');
  const resources = await loadResources(snapshot, options);
  const work = rewriteMedia(snapshot, resources);
  const manifest = makeManifest(work, resources, format);
  const name = safeName(work.title);
  if (format === 'player-online') {
    options.onProgress?.(100, '在线清单协议示例已准备好');
    return {blob: new Blob([JSON.stringify({...manifest, scene: work}, null, 2)], {type: 'application/json;charset=utf-8'}), filename: `${name}_播放器在线清单_协议示例.json`};
  }
  const zip = new JSZip();
  for (const resource of resources) zip.file(resource.path, resource.bytes);
  zip.file('scene.json', JSON.stringify(work, null, 2));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  if (format === 'browser') {
    zip.file('index.html', makeHtml(work));
    zip.file('runtime.js', exportRuntime());
    zip.file('runtime.css', exportStyles);
    zip.file('README.txt', `智创平台 · 管理平台运行包\n\n展项：${work.title}\n版本：${work.revision}\n分辨率：${work.width} × ${work.height}\n\n解压全部文件后，用桌面 Chrome、Edge 或 Safari 打开 index.html。引用的图片、视频、音频及自包含组件已存放在 assets 文件夹；页面浏览无需网络或服务端。所选系统字体由运行设备提供，未安装时按字体回退规则显示；没有嵌入第三方字库。首次播放声音/视频需点击交互，以符合浏览器媒体策略。\n\n下方可切换页面，右上角可全屏，右下角可测试已配置的语音口令。详情关闭后返回原页面。\n\n在线问答、语音识别和实时生成需要另接在线服务，不包含在此离线包中。管理平台导入协议仍需联调确认。\n\n此包为当前版本的演示运行快照，不包含编辑器。自包含 HTML 程序在隔离框架中运行，内部内容不会转换为画布组件；外部依赖和专业播放器功能需另行适配。\n`);
  } else {
    zip.file('player-manifest.example.json', JSON.stringify({...manifest, sceneFile: 'scene.json', entryPage: work.pages[0].id}, null, 2));
    zip.file('README.txt', `智创平台 · 展项播放器离线包（协议示例）\n\n${work.title} / 版本 ${work.revision}\n\n协议示例，待播放器适配。本文件演示场景、版本、媒体与校验值的组织方式，不代表已兼容任何实际展项播放器。\n请由播放器开发人员依据实际协议确认配置结构。未包含专用播放器安装程序。\n`);
  }
  const buffer = await zip.generateAsync({type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: {level: 3}}, ({percent}) => {
    checkCancelled(options.signal);
    options.onProgress?.(65 + Math.round(percent * .35), '正在生成 ZIP 文件');
  });
  checkCancelled(options.signal);
  return {blob: new Blob([buffer], {type: 'application/zip'}), filename: `${name}_${format === 'browser' ? '管理平台运行包' : '播放器离线包_协议示例'}.zip`};
}
