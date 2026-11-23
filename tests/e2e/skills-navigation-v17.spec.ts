import {test,expect,type Page} from '@playwright/test';
const snapshot=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function login(page:Page){
 await page.route('**/api/ai/config',route=>route.fulfill({json:{configured:false,models:[]}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
}
test('附件只添加文件或文件夹，个人技能原地启停且持久化',async({page})=>{
 await login(page);await page.getByRole('button',{name:'上传文件',exact:true}).click();
 await expect(page.getByRole('button',{name:'添加文件',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'添加文件夹',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'指定技能',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await page.locator('.sidebar-nav').getByRole('link',{name:'Skills',exact:true}).click();
 await expect(page.getByRole('button',{name:'从社区添加',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'上传技能',exact:true})).toBeVisible();
 const before=await snapshot(page),personal=before.skills.find((s:any)=>s.personal&&!s.public);
 const card=page.locator('.res-card').filter({has:page.getByRole('heading',{name:personal.name,exact:true})});
 await card.getByRole('button',{name:'停用技能',exact:true}).click();await expect(card.getByRole('button',{name:'启用技能',exact:true})).toBeVisible();
 expect((await snapshot(page)).skills.find((s:any)=>s.id===personal.id).enabled).toBe(false);
 expect((await snapshot(page)).drafts).toEqual(before.drafts);await expect(page).toHaveURL(/#\/skills$/);
 await page.reload();await page.locator('.sidebar-nav').getByRole('link',{name:'Skills',exact:true}).click();
 await card.getByRole('button',{name:'启用技能',exact:true}).click();await expect(card.getByRole('button',{name:'停用技能',exact:true})).toBeVisible();
 expect((await snapshot(page)).skills.find((s:any)=>s.id===personal.id).enabled).toBe(true);
});
test('社区技能添加为个人启用副本，已添加防重且不改变停用设置',async({page})=>{
 await login(page);await page.locator('.sidebar-nav').getByRole('link',{name:'共创社区',exact:true}).click();await page.getByRole('tab',{name:'Skills',exact:true}).click();
 const before=await snapshot(page),skill=before.skills.find((s:any)=>s.public&&!before.skills.some((p:any)=>p.personal&&(p.origin?.skillId===s.id||p.name===s.name)));
 await page.getByRole('button',{name:`查看${skill.name}`,exact:true}).click();const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('带入首页使用',{exact:true})).toHaveCount(0);await expect(dialog.getByText('这次想制作什么？',{exact:true})).toHaveCount(0);
 await expect(dialog.locator('.modal-footer').getByRole('button',{name:'关闭',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'添加技能',exact:true}).click();await expect(dialog.getByRole('button',{name:'已添加',exact:true})).toBeDisabled();
 const after=await snapshot(page),added=after.skills.filter((s:any)=>s.personal&&s.origin?.skillId===skill.id);expect(added).toHaveLength(1);expect(added[0].workspaceId).toBe('personal');expect(added[0].enabled).toBe(true);expect(after.drafts).toEqual(before.drafts);
 await page.keyboard.press('Escape');await page.locator('.sidebar-nav').getByRole('link',{name:'Skills',exact:true}).click();
 const card=page.locator('.res-card').filter({has:page.getByRole('heading',{name:skill.name,exact:true})});await card.getByRole('button',{name:'停用技能',exact:true}).click();
 await page.getByRole('button',{name:'从社区添加',exact:true}).click();await page.getByRole('button',{name:`查看${skill.name}`,exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('button',{name:'已添加',exact:true})).toBeDisabled();await expect(page.locator('.toast')).toHaveCount(0);await page.screenshot({path:'output/验收截图/skills-v17-community.png',animations:'disabled'});expect((await snapshot(page)).skills.find((s:any)=>s.id===added[0].id).enabled).toBe(false);
});
test('作品列表新建保留筛选，返回类型选择保留创建输入',async({page})=>{
 await login(page);await page.locator('.sidebar-nav').getByRole('link',{name:'作品',exact:true}).click();
 await page.getByPlaceholder('搜索作品名称').fill('钢铁');const before=page.url();
 await page.locator('.page-heading').getByRole('button',{name:'新建作品',exact:true}).click();await expect(page.getByRole('dialog',{name:'新建作品',exact:true})).toBeVisible();
 expect(page.url()).toBe(before);await expect(page.getByPlaceholder('搜索作品名称')).toHaveValue('钢铁');
 await page.getByRole('button',{name:'智能演示',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByPlaceholder('例如：根据上传的大纲，介绍企业发展历程、核心技术与代表案例。').fill('保留演示主题');
 await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();
 await expect(dialog.getByPlaceholder('例如：根据上传的大纲，介绍企业发展历程、核心技术与代表案例。')).toHaveValue('保留演示主题');
 await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();await page.getByRole('button',{name:'互动影片',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'返回上一步',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'新建作品',exact:true})).toBeVisible();await page.keyboard.press('Escape');expect(page.url()).toBe(before);await expect(page.getByPlaceholder('搜索作品名称')).toHaveValue('钢铁');
});
