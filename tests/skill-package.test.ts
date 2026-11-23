import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createExampleSkillPackage, parseSkillPackage, skillPackageLimits } from '../src/domain/skill-package';

const instructions = `---\nname: history-timeline\ndescription: 将企业发展资料编排为可编辑时间轴\nmetadata:\n  version: '1.2'\n---\n# 企业时间轴\n## 输入\n企业名称、年份和事件\n## 步骤\n1. 提取年份和事件\n2. 编排可点击节点\n`;
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE0cAAAAASUVORK5CYII=';
async function zip(files:Record<string,string|Uint8Array>,options:JSZip.JSZipGeneratorOptions<'uint8array'>={type:'uint8array'}) {
 const pack=new JSZip();for(const [name,value] of Object.entries(files))pack.file(name,value);return pack.generateAsync(options);
}

describe('Skill ZIP import',()=>{
 it('imports a root SKILL.md, references and preview with persisted source data',async()=>{
  const data=await zip({'SKILL.md':instructions,'references/style.md':'# 示例\n保留照片的原有比例。','assets/preview.png':Uint8Array.from(Buffer.from(png,'base64'))});
  const skill=await parseSkillPackage(data,'history.zip');
  expect(skill.name).toBe('企业时间轴');expect(skill.description).toContain('企业发展');expect(skill.version).toBe('1.2');expect(skill.input).toBe('企业名称、年份和事件');expect(skill.steps).toEqual(['提取年份和事件','编排可点击节点']);
  expect(skill.sourcePackage.entry).toBe('SKILL.md');expect(skill.sourcePackage.files.find(f=>f.path==='references/style.md')?.content).toContain('原有比例');expect(skill.sourcePackage.preview).toMatch(/^data:image\/png;base64,/);expect(skill.personal).toBe(true);
 });
 it('accepts one outer folder and records scripts without executing them',async()=>{
  const skill=await parseSkillPackage(await zip({'timeline/SKILL.md':instructions,'timeline/scripts/build.js':'throw new Error("must never run")'}),'skill.ZIP');
  expect(skill.sourcePackage.entry).toBe('timeline/SKILL.md');expect(skill.sourcePackage.hasScripts).toBe(true);expect(skill.sourcePackage.files).toHaveLength(2);
 });
 it('accepts Markdown-only instructions and optional JSON manifest',async()=>{
  const skill=await parseSkillPackage(await zip({'SKILL.md':'# 排版助手\n整理内容层级与阅读顺序。\n## 工作方法\n- 保留资料事实\n- 建立标题层级','skill.json':JSON.stringify({version:'2.0',input:'一段文章',previewType:'text'})}),'layout.zip');
  expect(skill.name).toBe('排版助手');expect(skill.version).toBe('2.0');expect(skill.steps).toHaveLength(2);expect(skill.previewType).toBe('text');
 });
 it('round trips the downloadable example archive',async()=>{
  const example=await createExampleSkillPackage();const skill=await parseSkillPackage(example,'企业时间轴编排.zip');
  expect(skill.name).toBe('企业时间轴编排');expect(skill.sourcePackage.files.some(f=>f.path.includes('references/'))).toBe(true);expect(skill.sourcePackage.files.some(f=>f.path.includes('assets/'))).toBe(true);
 });
 it('rejects bare files, malformed archives and missing or ambiguous entrypoints',async()=>{
  await expect(parseSkillPackage(new TextEncoder().encode(instructions),'SKILL.md')).rejects.toThrow('ZIP');
  await expect(parseSkillPackage(new Uint8Array([1,2,3]),'bad.zip')).rejects.toThrow('ZIP');
  await expect(parseSkillPackage(await zip({'readme.md':'none'}),'missing.zip')).rejects.toThrow('SKILL.md');
  await expect(parseSkillPackage(await zip({'a/SKILL.md':instructions,'b/SKILL.md':instructions}),'two.zip')).rejects.toThrow('一个');
  await expect(parseSkillPackage(await zip({'a/b/SKILL.md':instructions}),'deep.zip')).rejects.toThrow('根目录');
 });
 it('rejects unsafe paths even when JSZip would sanitize them',async()=>{
  for(const path of ['../outside.txt','/absolute.txt','C:/absolute.txt','safe/../../outside.txt','safe\\..\\outside.txt']){
   await expect(parseSkillPackage(await zip({'SKILL.md':instructions,[path]:'bad'}),'unsafe.zip')).rejects.toThrow(/路径|目录/);
  }
 });
 it('rejects symlinks and case-insensitive duplicate paths',async()=>{
  const pack=new JSZip();pack.file('SKILL.md',instructions);pack.file('link','/etc/passwd',{unixPermissions:0o120777});
  await expect(parseSkillPackage(await pack.generateAsync({type:'uint8array',platform:'UNIX'}),'symlink.zip')).rejects.toThrow('符号链接');
  await expect(parseSkillPackage(await zip({'SKILL.md':instructions,'a.txt':'a','A.txt':'b'}),'duplicate.zip')).rejects.toThrow('重复');
 });
 it('enforces compressed, expanded, entry and instruction limits',async()=>{
  await expect(parseSkillPackage(new Uint8Array(skillPackageLimits.compressedBytes+1),'large.zip')).rejects.toThrow('10 MB');
  const pack=new JSZip();pack.file('SKILL.md',instructions);pack.file('large.txt','x'.repeat(skillPackageLimits.fileBytes+1));
  await expect(parseSkillPackage(await pack.generateAsync({type:'uint8array',compression:'DEFLATE'}),'expanded.zip')).rejects.toThrow('单个文件');
  const many:Record<string,string>={'SKILL.md':instructions};for(let i=0;i<skillPackageLimits.entries;i++)many[`file-${i}.txt`]='a';
  await expect(parseSkillPackage(await zip(many),'many.zip')).rejects.toThrow('文件数量');
  await expect(parseSkillPackage(await zip({'SKILL.md':'# 名称\n'+ 'x'.repeat(skillPackageLimits.instructionsBytes)}),'instructions.zip')).rejects.toThrow('技能说明');
 });
 it('rejects unusable descriptions and does not treat active SVG as a preview',async()=>{
  await expect(parseSkillPackage(await zip({'SKILL.md':'---\nname: empty\n---'}),'empty.zip')).rejects.toThrow('名称和用途');
  const skill=await parseSkillPackage(await zip({'SKILL.md':instructions,'assets/preview.svg':'<svg><script>alert(1)</script></svg>'}),'svg.zip');
  expect(skill.sourcePackage.preview).toBeUndefined();expect(skill.sourcePackage.files[1].content).toContain('script');
 });
});
