import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, '.standalone-build');

const MIME = {
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.html': 'text/html',
};

const toDataUri = file => {
  const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  return fs.readFile(path.join(tmpDir, 'media', file)).then(buf => `data:${mime};base64,${buf.toString('base64')}`);
};

// 把 `/media/<name>` 的模板字符串改写成 __media(`<name>`)，保留原有插值。
function transformTemplates(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    if (code[i] !== '`' || !code.startsWith('`/media/', i)) {
      out += code[i++];
      continue;
    }
    let j = i + 1;
    let depth = 0;
    let inExpr = false;
    let quote = null;
    while (j < code.length) {
      const c = code[j];
      if (inExpr) {
        if (quote) {
          if (c === '\\') { j += 2; continue; }
          if (c === quote) quote = null;
          j++;
          continue;
        }
        if (c === '"' || c === "'") { quote = c; j++; continue; }
        if (c === '}' && depth === 0) { inExpr = false; j++; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        j++;
        continue;
      }
      if (c === '\\') { j += 2; continue; }
      if (c === '$' && code[j + 1] === '{') { inExpr = true; j += 2; continue; }
      if (c === '`') break;
      j++;
    }
    const inner = code.slice(i + 1, j).replace(/^\/media\//, '');
    out += `__media(\`${inner}\`)`;
    i = j + 1;
  }
  return out;
}

const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const date = new Date();
const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
const target = path.join(root, 'output', `智创平台_独立版_V${pkg.version.split('.')[0]}.${pkg.version.split('.')[1]}_${stamp}.html`);

await fs.rm(tmpDir, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  base: './',
  logLevel: 'warn',
  plugins: [react()],
  build: {
    outDir: tmpDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const assetsDir = path.join(tmpDir, 'assets');
const assetFiles = await fs.readdir(assetsDir);
const jsName = assetFiles.find(name => name.endsWith('.js'));
const cssName = assetFiles.find(name => name.endsWith('.css'));
if (!jsName) throw new Error('构建产物中未找到 JS');

const mediaFiles = await fs.readdir(path.join(tmpDir, 'media'));
const table = {};
for (const file of mediaFiles) table[file] = await toDataUri(file);

let js = await fs.readFile(path.join(assetsDir, jsName), 'utf8');
js = js.replace(/"\/media\/([A-Za-z0-9._-]+)"/g, (_, name) => `__media("${name}")`);
js = transformTemplates(js);
const leftover = js.match(/(["'`])\/media\//);
if (leftover) throw new Error('仍有未内联的 /media/ 引用');

// 媒体在启动时转成 blob URL（体积小、可被 useMedia/resolveMedia 直接使用）；
// localStorage 写入时压成 media://name 令牌，读取时还原为当前会话的 blob URL，避免超过 5MB 配额。
const helper = `var __MEDIA_DATA=${JSON.stringify(table)};
var __mediaUrls=(function(d){var u={};Object.keys(d).forEach(function(k){var t=d[k],i=t.indexOf(','),m=t.slice(5,i).split(';')[0],b=atob(t.slice(i+1)),a=new Uint8Array(b.length);for(var j=0;j<b.length;j++)a[j]=b.charCodeAt(j);u[k]=URL.createObjectURL(new Blob([a],{type:m}))});return u})(__MEDIA_DATA);
var __media=function(n){return !n||/^(data:|blob:|https?:)/.test(n)?n:(__mediaUrls[n]||n)};
(function(){var p=Object.keys(__mediaUrls).map(function(k){return [__mediaUrls[k],'media://'+k]}),S=Storage.prototype,g=S.getItem,s=S.setItem;
function pack(v){if(typeof v!=='string')return v;for(var i=0;i<p.length;i++)v=v.split(p[i][0]).join(p[i][1]);return v}
function unpack(v){if(typeof v!=='string')return v;for(var i=0;i<p.length;i++)v=v.split(p[i][1]).join(p[i][0]);return v}
S.getItem=function(k){return unpack(g.call(this,k))};S.setItem=function(k,v){return s.call(this,k,pack(v))}})();
`;
const moduleCode = (helper + js).replace(/<\/script/gi, '<\\/script');

let html = await fs.readFile(path.join(tmpDir, 'index.html'), 'utf8');
if (cssName) {
  const css = await fs.readFile(path.join(assetsDir, cssName), 'utf8');
  html = html.replace(/<link[^>]*href="\.?\/?assets\/[^"]+\.css"[^>]*>/g, () => `<style>${css}</style>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
html = html.replace(/<script[^>]*src="\.?\/?assets\/[^"]+\.js"[^>]*><\/script>/g, () => `<script type="module">${moduleCode}</script>`);

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, html);
await fs.rm(tmpDir, { recursive: true, force: true });

const { size } = await fs.stat(target);
console.log(`已生成 ${target}`);
console.log(`体积 ${(size / 1024 / 1024).toFixed(2)} MB`);
