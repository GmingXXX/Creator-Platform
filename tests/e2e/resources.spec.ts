import {reloadAndReopen} from './reload-helpers';
import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import JSZip from 'jszip';
import type { StudioData } from '../../src/domain/types';

const evidenceDirectory='output/验收截图';
const runtimeErrors=new WeakMap<Page,string[]>();
const readStudio=(page:Page):Promise<StudioData>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function route(page:Page,path:string){await page.goto(`/#${path}`);await expect(page.locator('.res-page')).toBeVisible();}
async function screenshot(page:Page,name:string){await mkdir(evidenceDirectory,{recursive:true});await page.screenshot({path:`${evidenceDirectory}/resources-${name}.png`,fullPage:true,animations:'disabled'});}

test.beforeEach(async({page})=>{
 const errors:string[]=[];runtimeErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/#/login');await page.getByLabel('账号',{exact:true}).fill('jiming');await page.getByLabel('密码',{exact:true}).fill('123456');await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
});
test.afterEach(async({page})=>{expect(runtimeErrors.get(page),'资源页面不应出现浏览器运行错误').toEqual([]);});

test('资源工作区：六个入口和 1024 宽布局',async({page})=>{
 for(const path of ['projects','library','skills','design-systems','community','review']){
  await route(page,`/${path}`);await expect(page.locator('.res-page h1')).toHaveCount(1);await screenshot(page,path);
 }
 await route(page,'/community');await page.setViewportSize({width:1024,height:768});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await screenshot(page,'community-1024');
});

test('社区模板：真实运行详情与独立可编辑副本',async({page})=>{
 await route(page,'/community');const before=await readStudio(page);const original=before.templates[0];
 await page.locator('.res-template-grid .res-cover-button').first().click();await expect(page.locator('[role=dialog] .scene-renderer')).toBeVisible();
 await page.locator('[role=dialog] .timeline-event').first().click();await expect(page.locator('.scene-detail')).toBeVisible();await page.locator('.scene-detail').getByRole('button',{name:'返回浏览'}).click();await screenshot(page,'template-detail');
 await page.getByRole('button',{name:'快速复用并编辑',exact:true}).click();await expect(page).toHaveURL(/#\/editor\//);
 const after=await readStudio(page);expect(after.works).toHaveLength(before.works.length+1);const cloned=after.works[0];expect(cloned.id).not.toBe(original.work.id);expect(cloned.pages[0].id).not.toBe(original.work.pages[0].id);expect(cloned.pages[0].nodes.length).toBe(original.work.pages[0].nodes.length);expect(after.templates[0].work).toEqual(original.work);
});

test('Skills：导入合法清单并原地启停，不改创作草稿',async({page})=>{
 await route(page,'/skills');await page.getByRole('button',{name:'上传技能',exact:true}).click();
 const skillZip=new JSZip();skillZip.file('SKILL.md','# 验收用时间轴技能\n\n根据事件生成时间轴\n\n## 输入\n企业发展事件\n\n## 步骤\n1. 理解主题\n2. 创建时间轴');
 await page.locator('input[type=file]').setInputFiles({name:'test-skill.zip',mimeType:'application/zip',buffer:await skillZip.generateAsync({type:'nodebuffer'})});
 await expect(page.getByText('格式检查通过')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'添加技能',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 const added=(await readStudio(page)).skills.find(skill=>skill.name==='验收用时间轴技能');expect(added?.personal).toBe(true);
 const before=await readStudio(page);const card=page.locator('.res-card').filter({has:page.getByRole('heading',{name:'验收用时间轴技能',exact:true})});
 await card.getByRole('button',{name:'停用技能',exact:true}).click();expect((await readStudio(page)).skills.find(s=>s.id===added?.id)?.enabled).toBe(false);
 await card.getByRole('button',{name:'启用技能',exact:true}).click();await expect(page).toHaveURL(/#\/skills$/);
 const state=await readStudio(page);expect(state.skills.find(s=>s.id===added?.id)?.enabled).toBe(true);expect(state.drafts).toEqual(before.drafts);
});

test('设计风格：应用与撤销保留内容结构',async({page})=>{
 const before=(await readStudio(page)).works.find(work=>work.id==='work-1')!;
 await route(page,'/design-systems/government');await screenshot(page,'system-detail');await page.getByRole('button',{name:'应用到作品',exact:true}).click();await page.locator('[role=dialog] select').selectOption('work-1');
 await page.getByRole('dialog').getByRole('button',{name:'应用到作品',exact:true}).click();let updated=(await readStudio(page)).works.find(work=>work.id==='work-1')!;expect(updated.styleId).toBe('government');expect(updated.pages[0].nodes.map(node=>node.content)).toEqual(before.pages[0].nodes.map(node=>node.content));
 await page.getByRole('button',{name:'撤销应用',exact:true}).click();updated=(await readStudio(page)).works.find(work=>work.id==='work-1')!;expect(updated.styleId).toBe(before.styleId);expect(updated.pages).toEqual(before.pages);
});

test('素材库：上传文件和刷新恢复',async({page})=>{
 await route(page,'/library');await page.getByRole('button',{name:'上传素材',exact:true}).first().click();
 await page.locator('input[type=file]').setInputFiles({name:'资源验收.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE0cAAAAASUVORK5CYII=','base64')});
 await expect(page.getByText('已添加',{exact:true})).toBeVisible();await page.getByRole('button',{name:'完成',exact:true}).click();await reloadAndReopen(page);await expect(page.getByRole('button',{name:'预览资源验收.png',exact:true})).toBeVisible();
 const asset=(await readStudio(page)).assets.find(item=>item.name==='资源验收.png');expect(asset?.src).toMatch(/^idb:/);expect(asset?.public).toBe(false);
 await page.getByRole('button',{name:'预览资源验收.png',exact:true}).click();await expect(page.locator('[role=dialog] img').first()).toHaveAttribute('src',/^blob:/);
});

test('社区素材：一键同款保留旧草稿并带入完整资料',async({page})=>{
 await page.getByRole('textbox',{name:'创作需求'}).fill('这是一份尚未发送的原始需求');const before=await readStudio(page);const previous=before.drafts.find(item=>item.id===before.activeDraftId)!;
 await route(page,'/community?tab=assets');await page.getByRole('button',{name:'一键同款',exact:true}).first().click();await expect(page).toHaveURL(/#\/$/);
 const after=await readStudio(page);const current=after.drafts.find(item=>item.id===after.activeDraftId)!;expect(current.id).not.toBe(previous.id);expect(after.drafts.find(item=>item.id===previous.id)).toEqual(previous);expect(current.reference?.files.length).toBeGreaterThan(0);expect(current.reference?.prompt).toBeTruthy();expect(current.reference?.params).toBeTruthy();expect(current.skillIds).toEqual(current.reference?.skillIds);expect(after.runs).toHaveLength(before.runs.length);
});

test('社区审核：校对、快照发布与待审新版隔离',async({page})=>{
 await route(page,'/community');
 const reviewEntry=page.getByRole('button',{name:'社区审核',exact:true});
 await expect(reviewEntry).toHaveCount(0);
 await page.getByRole('button',{name:'我的投稿',exact:true}).click();
 await page.getByRole('button',{name:'演示：切换为审核员'}).click();
 await page.getByRole('button',{name:'前往共创社区'}).click();
 await expect(page.getByRole('button',{name:'我的投稿',exact:true})).toHaveCount(0);
 await reviewEntry.click({timeout:5000});
 await expect(page.getByRole('heading',{name:'社区审核',exact:true})).toBeVisible();
 await page.locator('.res-review-row').filter({hasText:'品牌案例与荣誉墙'}).click();
 await page.getByRole('button',{name:'通过并发布'}).click();await expect(page.getByText('请完成内容、资源与交互检查后再通过。')).toBeVisible();
 for(const checkbox of await page.locator('.res-review-checks input').all())await checkbox.check();await page.getByRole('button',{name:'通过并发布'}).click();let state=await readStudio(page);expect(state.submissions.find(item=>item.id==='submission-example-1')?.status).toBe('approved');const published=state.templates.find(item=>item.id==='published-work-2')!;expect(published.title).toBe('品牌案例与荣誉墙');
 await page.getByRole('button',{name:'关闭对话框',exact:true}).click();await page.getByRole('button',{name:'演示：切换为创作者'}).click();await route(page,'/projects');await page.getByRole('textbox',{name:'搜索作品名称'}).fill('品牌案例与荣誉');await page.locator('.res-project-card .res-icon-button').first().click();await page.getByRole('menuitem',{name:'重命名',exact:true}).click();await page.locator('[role=dialog] input').fill('品牌案例与荣誉墙 · 待审修订');await page.getByRole('button',{name:'保存名称'}).click();
 await page.locator('.res-project-card .res-icon-button').first().click();await page.getByRole('menuitem',{name:'提交到共创社区'}).click();await page.locator('[role=dialog] input[type=checkbox]').check();await page.getByRole('button',{name:'提交审核'}).click();state=await readStudio(page);expect(state.templates.find(item=>item.id==='published-work-2')).toEqual(published);expect(state.submissions.some(item=>item.name.includes('待审修订')&&item.status==='pending')).toBe(true);
 await route(page,'/community');await expect(page.locator('.res-template-grid').getByRole('heading',{name:'品牌案例与荣誉墙',exact:true})).toBeVisible();await expect(page.locator('.res-template-grid').getByRole('heading',{name:'品牌案例与荣誉墙 · 待审修订',exact:true})).toHaveCount(0);
});
