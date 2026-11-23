import type {Page} from '@playwright/test';
/** Explicit opt-in to deterministic fixtures; browser tests never incur model charges. */
export async function useDemoModel(page:Page){
 const control=page.locator('.model-control');
 if((await control.innerText()).includes('演示模式'))return;
 await control.click();await page.getByRole('button',{name:/演示模式 · 离线示例/}).click();
}
