import type { ComponentCheck } from './component-import';

type Compilation = { html: string; checks: ComponentCheck[]; dependencies: string[] };
const decoder = new TextDecoder('utf-8');
const mimeTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]).replace(/&amp;/gi, '&') : undefined;
}
function replaceAttribute(tag: string, name: string, value: string): string {
  return tag.replace(new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i'), () => ` ${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
}
function base64(bytes: Uint8Array): string {
  let content = '';
  for (let i = 0; i < bytes.length; i += 8192) content += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(content);
}
function relativePath(reference: string, from: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(reference.split(/[?#]/)[0]); } catch { return null; }
  if (!decoded || decoded.includes('\\') || decoded.includes('\0') || decoded.startsWith('/')) return null;
  const parts = from.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (part === '..') { if (!parts.length) return null; parts.pop(); }
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}
async function replaceAsync(value: string, expression: RegExp, replace: (match: RegExpMatchArray) => Promise<string>): Promise<string> {
  const matches = [...value.matchAll(expression)], replacements = await Promise.all(matches.map(replace));
  let index = 0;
  return value.replace(expression, () => replacements[index++]);
}

/** Conservative static compiler. Unhandled dependency patterns block preview instead of being silently dropped. */
export async function compileComponentHtml(original: string, entry: string, files: Map<string, Uint8Array>): Promise<Compilation> {
  const checks: ComponentCheck[] = [], dependencies = new Set<string>(), issues = new Set<string>();
  let expandedBytes = original.length;
  const reserve = (bytes: number) => { expandedBytes += bytes; if (expandedBytes > 48 * 1024 * 1024) throw new Error('打包后的 HTML 过大，请减少资源或重复引用后重试。'); };
  const problem = (detail: string) => { if (!issues.has(detail)) { issues.add(detail); checks.push({ id: `resource-${issues.size}`, status: 'error', title: '需要补充或调整组件资源', detail }); } };
  const classify = (reference: string): 'inline' | 'external' | 'local' | 'invalid' => {
    const ref = reference.trim();
    if (!ref || ref.startsWith('#') || /^data:/i.test(ref)) return 'inline';
    if (/^(https?:)?\/\//i.test(ref)) { dependencies.add(ref); return 'external'; }
    if (/^[a-z][\w+.-]*:/i.test(ref) || /[\u0000-\u001f]/.test(ref) || ref.includes('&#')) return 'invalid';
    return 'local';
  };
  const lookup = (reference: string, from: string): { path: string; bytes: Uint8Array } | undefined => {
    const kind = classify(reference);
    if (kind === 'invalid') { problem(`不支持的资源地址：${reference.slice(0, 150)}`); return; }
    if (kind !== 'local') return;
    const path = relativePath(reference, from), bytes = path ? files.get(path) : undefined;
    if (!bytes || !path) { problem(`缺少本地资源：${reference.slice(0, 150)}。请将资源放入组件 ZIP 后重新上传。`); return; }
    return { path, bytes };
  };
  const dataReference = (reference: string, from: string): string => {
    const local = lookup(reference, from);
    if (!local) return reference;
    const extension = local.path.split('.').pop()?.toLowerCase() || '', mime = mimeTypes[extension];
    if (!mime) { problem(`暂不支持直接嵌入资源 ${reference}，请先构建为自包含 HTML。`); return reference; }
    reserve(Math.ceil(local.bytes.length / 3) * 4);
    const fragment = reference.includes('#') ? reference.slice(reference.indexOf('#')) : '';
    return `data:${mime};base64,${base64(local.bytes)}${fragment}`;
  };
  const css = (content: string, from: string): string => {
    if (/@import\b/i.test(content)) problem('样式包含 @import，请先合并样式文件后重新上传。');
    return content.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (_, double, single, bare) => `url("${dataReference((double ?? single ?? bare).trim(), from).replace(/"/g, '%22')}")`);
  };
  const script = (content: string) => {
    if (/\bimport\s*\(|\bimport\s+(?:[\w*{]|['"])/.test(content)) problem('脚本包含模块导入，请先构建为不含模块导入的浏览器运行包。');
    if (/\b(?:fetch|Worker|SharedWorker|importScripts)\s*\(|\bXMLHttpRequest\b|\bdocument\.currentScript\b|\bnew\s+URL\s*\(/.test(content)) {
      const refs = [...content.matchAll(/\b(?:fetch|Worker|SharedWorker|importScripts|URL)\s*\(\s*(['"])(.*?)\1/g)].map(match => match[2]);
      const dynamic = /\b(?:fetch|Worker|SharedWorker|importScripts|URL)\s*\(\s*[^\s'"]/.test(content);
      if (dynamic || !refs.length || refs.some(ref => !['external', 'inline'].includes(classify(ref)))) problem('脚本包含动态本地资源或服务加载，本版无法自动打包；请提供自包含运行包。');
    }
    for (const match of content.matchAll(/https?:\/\/[^\s'"<>`\\)]+/g)) dependencies.add(match[0]);
  };
  if (!original.trim()) problem('HTML 入口没有内容，请补充后重新上传。');
  if (/<base\b/i.test(original)) problem('HTML 包含 base 地址设置，请移除并使用包内相对资源路径。');
  if (/<(?:iframe|object|embed)\b/i.test(original)) problem('组件包含嵌套页面或插件，请合并为单个组件入口后上传。');
  if (/\ssrcset\s*=/i.test(original)) problem('组件包含 srcset 多尺寸资源，请先改为单个资源地址。');

  let html = await replaceAsync(original, /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, async match => {
    const tag = match[0].match(/^<script\b[^>]*>/i)![0], source = attribute(tag, 'src');
    if (attribute(tag, 'type')?.toLowerCase() === 'module') problem('入口使用 ES 模块，请先构建为经典脚本运行包；本版不自动安装或构建依赖。');
    const content = match[0].slice(tag.length).replace(/<\/script\s*>$/i, '');
    if (!source) { script(content); return match[0]; }
    const local = lookup(source, entry);
    if (!local) return match[0];
    const js = decoder.decode(local.bytes);
    reserve(js.length);
    script(js);
    // Keep defer/async and script attributes: inlining a deferred script would
    // execute it before its DOM exists and change the original component.
    reserve(Math.ceil(local.bytes.length / 3) * 4);
    return `${replaceAttribute(tag, 'src', `data:text/javascript;base64,${base64(local.bytes)}`)}</script>`;
  });
  html = await replaceAsync(html, /<link\b[^>]*>/gi, async match => {
    const source = attribute(match[0], 'href');
    if (!source) return match[0];
    if (attribute(match[0], 'rel')?.toLowerCase() === 'stylesheet') {
      const local = lookup(source, entry);
      if (!local) return match[0];
      const compiled = new TextEncoder().encode(css(decoder.decode(local.bytes), local.path));
      reserve(Math.ceil(compiled.length / 3) * 4);
      return replaceAttribute(match[0], 'href', `data:text/css;base64,${base64(compiled)}`);
    }
    return replaceAttribute(match[0], 'href', dataReference(source, entry));
  });
  // Do not rewrite JavaScript string literals that happen to contain HTML or url(...).
  const scripts: string[] = [];
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, value => { scripts.push(value); return `<!--ZC_SCRIPT_${scripts.length - 1}-->`; });
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (whole, content) => whole.replace(content, css(content, entry)));
  html = html.replace(/<(?:img|video|audio|source|input)\b[^>]*>/gi, tag => {
    let updated = tag;
    for (const name of ['src', 'poster']) {
      const source = attribute(tag, name);
      if (source) updated = replaceAttribute(updated, name, dataReference(source, entry));
    }
    return updated;
  });
  html = html.replace(/<[a-z][^>]*>/gi, tag => {
    const style = attribute(tag, 'style');
    return style ? replaceAttribute(tag, 'style', css(style, entry)) : tag;
  });
  html = html.replace(/<!--ZC_SCRIPT_(\d+)-->/g, (_, index) => scripts[Number(index)] || '');
  if (html.length > 48 * 1024 * 1024) throw new Error('打包后的 HTML 过大，请减少资源后重试。');
  if (!checks.length) checks.push({ id: 'resources', status: 'pass', title: '静态资源检查通过', detail: files.size ? '已合并可识别的样式、经典脚本与媒体资源。' : '未发现缺失的静态本地资源。' });
  if (dependencies.size) checks.push({ id: 'network', status: 'warning', title: `发现 ${dependencies.size} 个外部引用`, detail: '启动预览后可能访问这些地址；可在技术详情中查看，尚未验证服务可用性。' });
  // The compiler decodes source as UTF-8; preserve that encoding when the
  // resulting document is later opened through a blob URL or an offline file.
  const charset = '<meta charset="utf-8">';
  if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, match => match + charset);
  else {
    const doctype = html.match(/^\s*<!doctype[^>]*>/i)?.[0];
    html = doctype ? doctype + charset + html.slice(doctype.length) : charset + html;
  }
  return { html, checks, dependencies: [...dependencies] };
}
