import type {Page} from '@playwright/test';
export async function openSpaceSettings(page:Page,tab:'成员与权限'|'知识本地场'|'基本信息'){
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.activeWorkspaceId);
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await page.getByRole('menuitem',{name:'管理空间',exact:true}).click();
 await page.getByTestId(`workspace-row-${id}`).getByRole('button',{name:'管理',exact:true}).click();
 await page.getByRole('dialog',{name:'管理项目空间',exact:true}).getByRole('tab',{name:tab,exact:true}).click();
}
