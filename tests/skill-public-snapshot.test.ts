import JSZip from 'jszip';
import {describe,it,expect} from 'vitest';
import {createSkillDraft,getSkillMetadata,syncSkillPackage} from '../src/domain/skill-metadata';
import {publicSkillSnapshot,normalizeSkill} from '../src/domain/skill-publication';
import {exportSkillPackage,parseSkillPackage} from '../src/domain/skill-package';
describe('public skill package scope',()=>{
 it('removes internal ownership and experience metadata from definitions and known manifest files',async()=>{
  const draft=createSkillDraft(),metadata={...getSkillMetadata(draft),ownerAccount:'private-owner',allowedWorkspaceIds:['private-workspace'],provenance:{workId:'private-work',workTitle:'未公开客户',experienceVersion:3}};
  const base=syncSkillPackage({...draft,name:'通用方法',description:'制作规则',input:'资料',steps:['检查事实'],metadata});
  const original={...base,sourcePackage:{...base.sourcePackage!,storageKey:'private-original-zip',files:[...base.sourcePackage!.files,{path:'skill.json',size:200,mime:'application/json',content:JSON.stringify({name:base.name,metadata})}]}};
  const safe=publicSkillSnapshot(original);
  expect(JSON.stringify(safe)).not.toContain('private-owner');expect(JSON.stringify(safe)).not.toContain('private-workspace');expect(JSON.stringify(safe)).not.toContain('未公开客户');
  expect(safe.sourcePackage?.storageKey).toBeUndefined();expect(original.metadata.provenance.workTitle).toBe('未公开客户');
  const pub={...safe,public:true,personal:false};await expect(parseSkillPackage(await exportSkillPackage(pub),'safe.zip')).resolves.toMatchObject({name:'通用方法'});
 });
 it('cleans platform metadata from historical SKILL frontmatter while retaining executable guidance',()=>{
  const draft=createSkillDraft(),instructions='---\nname: method\nownerAccount: private-owner\nprovenance:\n  workTitle: 未公开客户\nallowedWorkspaceIds:\n  - private-space\nversion: 1.0\n---\n# 方法\n\n来源作品：未公开客户（private-work），整理版本3。\n\n## 执行\n保留的执行说明';
  const source={...draft,sourcePackage:{filename:'old.zip',entry:'SKILL.md',instructions,files:[{path:'SKILL.md',content:instructions,size:100,mime:'text/markdown'}],hasScripts:false}};
  const safe=publicSkillSnapshot(source);expect(JSON.stringify(safe)).not.toContain('未公开客户');expect(JSON.stringify(safe)).not.toContain('private-owner');expect(safe.sourcePackage?.instructions).toContain('保留的执行说明');
 });
 it('rebuilds a public archive without private manifests while preserving binary dependencies',async()=>{
  const draft=createSkillDraft(),skill=syncSkillPackage({...draft,name:'方法',description:'说明',input:'资料',steps:['检查']});
  const zip=new JSZip();zip.file('SKILL.md',skill.sourcePackage!.instructions);zip.file('legacy/manifest.json',JSON.stringify({metadata:{ownerAccount:'private-owner',provenance:{workTitle:'私密客户'}}}));zip.file('assets/model.bin',new Uint8Array([0,1,9,255]));
  const original=new Blob([await zip.generateAsync({type:'uint8array'})]);
  const safe={...publicSkillSnapshot({...skill,sourcePackage:{...skill.sourcePackage!,storageKey:'private-zip',files:[...skill.sourcePackage!.files,{path:'assets/model.bin',mime:'application/octet-stream',size:4}]}}),public:true,personal:false};
  const archive=await JSZip.loadAsync(await exportSkillPackage(safe,original));
  expect(await archive.file('legacy/manifest.json')!.async('string')).not.toContain('私密客户');
  expect([...await archive.file('assets/model.bin')!.async('uint8array')]).toEqual([0,1,9,255]);
 });

 it('normalizes public snapshots idempotently without restoring internal ownership or restricted scope',async()=>{
  const draft=createSkillDraft(),source={...draft,name:'方法',description:'说明',input:'资料',steps:['检查'],metadata:{...getSkillMetadata(draft),visibility:'restricted' as const,allowedWorkspaceIds:['private-space']}};
  const safe={...publicSkillSnapshot(source),public:true,personal:false};
  expect(normalizeSkill(normalizeSkill(safe))).toEqual(normalizeSkill(safe));expect(normalizeSkill(safe).metadata?.ownerAccount).toBeUndefined();expect(normalizeSkill(safe).metadata?.allowedWorkspaceIds).toBeUndefined();
  await expect(exportSkillPackage(normalizeSkill(safe))).resolves.toBeInstanceOf(Uint8Array);
 });

});
