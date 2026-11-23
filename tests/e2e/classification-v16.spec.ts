import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
});
test('空白项目分类默认无，投稿至少选择一项且不擅自推断形式',async({page})=>{
 await page.getByRole('button',{name:'新建作品',exact:true}).click();
 await page.getByRole('button',{name:'交互页面',exact:true}).click();await page.getByRole('button',{name:/从空白画布新建/}).click();
 await expect(page.getByRole('button',{name:'展示内容',exact:true})).toHaveText('无');
 await expect(page.getByLabel('展示形式',{exact:true})).toHaveValue('');
 await page.getByLabel('作品名称',{exact:true}).fill('分类自由的作品');await page.getByRole('button',{name:'创建作品',exact:true}).click();
 await expect(page).toHaveURL(/editor\//);await expect(page.locator('.editor-topbar .badge')).toHaveCount(0);
 await page.getByRole('button',{name:'分享投稿',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'提交审核',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('至少填写一项');
 await dialog.getByRole('button',{name:'发展历程',exact:true}).click();await dialog.getByRole('button',{name:'提交审核',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
 expect(saved.works[0].displayForm).toBeNull();expect(saved.submissions[0].work.contentPurposes).toEqual(['history']);
 await page.goto('/#/projects?category=interactive');await page.getByLabel('展示形式',{exact:true}).selectOption('none');
 await expect(page.getByRole('button',{name:'打开分类自由的作品',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'打开分类自由的作品',exact:true}).click();await expect(page).toHaveURL(/editor\//);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('创建时只填写展示内容且所有界面使用设计风格',async({page})=>{
 await expect(page.getByText('设计系统',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'设计风格',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'交互页面',exact:true}).click();await page.getByRole('button',{name:/从空白画布新建/}).click();
 await page.getByRole('button',{name:'展示内容',exact:true}).click();await page.getByRole('button',{name:'荣誉资质',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.getByRole('button',{name:'创建作品',exact:true}).click();await expect(page).toHaveURL(/editor\//);
 const work=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0]);expect(work.displayForm).toBeNull();expect(work.contentPurposes).toEqual(['honors']);
});
