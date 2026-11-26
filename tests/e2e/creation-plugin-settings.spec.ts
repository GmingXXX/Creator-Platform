import {test,expect} from '@playwright/test';

test('管理员停用插件后，新建入口收起，恢复后重新提供',async({page})=>{
 await page.route('**/api/ai/config',route=>route.fulfill({json:{configured:{deepseek:false,image:false},models:[]}}));
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(()=>{
  const state=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  state.state.role='reviewer';localStorage.setItem('zhichuang-studio-v1',JSON.stringify(state));
 });
 await page.goto('/#/admin');await page.reload();
 const platform=page.getByRole('tab',{name:'平台配置'});
 await platform.click();
 await page.getByRole('button',{name:'停用互动影片'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'确认停用'}).click();
 await expect(page.getByRole('button',{name:'启用互动影片'})).toBeVisible();
 await page.goto('/#/projects');
 await page.getByRole('button',{name:'新建作品',exact:true}).first().click();
 let dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('button',{name:'智能演示',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'互动影片',exact:true})).toHaveCount(0);
 await page.goto('/#/admin');await platform.click();
 await page.getByRole('button',{name:'启用互动影片'}).click();
 await page.goto('/#/projects');
 await page.getByRole('button',{name:'新建作品',exact:true}).first().click();
 dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('button',{name:'互动影片',exact:true})).toBeVisible();
});
