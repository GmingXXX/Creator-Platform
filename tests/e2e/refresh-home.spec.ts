import {test,expect} from '@playwright/test';

test('刷新保留当前页面与空间，草稿和作品互不串用',async({page})=>{
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 const input=page.getByRole('textbox',{name:'创作需求',exact:true});
 await input.fill('尚未发送的创作需求');
 await page.getByRole('link',{name:'作品',exact:true}).click();
 await expect(page).toHaveURL(/#\/projects$/);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works);
 for(const route of ['/projects','/library','/skills','/community?tab=systems','/editor/work-1','/presentations/work-4','/video/work-5','/dream/work-6','/preview/work-1']){
  await page.goto(`/#${route}`);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[?]/g,'\\?')}$`));
  const currentUrl=page.url();await page.reload();
  await expect(page).toHaveURL(currentUrl);
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works)).toEqual(before);
 await page.goto('/#/');await expect(input).toHaveValue('尚未发送的创作需求');
 await page.getByRole('link',{name:'作品',exact:true}).click();
 await expect(page).toHaveURL(/#\/projects$/);
});

test('未登录刷新仍需登录，登录后恢复原作品入口',async({page})=>{
 await page.goto('/#/editor/work-1');
 await expect(page).toHaveURL(/#\/login$/);
 await page.reload();
 await expect(page).toHaveURL(/#\/login$/);
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page).toHaveURL(/#\/editor\/work-1$/);
 await expect(page.locator('.scene-board')).toBeVisible();
});
