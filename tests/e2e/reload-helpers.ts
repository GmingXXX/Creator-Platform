import {expect,type Page} from '@playwright/test';

/** Refresh preserves the current route; authentication still guards private work. */
export async function reloadAndReopen(page:Page){
 const originalUrl=page.url();
 await page.reload();
 const loggedIn=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')||'{}').state?.loggedIn===true);
 if(loggedIn)await expect(page).toHaveURL(originalUrl);
 else await expect(page.getByRole('button',{name:'进入工作台',exact:true})).toBeVisible();
}
