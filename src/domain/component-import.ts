import { componentPackageLimits, readComponentArchive, safeComponentPath } from './component-import-archive';
import { compileComponentHtml } from './component-import-html';
export { applyComponentValues } from './component-import-bridge';
export { createExampleComponentPackage } from './component-import-example';

export type ComponentValue = string | number | boolean;
export type ComponentValues = Record<string, ComponentValue>;
export interface ComponentField {
  key: string; label: string; type: 'text' | 'textarea' | 'color' | 'number' | 'boolean';
  default: ComponentValue; min?: number; max?: number;
}
export interface ComponentCheck { id: string; status: 'pass' | 'warning' | 'error'; title: string; detail: string }
export interface ComponentInspection {
  source: 'html' | 'package'; filename: string; name: string; description: string;
  html: string; fields: ComponentField[]; defaults: ComponentValues; checks: ComponentCheck[];
  canPreview: boolean; bridge: 'zhichuang-component-v1' | null; dependencies: string[];
  entryPath?: string; entryOptions?: string[]; hasManifest?: boolean;
}
const decoder = new TextDecoder('utf-8');
const fieldTypes = ['text', 'textarea', 'color', 'number', 'boolean'];
const forbiddenKeys = ['__proto__', 'prototype', 'constructor'];

export function validComponentValue(field: ComponentField, value: unknown): value is ComponentValue {
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
  if (typeof value !== 'string' || value.length > (field.type === 'textarea' ? 4000 : 500)) return false;
  return field.type !== 'color' || /^#[\da-f]{6}$/i.test(value);
}

function parseFields(value: unknown): ComponentField[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) throw new Error('组件参数 fields 应为数组，最多支持 30 个参数。');
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('组件参数格式无效。');
    const { key, label, type, default: initial, min, max } = item;
    if (typeof key !== 'string' || !/^[a-zA-Z][\w-]{0,39}$/.test(key) || forbiddenKeys.includes(key) || seen.has(key)) throw new Error('组件参数名称无效或重复。');
    seen.add(key);
    if (typeof label !== 'string' || !label.trim() || label.length > 60 || !fieldTypes.includes(type)) throw new Error('组件参数需要有效的显示名称和类型。');
    if ((min !== undefined && (typeof min !== 'number' || !Number.isFinite(min))) || (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max))) || (min !== undefined && max !== undefined && min > max)) throw new Error('数字参数范围无效。');
    const field: ComponentField = { key, label: label.trim(), type, default: initial, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
    if (!validComponentValue(field, initial)) throw new Error(`参数「${label}」的默认值无效。`);
    return field;
  });
}

function parseManifest(text: string) {
  let value: Record<string, unknown>;
  try { value = JSON.parse(text); } catch { throw new Error('component.json 格式无效，请检查 JSON 内容。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) throw new Error('组件清单需使用 schemaVersion: 1。');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new Error('组件清单需要名称，最多 80 个字。');
  if (typeof value.entry !== 'string' || !/\.html?$/i.test(value.entry)) throw new Error('组件入口需要指向已构建的 HTML 文件。');
  safeComponentPath(value.entry);
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 2000)) throw new Error('组件用途说明不能超过 2000 个字。');
  const fields = parseFields(value.fields);
  if ((value.bridge !== undefined && value.bridge !== 'zhichuang-component-v1') || (fields.length && value.bridge !== 'zhichuang-component-v1')) throw new Error('可编辑组件需要声明 zhichuang-component-v1 编辑协议。');
  return { name: value.name.trim(), description: (value.description as string | undefined) || '', entry: value.entry, fields, bridge: value.bridge === 'zhichuang-component-v1' ? 'zhichuang-component-v1' as const : null };
}

function finishInspection(base: Omit<ComponentInspection, 'checks' | 'canPreview' | 'dependencies'>, checked: Awaited<ReturnType<typeof compileComponentHtml>>): ComponentInspection {
  const checks: ComponentCheck[] = [
    ...checked.checks,
    { id: 'editing', status: base.fields.length ? 'warning' : 'pass', title: base.fields.length ? `声明了 ${base.fields.length} 个编辑参数` : '仅支持外层编辑', detail: base.fields.length ? '参数接口尚待预览连接验证，请在下一步试编辑。' : '可调整位置和尺寸，内部内容尚未开放编辑。' },
    { id: 'runtime', status: 'warning', title: '运行效果尚未验证', detail: '静态检查不能保证脚本执行成功，请启动预览并检查画面与交互。' },
    { id: 'offline', status: 'warning', title: checked.dependencies.length ? '发现联网引用，离线未验证' : '离线运行尚未验证', detail: checked.dependencies.length ? '包含外部地址，可能需要联网。正式交付前需补齐资源并进行断网验证。' : '未发现的动态资源或服务调用仍可能依赖网络，需在实际交付环境中验证。' },
  ];
  return { ...base, html: checked.html, checks, dependencies: checked.dependencies, canPreview: !checks.some(check => check.status === 'error') };
}

export async function inspectComponentFile(file: File, selectedEntry?: string): Promise<ComponentInspection | null> {
  if (!/\.(html?|zip)$/i.test(file.name)) return null;
  if (!file.size) throw new Error('文件为空，请选择包含内容的组件文件。');
  if (/\.zip$/i.test(file.name)) {
    const files = await readComponentArchive(file);
    if (!files) return null;
    const manifestPath = [...files.keys()].find(path => /(^|\/)component\.json$/i.test(path));
    if (!manifestPath) return inspectHtmlArchive(file, files, selectedEntry);
    if (files.get(manifestPath)!.length > 100 * 1024) throw new Error('组件清单不能超过 100 KB。');
    const manifest = parseManifest(decoder.decode(files.get(manifestPath)));
    const root = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1), entry = root + manifest.entry;
    const entryBytes = files.get(entry);
    if (!entryBytes) return finishInspection({ source: 'package', filename: file.name, ...manifest, html: '', defaults: Object.fromEntries(manifest.fields.map(field => [field.key, field.default])) }, { html: '', dependencies: [], checks: [{ id: 'entry', status: 'error', title: '缺少组件入口', detail: `找不到 ${entry}，请补充入口文件后重新上传。` }] });
    if (entryBytes.length > componentPackageLimits.htmlBytes) throw new Error('HTML 入口文件不能超过 5 MB。');
    const html = decoder.decode(entryBytes);
    return finishInspection({ source: 'package', filename: file.name, ...manifest, entryPath: entry, hasManifest: true, html, defaults: Object.fromEntries(manifest.fields.map(field => [field.key, field.default])) }, await compileComponentHtml(html, entry, files));
  }
  if (file.size > componentPackageLimits.htmlBytes) throw new Error('HTML 组件请控制在 5 MB 以内。');
  const html = await file.text();
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]+>/g, '').trim();
  const name = (title || file.name.replace(/\.html?$/i, '')).slice(0, 80);
  return finishInspection({ source: 'html', filename: file.name, name, description: '', html, fields: [], defaults: {}, bridge: null }, await compileComponentHtml(html, file.name, new Map()));
}

async function inspectHtmlArchive(file: File, files: Map<string, Uint8Array>, selectedEntry?: string): Promise<ComponentInspection> {
  const entryOptions = [...files.keys()].filter(path => /\.html?$/i.test(path)).sort();
  if (selectedEntry && !entryOptions.includes(selectedEntry)) throw new Error('所选入口不在这个组件包中，请重新选择。');
  const entryPath = selectedEntry || (entryOptions.length === 1 ? entryOptions[0] : '');
  const base = { source: 'package' as const, filename: file.name, name: file.name.replace(/\.zip$/i, '').slice(0, 80), description: '', html: '', fields: [], defaults: {}, bridge: null, entryPath, entryOptions, hasManifest: false };
  if (!entryPath) return { ...base, canPreview: false, dependencies: [], checks: [{ id: 'entry-choice', status: 'warning', title: '请选择要运行的 HTML 入口', detail: `压缩包中发现 ${entryOptions.length} 个 HTML 文件，选择入口后检查其关联资源。` }] };
  const bytes = files.get(entryPath)!;
  if (bytes.length > componentPackageLimits.htmlBytes) throw new Error('HTML 入口文件不能超过 5 MB。');
  const html = decoder.decode(bytes);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]+>/g, '').trim();
  return finishInspection({ ...base, html, name: (title || base.name).slice(0, 80) }, await compileComponentHtml(html, entryPath, files));
}
