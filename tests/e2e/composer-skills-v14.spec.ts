import {test,expect,type Page} from '@playwright/test';
import type {StudioData} from '../../src/domain/types';
const read=(page:Page):Promise<StudioData>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function openCommunitySkill(page:Page,id:string){await page.goto(`/#/community?tab=skills&skill=${id}`);await expect(page.getByRole('dialog')).toBeVisible();}
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByLabel('账号',{exact:true}).fill('jiming');await page.getByLabel('密码',{exact:true}).fill('123456');await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);});

test('公共Skills固定采用、同版本去重且不改首页草稿',async({page})=>{
 const initial=await read(page),source=initial.skills.find(s=>s.public&&!s.personal)!;
 await openCommunitySkill(page,source.id);await page.getByRole('dialog').getByRole('button',{name:'添加技能',exact:true}).click();
 const selectedState=await read(page),copy=selectedState.skills.find(s=>s.personal&&s.origin?.skillId===source.id)!;
 expect(copy.id).not.toBe(source.id);expect(copy.personal).toBe(true);expect(copy.public).toBe(false);expect(copy.origin?.skillId).toBe(source.id);expect(copy.version).toBe(source.version);expect(copy.enabled).toBe(true);
 await page.keyboard.press('Escape');await openCommunitySkill(page,source.id);await expect(page.getByRole('dialog').getByRole('button',{name:'已添加',exact:true})).toBeDisabled();
 const after=await read(page);expect(after.skills.filter(s=>s.personal&&s.origin?.skillId===source.id)).toHaveLength(1);expect(after.skills.find(s=>s.id===copy.id)).toEqual(copy);expect(after.drafts).toEqual(initial.drafts);
 const builtin=selectedState.skills.find(s=>s.source==='builtin'&&s.name===source.name);if(builtin)expect(after.skills.find(s=>s.id===builtin.id)).toEqual(builtin);
});

test('社区新版不会改变个人固定旧版本，个人技能可原地启用',async({page})=>{
 const initial=await read(page),source=initial.skills.find(s=>s.public&&!s.personal)!;
 await openCommunitySkill(page,source.id);await page.getByRole('dialog').getByRole('button',{name:'添加技能',exact:true}).click();
 const selectedState=await read(page),copy=selectedState.skills.find(s=>s.personal&&s.origin?.skillId===source.id)!;
 await page.keyboard.press('Escape');
 // Simulate a later community release, leaving the personal fixed copy intact.
 await page.evaluate(({sourceId})=>{const stored=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);stored.state.skills=stored.state.skills.map((s:{id:string;version:string;description:string})=>s.id===sourceId?{...s,version:'9.0',description:'社区更新后的规则'}:s);stored.state.skills.push({id:'personal-composer-skill',name:'个人排版方法',description:'我的排版规则',category:'排版',input:'文案',steps:['编排'],styleId:'industrial',previewType:'text',author:'纪鸣',version:'1.0',personal:true,public:false,enabled:false});localStorage.setItem('zhichuang-studio-v1',JSON.stringify(stored));},{sourceId:source.id});
 await page.reload();const updated=await read(page);expect(updated.skills.find(s=>s.id===copy.id)).toEqual(copy);
 await openCommunitySkill(page,source.id);await expect(page.getByRole('dialog')).toContainText('v9.0');await page.getByRole('dialog').getByRole('button',{name:'添加技能',exact:true}).click();
 const adopted=await read(page);expect(adopted.skills.filter(s=>s.personal&&s.origin?.skillId===source.id)).toHaveLength(2);expect(adopted.skills.find(s=>s.id===copy.id)).toEqual(copy);await page.keyboard.press('Escape');
 await page.goto('/#/skills?skill=personal-composer-skill');await page.getByRole('dialog').getByRole('button',{name:'启用技能',exact:true}).click();
 expect((await read(page)).skills.find(s=>s.id==='personal-composer-skill')?.enabled).toBe(true);expect((await read(page)).drafts).toEqual(initial.drafts);await expect(page).toHaveURL(/#\/skills\?skill=personal-composer-skill$/);
});
