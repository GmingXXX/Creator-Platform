import {test,expect,type Page} from '@playwright/test';
import JSZip from 'jszip';
import type {StudioData} from '../../src/domain/types';
const data=(page:Page):Promise<StudioData>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByLabel('账号',{exact:true}).fill('jiming');await page.getByLabel('密码',{exact:true}).fill('123456');await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);});

test('社区四板块、作品大类与展示内容分开筛选，素材不混工程',async({page})=>{
 await page.goto('/#/community');
 const tabs=page.locator('.res-community-tabs');
 for(const name of ['展项模板','展项素材','Skills','设计风格'])await expect(tabs.getByRole('tab',{name,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'交互页面',exact:true}).click();
 await expect(page.getByLabel('展示形式')).toBeVisible();
 await page.getByLabel('展示内容',{exact:true}).selectOption('history');
 await page.getByLabel('展示形式').selectOption('时间演进型');
 await expect(page.locator('.res-template-grid .res-card').first()).toContainText('发展历程');
 await page.getByRole('button',{name:'智能演示',exact:true}).click();
 await expect(page.getByLabel('展示形式')).toHaveCount(0);
 await expect(page.getByLabel('展示内容',{exact:true})).toHaveValue('history');
 await page.getByLabel('展示内容',{exact:true}).selectOption('all');
 await expect(page.locator('.res-template-grid .res-card').first()).toBeVisible();
 await tabs.getByRole('tab',{name:'展项素材',exact:true}).click();
 await expect(page.locator('.community-material-types').getByRole('button',{name:'演示文稿',exact:true})).toHaveCount(0);
 await expect(page.locator('.community-material-types').getByRole('button',{name:'HTML 交互程序',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'组件',exact:true}).click();
 await expect(page.locator('.res-assets-grid')).toContainText('组件');
 await tabs.getByRole('tab',{name:'设计风格',exact:true}).click();
 await expect(page.locator('.res-design-grid')).toBeVisible();
 await expect(page.getByText('开发团队维护',{exact:false}).first()).toBeVisible();
 await page.setViewportSize({width:1024,height:768});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'output/验收截图/v14-community-systems-1024.png',animations:'disabled'});
});

test('个人ZIP技能审核发布、社区采用和待审新版保持旧版',async({page})=>{
 await page.goto('/#/skills');await page.getByRole('button',{name:'上传技能',exact:true}).click();
 const zip=new JSZip();zip.file('SKILL.md','# 社区验收技能\n\n整理企业案例为可筛选卡片\n\n## 输入\n案例资料\n\n## 步骤\n1. 整理内容\n2. 编排卡片');
 await page.getByLabel('上传 ZIP 技能包').setInputFiles({name:'community-skill.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
 await expect(page.getByText('格式检查通过')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'添加技能',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const skill=(await data(page)).skills.find(item=>item.name==='社区验收技能')!;
 await page.getByRole('button',{name:'查看社区验收技能',exact:true}).click();await page.getByRole('button',{name:'提交到共创社区',exact:true}).click();
 await page.getByRole('checkbox',{name:'已检查技能说明、示例和资源，允许团队复用此版本'}).check();await page.getByRole('button',{name:'提交审核',exact:true}).click();
 let state=await data(page);expect(state.submissions.find(s=>s.skill?.id===skill.id)?.status).toBe('pending');expect(state.skills.some(s=>s.public&&s.name===skill.name)).toBe(false);
 await page.goto('/#/review');await page.getByRole('button',{name:'演示：切换为审核员'}).click();await page.locator('.res-review-row').filter({hasText:skill.name}).click();
 for(const checkbox of await page.locator('.res-review-checks input').all())await checkbox.check();await page.getByRole('button',{name:'通过并发布',exact:true}).click();
 state=await data(page);const published=state.skills.find(s=>s.public&&s.name===skill.name)!;expect(published).toBeDefined();expect(published.id).not.toBe(skill.id);
 await page.goto('/#/community?tab=skills');await page.getByRole('button',{name:`查看${skill.name}`,exact:true}).click();await page.getByRole('button',{name:'添加技能',exact:true}).click();
 state=await data(page);expect(state.skills.some(s=>s.personal&&s.origin?.skillId===published.id)).toBe(true);
 await expect(page.getByRole('button',{name:'已添加',exact:true})).toBeDisabled();expect(state.skills.find(s=>s.personal&&s.origin?.skillId===published.id)?.enabled).toBe(true);await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
 await page.goto('/#/skills');await page.getByLabel('技能来源',{exact:true}).selectOption('uploaded');await page.getByRole('button',{name:`查看${skill.name}`,exact:true}).click();
 await page.getByRole('button',{name:'编辑技能信息',exact:true}).click();await page.getByLabel('技能说明',{exact:true}).fill('新的案例编排规则');await page.getByRole('button',{name:'保存修改',exact:true}).click();
 await page.getByRole('button',{name:'提交到共创社区',exact:true}).click();await page.getByRole('checkbox',{name:'已检查技能说明、示例和资源，允许团队复用此版本'}).check();await page.getByRole('button',{name:'提交审核',exact:true}).click();
 state=await data(page);expect(state.skills.find(s=>s.id===published.id)).toEqual(published);expect(state.submissions.filter(s=>s.skill?.id===skill.id&&s.status==='pending')).toHaveLength(1);
 await page.goto('/#/review');await page.locator('.res-review-row').filter({hasText:skill.name}).first().click();await page.getByRole('button',{name:'退回修改',exact:true}).click();await page.getByLabel('退回原因',{exact:true}).fill('补充输入字段说明');await page.getByRole('button',{name:'确认退回',exact:true}).click();await page.getByRole('button',{name:'修改后重新投稿',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('skill='+skill.id));await page.getByRole('button',{name:'编辑技能信息',exact:true}).click();await page.getByLabel('需要提供',{exact:true}).fill('案例名称、行业、图片和成果数据');await page.getByRole('button',{name:'保存修改',exact:true}).click();
 await page.getByRole('button',{name:'提交到共创社区',exact:true}).click();await page.getByRole('checkbox',{name:'已检查技能说明、示例和资源，允许团队复用此版本'}).check();await page.getByRole('button',{name:'提交审核',exact:true}).click();
 state=await data(page);expect(state.submissions.filter(s=>s.skill?.id===skill.id&&s.status==='pending')).toHaveLength(1);expect(state.skills.find(s=>s.id===published.id)).toEqual(published);

});


test('不同项目模板复用进入各自编辑器，旧工程链接可打开模板详情',async({page})=>{
 const initial=await data(page);
 for(const [kind,route] of [['presentation','presentations'],['video','video'],['story','dream']] as const){
  const template=initial.templates.find(t=>t.work.kind===kind)!;expect(template).toBeDefined();
  await page.goto('/#/community?tab=templates&template='+template.id);await expect(page.getByRole('dialog').getByRole('heading',{name:template.title,exact:true})).toBeVisible();
  if(kind==='presentation')await expect(page.getByTestId('presentation-material-preview')).toBeVisible();
  if(kind==='video')await expect(page.getByTestId('video-material-preview')).toBeVisible();
  await page.getByRole('button',{name:'快速复用并编辑',exact:true}).click();await expect(page).toHaveURL(new RegExp('#/'+route+'/'));
  const created=(await data(page)).works[0];expect(created.kind).toBe(kind);expect(created.id).not.toBe(template.work.id);
 }
});

test('模板投稿至少确认内容或形式，并保存真实工程快照',async({page})=>{
 await page.goto('/#/projects');await page.getByRole('textbox',{name:'搜索作品名称'}).fill('钢铁企业发展大事记');await page.locator('.res-project-card .res-icon-button').first().click();await page.getByRole('menuitem',{name:'提交到共创社区'}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'发展历程',exact:true}).click();await dialog.getByLabel('展示形式').selectOption('');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'提交审核',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('至少填写一项');
 await dialog.getByRole('button',{name:'荣誉资质',exact:true}).click();await dialog.getByLabel('展示形式').selectOption('卡片浏览型');await dialog.getByRole('button',{name:'提交审核',exact:true}).click();await expect(dialog).toHaveCount(0);
 const state=await data(page),work=state.works.find(w=>w.id==='work-1')!,submission=state.submissions.find(s=>s.work?.id===work.id)!;
 expect(work.contentPurposes).toEqual(['honors']);expect(work.type).toBe('卡片浏览型');expect(submission.work?.contentPurposes).toEqual(['honors']);expect(submission.work?.pages).toEqual(work.pages);
});
