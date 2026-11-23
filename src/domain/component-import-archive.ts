import JSZip from 'jszip';

const MB = 1024 * 1024;
export const componentPackageLimits = { compressedBytes: 50 * MB, expandedBytes: 40 * MB, fileBytes: 12 * MB, entries: 250, htmlBytes: 5 * MB } as const;
const decoder = new TextDecoder('utf-8');

export function safeComponentPath(path: string): void {
  if (!path || path.includes('\0') || path.includes('\\') || path.startsWith('/') || /^[a-z]:/i.test(path)
    || path.split('/').some(part => part === '..' || part === '.')) throw new Error('组件包包含不安全的文件路径，请检查后重新压缩。');
}

function preflight(bytes: Uint8Array): boolean {
  if (bytes.length > componentPackageLimits.compressedBytes) throw new Error('组件 ZIP 请控制在 50 MB 以内。');
  if (bytes.length < 22) throw new Error('无法读取 ZIP，请上传完整的压缩文件。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('ZIP 文件不完整或格式不支持，请重新压缩。');
  const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count === 0xffff || offset === 0xffffffff) throw new Error('请使用普通 ZIP，不支持分卷或 ZIP64。');
  let limitError = count > componentPackageLimits.entries ? '组件包最多支持 250 个文件或目录。' : '';
  let hasComponent = false;
  const directorySize = view.getUint32(end + 12, true);
  if (view.getUint16(end + 8, true) !== count || offset + directorySize !== end) throw new Error('ZIP 文件目录数量或大小不一致，请重新压缩。');
  let cursor = offset, total = 0;
  const paths = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP 文件目录无效，请重新压缩。');
    const flags = view.getUint16(cursor + 8, true), compression = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true), nameLength = view.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (next > end) throw new Error('ZIP 文件目录不完整。');
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!name.split('/').some(part => part === '__MACOSX' || part.startsWith('._')) && (/\.html?$/i.test(name) || /(^|\/)component\.json$/i.test(name))) hasComponent = true;
    safeComponentPath(name);
    if (paths.has(name.toLowerCase())) throw new Error('组件包包含重复文件路径，请合并后上传。');
    paths.add(name.toLowerCase());
    if (flags & 1) throw new Error('不支持加密 ZIP，请解密后重新上传。');
    if (![0, 8].includes(compression)) throw new Error('ZIP 压缩方式不支持，请使用标准 ZIP。');
    if (((view.getUint32(cursor + 38, true) >>> 16) & 0xf000) === 0xa000) throw new Error('组件包包含符号链接，请使用实际文件。');
    if (size > componentPackageLimits.fileBytes) limitError ||= '组件包单文件大小不能超过 12 MB。';
    total += size;
    if (total > componentPackageLimits.expandedBytes) limitError ||= '组件包解压后的总大小不能超过 40 MB。';
    cursor = next;
  }
  if (cursor !== offset + directorySize) throw new Error('ZIP 文件目录数量不一致，请重新压缩。');
  if (hasComponent && limitError) throw new Error(limitError);
  return hasComponent;
}

function boundedRead(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array> {
  const stream = (entry as JSZip.JSZipObject & { internalStream: (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array> }).internalStream('uint8array');
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0, settled = false;
    stream.on('data', chunk => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) { settled = true; stream.pause(); reject(new Error('组件包实际解压大小超过限制。')); return; }
      chunks.push(chunk);
    }).on('error', () => {
      if (!settled) { settled = true; reject(new Error('组件包文件损坏，请重新上传。')); }
    }).on('end', () => {
      if (settled) return;
      settled = true;
      const result = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      resolve(result);
    }).resume();
  });
}

export async function readComponentArchive(file: File): Promise<Map<string, Uint8Array> | null> {
  if (file.size > componentPackageLimits.compressedBytes) throw new Error('组件 ZIP 请控制在 50 MB 以内。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!preflight(bytes)) return null;
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); } catch { throw new Error('无法解析 ZIP，请重新压缩后上传。'); }
  if (Object.keys(zip.files).length > componentPackageLimits.entries) throw new Error('组件包最多支持 250 个文件或目录。');
  const entries = Object.values(zip.files).filter(entry => !entry.dir && !entry.name.split('/').some(part => part === '__MACOSX' || part.startsWith('._') || part === '.DS_Store'));
  const manifests = entries.filter(entry => /(^|\/)component\.json$/i.test(entry.name));
  if (!manifests.length && !entries.some(entry => /\.html?$/i.test(entry.name))) return null;
  if (manifests.length > 1) throw new Error('每个组件包只能包含一个 component.json。');
  if (manifests[0] && manifests[0].name.split('/').length > 2) throw new Error('请将 component.json 放在根目录或一个外层文件夹内。');
  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (const entry of entries) {
    safeComponentPath(entry.unsafeOriginalName || entry.name);
    safeComponentPath(entry.name);
    const data = await boundedRead(entry, Math.min(componentPackageLimits.fileBytes, componentPackageLimits.expandedBytes - total));
    total += data.length;
    files.set(entry.name, data);
  }
  return files;
}
