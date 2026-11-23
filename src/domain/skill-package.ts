import {cleanPublicSkillManifest,cleanPublicSkillInstructions} from './skill-publication';
import {getSkillMetadata,syncSkillPackage,validateSkillMetadata} from './skill-metadata';
import JSZip from 'jszip';
import type { NodeKind, Skill } from './types';

const MB = 1024 * 1024;
export const skillPackageLimits = {
  compressedBytes: 10 * MB,
  expandedBytes: 20 * MB,
  fileBytes: 5 * MB,
  instructionsBytes: 200 * 1024,
  entries: 120,
  previewBytes: 256 * 1024,
  retainedTextBytes: 400 * 1024,
} as const;

type SourceFile = { path: string; size: number; mime: string; content?: string; dataUrl?: string };
export type ImportedSkill = Skill & { sourcePackage: {
  filename: string; entry: string; instructions: string; files: SourceFile[];
  preview?: string; hasScripts: boolean; storageKey?: string; resourceStorageKey?: string;
} };
const decoder = new TextDecoder('utf-8');
const allowedPreviews: NodeKind[] = ['text', 'image', 'card', 'timeline', 'gallery', 'graph', 'map', 'flow', 'chart', 'bubble'];

function safePath(path: string): void {
  if (!path || path.includes('\0') || path.includes('\\') || path.startsWith('/') || /^[a-z]:/i.test(path)
    || path.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('技能包包含不安全的文件路径，请检查压缩目录后重试。');
  }
}

/** Inspect central-directory limits and original names before JSZip normalizes paths. */
function preflight(bytes: Uint8Array): void {
  if (bytes.length > skillPackageLimits.compressedBytes) throw new Error('技能 ZIP 请控制在 10 MB 以内。');
  if (bytes.length < 22) throw new Error('无法读取 ZIP，请选择完整的技能压缩包。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('ZIP 文件不完整或格式不支持，请重新压缩后上传。');
  const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count === 0xffff || offset === 0xffffffff) {
    throw new Error('请使用普通 ZIP 格式，不支持分卷或 ZIP64 技能包。');
  }
  if (count > skillPackageLimits.entries) throw new Error('技能包文件数量过多，最多支持 120 个目录或文件。');
  let cursor = offset, total = 0;
  const paths = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP 文件目录无效，请重新压缩。');
    const flags = view.getUint16(cursor + 8, true), compression = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true), nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw new Error('ZIP 文件目录不完整。');
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    safePath(name);
    const canonical = name.toLowerCase();
    if (paths.has(canonical)) throw new Error('技能包包含重复文件路径，请合并后重新上传。');
    paths.add(canonical);
    if (flags & 1) throw new Error('不支持加密 ZIP，请解密后重新压缩。');
    if (![0, 8].includes(compression)) throw new Error('ZIP 压缩方式不支持，请使用标准 ZIP 压缩。');
    const mode = view.getUint32(cursor + 38, true) >>> 16;
    if ((mode & 0xf000) === 0xa000) throw new Error('技能包包含符号链接，请改为实际文件后上传。');
    if (size > skillPackageLimits.fileBytes) throw new Error('技能包中单个文件不能超过 5 MB。');
    total += size;
    if (total > skillPackageLimits.expandedBytes) throw new Error('技能包解压后不能超过 20 MB。');
    if (/(^|\/)SKILL\.md$/i.test(name) && size > skillPackageLimits.instructionsBytes) throw new Error('技能说明 SKILL.md 不能超过 200 KB。');
    cursor = next;
  }
}

function boundedRead(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array> {
  // JSZip exposes internalStream on file entries; bounded consumption avoids accumulating excess output.
  const stream = (entry as JSZip.JSZipObject & {
    internalStream: (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array>;
  }).internalStream('uint8array');
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0, settled = false;
    stream.on('data', chunk => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) { settled = true; stream.pause(); reject(new Error('技能包实际解压内容超过允许大小。')); return; }
      chunks.push(chunk);
    }).on('error', () => {
      if (!settled) { settled = true; reject(new Error('技能包中的文件损坏，请重新压缩上传。')); }
    }).on('end', () => {
      if (settled) return;
      settled = true;
      const output = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
      resolve(output);
    }).resume();
  });
}

function scalar(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
}
function parseInstructions(markdown: string): { meta: Record<string, string>; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const frontmatter = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!frontmatter) return { meta: {}, body: normalized };
  const meta: Record<string, string> = {};
  const lines = frontmatter[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*(name|description|version|category|input|styleId|previewType|preview):\s*(.*?)\s*$/);
    if (!match) continue;
    if (/^[|>][-+]?$/.test(match[2])) {
      const values: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]) && !/^\s*\w+:/.test(lines[i + 1])) values.push(lines[++i].trim());
      meta[match[1]] = values.join(match[2].startsWith('>') ? ' ' : '\n');
    } else meta[match[1]] = scalar(match[2]);
  }
  return { meta, body: normalized.slice(frontmatter[0].length) };
}

function manifestDefinition(files: SourceFile[], root: string): Record<string, unknown> {
  const file = files.find(item => [root + 'skill.json', root + 'manifest.json'].includes(item.path));
  if (!file?.content) return {};
  let value: unknown;
  try { value = JSON.parse(file.content); } catch { throw new Error('技能包中的 JSON 清单格式无效。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('技能 JSON 清单应是一个对象。');
  return value as Record<string,unknown>;
}
function manifestData(files:SourceFile[],root:string):Record<string,string> {
 return Object.fromEntries(Object.entries(manifestDefinition(files,root)).filter(([key,item])=>['name','description','version','category','input','styleId','previewType','preview','author'].includes(key)&&typeof item==='string')) as Record<string,string>;
}
function describeSkill(markdown: string, files: SourceFile[], root: string): Omit<Skill, 'id'> {
  const { meta, body } = parseInstructions(markdown);
  const data = { ...manifestData(files, root), ...meta };
  const paragraphs = body.split(/\n\s*\n/).map(value => value.trim());
  const name = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || data.name;
  const description = data.description || paragraphs.find(value => value && !/^#|^\d+[.)、]|^[-*]\s/.test(value)) || body.split('\n').map(line => line.trim()).find(line => line && !/^#|^\d+[.)、]|^[-*]\s/.test(line));
  if (!name?.trim() || !description?.trim()) throw new Error('技能说明需要包含名称和用途说明。');
  const input = data.input || body.match(/^##\s*(?:输入|需要提供|Inputs?)\s*\n([\s\S]*?)(?=^##\s|$)/im)?.[1]?.trim();
  const steps = body.split('\n').filter(line => /^\s*(?:\d+[.)、]|[-*])\s+\S/.test(line)).map(line => line.replace(/^\s*(?:\d+[.)、]|[-*])\s+/, '').trim());
  const previewType = allowedPreviews.includes(data.previewType as NodeKind) ? data.previewType as NodeKind : 'card';
  return { name: name.slice(0, 60), description: description.slice(0, 1000), input: (input || '补充本次创作主题与参考资料').slice(0, 1000),
    steps: (steps.length ? steps : [description]).slice(0, 20).map(step => step.slice(0, 500)), version: (data.version || '1.0').slice(0, 30),
    category: (data.category || '我的技能').slice(0, 40), styleId: ['industrial','technology','government','culture','jewelry','finance'].includes(data.styleId) ? data.styleId : '',
    previewType, author: data.author||'纪鸣', personal: true };
}
function mimeFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', md: 'text/markdown', txt: 'text/plain', json: 'application/json', csv: 'text/csv', js: 'text/javascript', ts: 'text/plain', py: 'text/plain', html: 'text/html' } as Record<string, string>)[extension] || 'application/octet-stream';
}
function rasterMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/png') return bytes[0] === 137 && decoder.decode(bytes.subarray(1, 4)) === 'PNG';
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216;
  if (mime === 'image/gif') return decoder.decode(bytes.subarray(0, 3)) === 'GIF';
  return mime === 'image/webp' && decoder.decode(bytes.subarray(0, 4)) === 'RIFF' && decoder.decode(bytes.subarray(8, 12)) === 'WEBP';
}
function base64(bytes: Uint8Array): string {
  let value = '';
  for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}

export async function parseSkillPackage(bytes: Uint8Array, filename: string): Promise<ImportedSkill> {
  if (!/\.zip$/i.test(filename)) throw new Error('请上传 ZIP 技能包，包内需包含 SKILL.md。');
  preflight(bytes);
  let archive: JSZip;
  try { archive = await JSZip.loadAsync(bytes); } catch { throw new Error('无法解析 ZIP，请重新压缩后上传。'); }
  const entries = Object.values(archive.files).filter(entry => !entry.dir);
  const instructions = entries.filter(entry => /(^|\/)SKILL\.md$/i.test(entry.name));
  if (instructions.length !== 1) throw new Error(instructions.length ? '每个 ZIP 只能包含一个 SKILL.md 技能入口。' : '技能包缺少 SKILL.md，请放在根目录或一个技能文件夹中。');
  const entry = instructions[0].name;
  if (entry.split('/').length > 2) throw new Error('请将 SKILL.md 放在根目录或一个外层技能文件夹中。');
  const root = entry.slice(0, entry.lastIndexOf('/') + 1);
  const files: SourceFile[] = [];
  let expanded = 0, retainedText = 0, retainedImages = 0;
  for (const item of entries) {
    safePath(item.unsafeOriginalName || item.name);
    safePath(item.name);
    const data = await boundedRead(item, Math.min(skillPackageLimits.fileBytes, skillPackageLimits.expandedBytes - expanded));
    expanded += data.length;
    if (item.name === entry && data.length > skillPackageLimits.instructionsBytes) throw new Error('技能说明 SKILL.md 不能超过 200 KB。');
    const mime = mimeFor(item.name), file: SourceFile = { path: item.name, size: data.length, mime };
    const text = mime.startsWith('text/') || ['application/json', 'image/svg+xml'].includes(mime);
    if (text && (item.name === entry || retainedText + data.length <= skillPackageLimits.retainedTextBytes)) {
      file.content = decoder.decode(data); retainedText += data.length;
    }
    if (data.length <= skillPackageLimits.previewBytes && retainedImages + data.length <= 512 * 1024 && rasterMatches(data, mime)) { file.dataUrl = `data:${mime};base64,${base64(data)}`; retainedImages += data.length; }
    files.push(file);
  }
  const markdown = files.find(file => file.path === entry)?.content || '';
  const parsed = parseInstructions(markdown), manifest = manifestData(files, root);
  const previewPath = parsed.meta.preview || manifest.preview;
  const preview = files.find(file => file.dataUrl && (file.path === root + previewPath || /(^|\/)(preview|cover|thumbnail)\.(png|jpe?g|webp|gif)$/i.test(file.path)))?.dataUrl;
  const definition=manifestDefinition(files,root);
  const base:ImportedSkill={ id: `skill-${crypto.randomUUID()}`, ...describeSkill(markdown, files, root), sourcePackage: {
    filename, entry, instructions: markdown, files, preview, hasScripts: files.some(file => /(^|\/)scripts\//i.test(file.path) || /\.(js|ts|py|sh|bat|ps1)$/i.test(file.path)),
  } };
  if(!definition.metadata)return base;
  if(typeof definition.metadata!=='object'||Array.isArray(definition.metadata))throw new Error('技能元信息清单无效。');
  const metadata=getSkillMetadata({...base,metadata:definition.metadata as Skill['metadata']});
  const imported={...base,name:typeof definition.name==='string'?definition.name:base.name,steps:Array.isArray(definition.steps)?definition.steps as string[]:base.steps,metadata:{...metadata,visibility:'private' as const,ownerAccount:'jiming',allowedWorkspaceIds:[]},enabled:false,public:false,workspaceId:'personal'};
  validateSkillMetadata(imported);return imported;
}

export async function exportSkillPackage(skill:Skill,originalBlob?:Blob):Promise<Uint8Array> {
 const current=syncSkillPackage(skill),pack=current.sourcePackage!;
 const zip=originalBlob?await JSZip.loadAsync(await originalBlob.arrayBuffer()):new JSZip();
 if(skill.public){
  for(const file of Object.values(zip.files).filter(file=>!file.dir)){
   if(/(^|\/)(skill|manifest)\.json$/i.test(file.name)){const value=JSON.parse(await file.async('string'));if(value&&typeof value==='object'&&!Array.isArray(value))zip.file(file.name,JSON.stringify(cleanPublicSkillManifest(value),null,2));}
   else if(/(^|\/)SKILL\.md$/i.test(file.name))zip.file(file.name,cleanPublicSkillInstructions(await file.async('string')));
  }
 }
 for(const file of pack.files){
  safePath(file.path);
  if(file.content!==undefined)zip.file(file.path,file.content);
  else if(file.dataUrl)zip.file(file.path,file.dataUrl.slice(file.dataUrl.indexOf(',')+1),{base64:true});
  else if(!zip.file(file.path)&&file.size>0)throw new Error('部分资源仅保存在原始 ZIP，请恢复原始包后导出。');
 }
 const root=pack.entry.slice(0,pack.entry.lastIndexOf('/')+1);
 zip.file(pack.entry,pack.instructions);
 zip.file(root+'skill.json',JSON.stringify({id:skill.id,name:skill.name,description:skill.description,version:skill.version,author:skill.author,category:skill.category,input:skill.input,steps:skill.steps,styleId:skill.styleId,previewType:skill.previewType,metadata:skill.public?cleanPublicSkillManifest(getSkillMetadata(skill) as unknown as Record<string,unknown>):getSkillMetadata(skill)},null,2));
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}

export async function createExampleSkillPackage(): Promise<Uint8Array> {
  const zip = new JSZip();
  const folder = zip.folder('enterprise-timeline')!;
  folder.file('SKILL.md', `---\nname: enterprise-timeline\ndescription: 根据企业发展资料，编排可点击、可继续编辑的横向时间轴。\nmetadata:\n  version: "1.0"\ncategory: 展项编排\npreviewType: timeline\n---\n# 企业时间轴编排\n\n## 输入\n企业名称、关键年份、事件说明、图片与目标屏幕比例。\n\n## 执行步骤\n1. 提取并核对资料中的年份与事件，不补造事实。\n2. 根据事件数量编排时间轴，突出重要节点。\n3. 绑定点击详情和页面过渡，保留可编辑内容。\n\n## 参考资料\n- 使用 references/layout.md 中的版式约定。\n- assets/example.json 提供输入数据格式。\n`);
  folder.file('references/layout.md', '# 时间轴版式约定\n\n保持年份、标题和图片对应。事件较多时允许左右浏览，详情可关闭并返回原位置。');
  folder.file('assets/example.json', JSON.stringify({ company: '示例企业', events: [{ year: '2024', title: '示例事件', description: '请替换为已核实的项目资料。' }] }, null, 2));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
