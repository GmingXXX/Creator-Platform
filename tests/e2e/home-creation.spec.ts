import {reloadAndReopen} from './reload-helpers';
import {useDemoModel} from './home-helpers';
import { test, expect, type Page } from '@playwright/test';
async function login(page:Page){await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible()}
test('登录校验与受保护深链接恢复',async({page})=>{
 await page.goto('/#/editor/work-1');await expect(page).toHaveURL(/login/);await page.screenshot({path:'output/验收截图/production-login-1440.png'});
 await page.getByLabel('账号',{exact:true}).fill('jiming');await page.getByLabel('密码',{exact:true}).fill('wrong');await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('alert')).toContainText('账号或密码不正确');
 await page.getByLabel('密码',{exact:true}).fill('123456');await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/editor\/work-1/);await expect(page.getByRole('button',{name:'运行预览',exact:true})).toBeVisible();
});
test('首页工具、上传持久化、IME与窄屏布局',async({page})=>{
 await login(page);await page.screenshot({path:'output/验收截图/production-home-1440.png'});await page.locator('.model-control').click();await page.getByRole('button',{name:/DeepSeek Pro 用于需求理解/}).click();await expect(page.locator('.model-control')).toContainText('DeepSeek Pro');await expect(page.locator('.popover')).toHaveCount(0);
 await page.getByRole('button',{name:'设计风格',exact:true}).click();await page.locator('.design-picker-grid button').filter({hasText:'科技风'}).click();await expect(page.locator('.composer-tools')).toContainText('科技风');
 await page.getByRole('button',{name:'上传文件',exact:true}).click();await expect(page.getByRole('button',{name:'添加文件',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'添加文件夹',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'指定技能',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await page.getByLabel('添加文件',{exact:true}).setInputFiles({name:'企业介绍.txt',mimeType:'text/plain',buffer:Buffer.from('测试上传的企业介绍资料')});await expect(page.locator('.attachment-chip')).toContainText('企业介绍.txt');await page.reload();await expect(page.locator('.attachment-chip')).toContainText('企业介绍.txt');
 await page.getByRole('textbox',{name:'创作需求'}).fill('中文输入测试');await page.getByRole('textbox',{name:'创作需求'}).dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});await expect(page).toHaveURL(/#\/$/);
 await page.getByRole('button',{name:'收起侧栏'}).click();await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);await page.reload();await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
 await page.setViewportSize({width:1024,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'output/验收截图/home-1024.png'});
});
test('空白项目分步创建、自定义校验和分辨率',async({page})=>{
 await login(page);await page.getByRole('button',{name:'新建作品',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'交互页面',exact:true}).click();await page.getByRole('button',{name:/从空白画布新建/}).click();await page.getByLabel('作品名称',{exact:true}).fill('新建验收画布');await page.getByLabel('屏幕分辨率').selectOption('custom');await page.getByLabel('宽度 px').fill('0');await page.getByRole('button',{name:'创建作品'}).click();await expect(page.getByRole('alert')).toContainText('320');await page.getByLabel('宽度 px').fill('2560');await page.getByLabel('高度 px').fill('1120');await page.getByRole('button',{name:'创建作品'}).click();await expect(page).toHaveURL(/editor\//);await expect(page.getByLabel('展项名称',{exact:true})).toHaveValue('新建验收画布');await expect(page.locator('.editor-context-resolution')).toContainText('2560 × 1120');await reloadAndReopen(page);await expect(page.getByLabel('展项名称',{exact:true})).toHaveValue('新建验收画布');
});
test('AI任务暂停、离开恢复、失败重试与原生画布',async({page})=>{
 await login(page);await page.getByRole('textbox',{name:'创作需求'}).fill('制作钢铁企业发展大事记，横向时间轴，2560×1120。');await useDemoModel(page); await page.getByRole('button', {name:'发送创作需求'}).click();await page.getByRole('button',{name:'停止生成',exact:true}).click();await expect(page.getByRole('button',{name:'继续创作',exact:true})).toBeVisible();const url=page.url();
 await page.getByRole('button',{name:'返回首页',exact:true}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
 await expect(page.getByRole('link',{name:/继续创作任务/})).toHaveCount(0);
 await page.getByRole('button',{name:'切换草稿类型'}).click();
 await page.getByRole('menuitem',{name:'创作任务',exact:true}).click();
 await page.getByRole('link',{name:/制作钢铁企业发展大事记.*待继续/}).click();
 await expect(page).toHaveURL(url);
 await page.getByRole('button',{name:'任务更多操作'}).click();await page.getByRole('menuitem',{name:'演示失败与恢复'}).click();await expect(page.locator('.run-error')).toBeVisible();await page.getByRole('button',{name:'重试当前步骤'}).click();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible({timeout:15000});await page.screenshot({path:'output/验收截图/ai-result-1440.png'});await page.getByRole('button',{name:'继续编辑'}).click();await expect(page.locator('.editor-context-resolution')).toContainText('2560 × 1120');await expect(page.locator('.scene-node').first()).toBeVisible();
});
test('图片场景自动风格、结果入库、任务重新创作保留配置',async({page})=>{
 await login(page);await page.getByRole('textbox',{name:'创作需求'}).fill('生成珠宝展厅科技背景图片，16:9，不含文字。');await useDemoModel(page); await page.getByRole('button', {name:'发送创作需求'}).click();await expect(page.getByRole('button',{name:'前往素材库'})).toBeVisible({timeout:15000});
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);expect(state.runs[0].styleId).toBe('');expect(state.assets.find((x:{id:string})=>x.id===state.runs[0].assetId).src).toBe('/media/jewelry.svg');
 await page.getByRole('button',{name:'任务更多操作'}).click();await page.getByRole('menuitem',{name:'用此需求重新创作'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toHaveValue(/珠宝/);
});
