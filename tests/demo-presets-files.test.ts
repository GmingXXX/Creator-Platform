import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import {demoPresetData} from '../src/features/home/demo-preset-data';
import {parseSkillPackage} from '../src/domain/skill-package';
import {extractDocumentText} from '../src/domain/document-intake';
const sourceFolders={timeline:'01_企业大事件',presentation:'02_智能演示',story:'03_互动影片',component:'04_组件生成'};
describe('curated demo inputs integration',()=>{
 for(const preset of demoPresetData)it(`${preset.title}保留原始演示资料且配套 Skill 与正文可解析`,async()=>{
  for(const item of [...preset.files,preset.skill]){
   const bytes=await readFile(resolve('public',item.url.slice(1)));
   if(preset.id!=='honors'&&item.url.includes('/v1/'))expect(bytes.equals(await readFile(resolve('output/智创真实演示资料_20261116',sourceFolders[preset.id],item.path)))).toBe(true);
   expect(bytes.length).toBeGreaterThan(0);
  }
  const skillBytes=await readFile(resolve('public',preset.skill.url.slice(1)));
  const skill=await parseSkillPackage(skillBytes,preset.skill.name);expect(skill.sourcePackage.instructions.length).toBeGreaterThan(100);
  if(!preset.files.length)return;
  const document=preset.files[0],bytes=await readFile(resolve('public',document.url.slice(1)));
  const text=await extractDocumentText(new File([bytes],document.name,{type:document.mime}));
  expect(text.length).toBeGreaterThan(100);
 });
});
