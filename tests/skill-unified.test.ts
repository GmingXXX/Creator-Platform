import {describe,it,expect} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {createSkillDraft,getSkillMetadata,syncSkillPackage,validateSkillMetadata} from '../src/domain/skill-metadata';
import {skillAvailableToActor,skillCanManage} from '../src/domain/skill-access';
import {pinWorkSkills} from '../src/domain/resource-sharing';
import {exportSkillPackage,parseSkillPackage} from '../src/domain/skill-package';
import {skillVersion} from '../src/domain/skill-publication';
const state=()=>createInitialData();
describe('unified skills and metadata',()=>{
 it('creates a private disabled draft usable across projects by its owner',()=>{
  const skill=createSkillDraft();expect(skill).toMatchObject({personal:true,public:false,enabled:false,workspaceId:'personal'});
  expect(getSkillMetadata(skill).visibility).toBe('private');expect(skillAvailableToActor(skill,{...state(),activeWorkspaceId:'xintai'})).toBe(true);
 });
 it('keeps legacy project methods restricted to members even from the unified directory',()=>{
  const s=state(),legacy={...s.skills[0],id:'legacy',personal:true,public:false,workspaceId:'xintai',metadata:undefined};
  expect(getSkillMetadata(legacy)).toMatchObject({visibility:'restricted',allowedWorkspaceIds:['xintai']});
  expect(skillAvailableToActor(legacy,s)).toBe(true);
  const outsider={...s,activeWorkspaceId:'dongguan',workspaceActors:{...s.workspaceActors,dongguan:'outsider'},workspaceMembers:{...s.workspaceMembers,dongguan:[{id:'outsider',name:'访客',account:'visitor',role:'viewer' as const,status:'member' as const}]}};
  expect(skillAvailableToActor(legacy,outsider)).toBe(false);expect(skillAvailableToActor(createSkillDraft(),outsider)).toBe(false);expect(skillCanManage(legacy,outsider)).toBe(false);
 });
 it('pins an immutable used version without copying a skill into a project',()=>{
  const s=state(),skill=s.skills[0],work={...s.works[0],creationPackage:{id:'pack',version:'1',prompt:'',files:[],params:{},skillIds:[skill.id],complete:true}};
  let copied=false;const next=pinWorkSkills(work,[skill],'xintai',()=>{copied=true;return skill});
  expect(copied).toBe(false);expect(next.creationPackage?.skillSnapshots?.[0]).toEqual(skill);
  expect(next.creationPackage?.skillSnapshots?.[0]).not.toBe(skill);
 });
 it('validates declaration fields and versions, and hashes metadata changes',()=>{
  const draft=createSkillDraft();const full={...draft,name:'时间轴方法',description:'组织企业事件',input:'已确认事件',steps:['核对事件']};
  expect(()=>validateSkillMetadata(full)).not.toThrow();
  expect(()=>validateSkillMetadata({...full,version:'x.y'})).toThrow('版本');
  expect(()=>validateSkillMetadata({...full,metadata:{...getSkillMetadata(full),permissions:{resources:'',operations:'read',authorization:'required'}}})).toThrow('资源');
  expect(skillVersion({...full,metadata:{...getSkillMetadata(full),tags:['时间轴']}})).not.toBe(skillVersion(full));
 });
 it('roundtrips metadata and current edited instructions in exported packages',async()=>{
  const draft=createSkillDraft();const skill=syncSkillPackage({...draft,name:'企业方法',description:'当前说明',input:'当前输入',steps:['当前步骤'],metadata:{...getSkillMetadata(draft),tags:['展项'],purpose:'企业展厅',scenarios:'横屏',output:'可编辑展项',checks:['核对来源'],dependencies:['素材检索'],permissions:{resources:'本项目已授权资料',operations:'read',authorization:'required'},examples:'先组织阶段再配置详情',validation:'reviewed'}});
  const bytes=await exportSkillPackage(skill),imported=await parseSkillPackage(bytes,'method.zip');
  expect(imported.id).not.toBe(skill.id);expect(imported.name).toBe(skill.name);expect(imported.steps).toEqual(skill.steps);
  expect(getSkillMetadata(imported)).toMatchObject({tags:['展项'],purpose:'企业展厅',permissions:{resources:'本项目已授权资料',operations:'read',authorization:'required'}});
  expect(getSkillMetadata(imported).visibility).toBe('private');expect(imported.sourcePackage.instructions).toContain('当前步骤');
 });
});

describe('skill definition edge cases',()=>{
 it('validates bounded metadata and permission enums without accepting fake authorizations',()=>{
  const base={...createSkillDraft(),name:'可复用方法',description:'说明',input:'输入',steps:['检查']},m=getSkillMetadata(base);
  for(const patch of [{tags:['x'.repeat(1001)]},{icon:''},{visibility:'everyone'},{validation:'approved'},{permissions:{resources:'系统',operations:'execute',authorization:'approved'}},{visibility:'restricted',allowedWorkspaceIds:[]},{provenance:{workId:'x',workTitle:'名称',experienceVersion:0}}]){
   expect(()=>validateSkillMetadata({...base,metadata:{...m,...patch} as typeof m})).toThrow();
  }
  expect(()=>validateSkillMetadata({...base,steps:[]})).toThrow();
  expect(()=>validateSkillMetadata({...base,name:''})).toThrow();
 });
 it('retains original package guidance without repeatedly duplicating generated sections',()=>{
  const base={...createSkillDraft(),name:'方法',description:'说明',input:'资料',steps:['核对'],sourcePackage:{filename:'original.zip',entry:'method/SKILL.md',instructions:'# 原始说明\n\n## 额外约定\n脚本不自动执行',files:[],hasScripts:true}};
  const first=syncSkillPackage(base),next=syncSkillPackage({...first,description:'新说明'});
  expect(next.sourcePackage?.instructions.match(/studio-definition:start/g)).toHaveLength(1);
  expect(next.sourcePackage?.instructions.match(/额外约定/g)).toHaveLength(1);expect(next.sourcePackage?.instructions).toContain('新说明');
 });
 it('does not silently drop binary dependencies without the original package',async()=>{
  const base={...createSkillDraft(),name:'方法',description:'说明',input:'资料',steps:['核对'],sourcePackage:{filename:'original.zip',entry:'SKILL.md',instructions:'说明',files:[{path:'assets/binary.bin',size:200000,mime:'application/octet-stream'}],hasScripts:false}};
  await expect(exportSkillPackage(base)).rejects.toThrow('原始 ZIP');
 });
});
