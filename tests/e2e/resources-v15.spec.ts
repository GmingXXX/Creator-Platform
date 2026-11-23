import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByLabel('账号',{exact:true}).fill('jiming');await page.getByLabel('密码',{exact:true}).fill('123456');await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);});
test('社区只平铺作品类型，具体条件以下拉筛选且可清除',async({page})=>{
 await page.goto('/#/community');await page.getByRole('button',{name:'交互页面',exact:true}).click();
 const label=await page.locator('.community-filter-label').boundingBox(),type=await page.getByRole('button',{name:'交互页面',exact:true}).boundingBox();
 expect(Math.abs((label!.y+label!.height/2)-(type!.y+type!.height/2))).toBeLessThan(2);
 await expect(page.getByLabel('展示内容',{exact:true})).toBeVisible();
 await page.getByLabel('展示内容',{exact:true}).selectOption('history');await page.getByLabel('展示形式',{exact:true}).selectOption('时间演进型');
 await expect(page.locator('.res-template-grid')).toContainText('发展历程');
 await page.getByRole('button',{name:'智能演示',exact:true}).click();await expect(page.getByLabel('展示形式',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('展示内容',{exact:true})).toHaveValue('history');
 await page.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.getByLabel('展示内容',{exact:true})).toHaveValue('all');
 await expect(page.locator('.res-template-grid .res-card').first()).toBeVisible();
});
test('技能默认有案例，来源与收藏独立，素材无结果可清除筛选',async({page})=>{
 await page.goto('/#/skills');await expect(page.getByRole('tab',{name:'我的上传',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('技能来源',{exact:true})).toBeVisible();await page.getByLabel('技能来源',{exact:true}).selectOption('builtin');
 await expect(page.locator('.res-skill-grid .res-card').first()).toBeVisible();
 await page.goto('/#/library');await page.getByRole('textbox',{name:'搜索素材名称、说明或标签'}).fill('没有这样的素材-XYZ');
 await expect(page.getByText('没有匹配的素材',{exact:true})).toBeVisible();await page.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.locator('.res-assets-grid .res-card').first()).toBeVisible();
});

test('个人技能跨空间保留，共享技能仅在目标项目空间显示',async({page})=>{
 await page.goto('/#/skills');
 const name=await page.locator('.res-skill-grid .res-card h3').first().innerText();
 const switchSpace=async(label:string)=>{await page.getByRole('button',{name:'切换创作空间',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();};
 await switchSpace('信泰企业展厅');await expect(page.getByRole('tab',{name:'我的技能',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.res-skill-grid')).toContainText(name);
 await page.getByRole('button',{name:`查看${name}`,exact:true}).click();
 await expect(page.getByText('添加后，项目空间成员可使用此技能和附带资源的固定副本。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'添加到空间共享',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'关闭对话框',exact:true}).click();
 await page.getByRole('tab',{name:'空间共享',exact:true}).click();await expect(page.locator('.res-skill-grid')).toContainText(name);
 await switchSpace('东莞博物馆');await expect(page.locator('.res-skill-grid')).toHaveCount(0);
 await page.getByRole('tab',{name:'我的技能',exact:true}).click();await expect(page.locator('.res-skill-grid')).toContainText(name);
});
test('我的素材可明确共享给项目，并保留独立的个人版本',async({page})=>{
 await page.goto('/#/library');
 await page.locator('input[type=file]').setInputFiles({name:'空间共享测试资料.txt',mimeType:'text/plain',buffer:Buffer.from('一份供项目成员使用的创作资料')});
 await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();
 await expect(page.locator('.res-assets-grid')).toContainText('空间共享测试资料.txt');
 await page.getByRole('button',{name:'空间共享测试资料.txt更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'添加到空间共享',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('当前项目空间成员');
 await page.getByRole('button',{name:'确认共享',exact:true}).click();
 await page.getByRole('tab',{name:'空间共享',exact:true}).click();await expect(page.locator('.res-assets-grid')).toContainText('空间共享测试资料.txt');
 await page.getByRole('tab',{name:'我的素材',exact:true}).click();await expect(page.locator('.res-assets-grid')).toContainText('空间共享测试资料.txt');
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();await page.getByRole('menuitem',{name:'东莞博物馆',exact:true}).click();
 await page.getByRole('tab',{name:'空间共享',exact:true}).click();await expect(page.locator('.res-assets-grid .res-card').filter({hasText:'空间共享测试资料.txt'})).toHaveCount(0);
});
