import { test, expect, type Page } from '@playwright/test';

const readState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);

async function selectSpace(page: Page, name: string) {
  await page.getByRole('button', { name: '切换创作空间' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
  await expect(page.getByRole('button', { name: '切换创作空间' })).toContainText(name);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
});

test('空间切换保留各自草稿，新作品归属对应真实项目', async ({ page }) => {
  await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('个人草稿，切换后仍需保留');
  await selectSpace(page, '信泰企业展厅');
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('信泰项目需求');
  await page.getByRole('link', { name: '作品', exact: true }).click();
  const existing=(await readState(page)).works.filter((work:{workspaceId?:string;deletedAt?:string})=>work.workspaceId==='xintai'&&!work.deletedAt).length;
  await expect(page.locator('.res-project-card')).toHaveCount(existing);
  await page.getByRole('button', { name: '新建作品', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '交互页面', exact: true }).click();
  await page.getByRole('button', { name: /从空白画布新建/ }).click();
  await page.getByLabel('作品名称', { exact: true }).fill('信泰归属验证');
  await page.getByRole('button', { name: '创建作品', exact: true }).click();
  await expect(page).toHaveURL(/editor\//);
  const saved = (await readState(page)).works.find((work: {title: string}) => work.title === '信泰归属验证');
  expect(saved.workspaceId).toBe('xintai');
  await page.goto('/#/projects');
  await expect(page.locator('.res-project-card')).toHaveCount(existing+1);
  await selectSpace(page, '个人空间');
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('个人草稿，切换后仍需保留');
  await selectSpace(page, '信泰企业展厅');
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('信泰项目需求');
  await page.reload();
  await expect(page.getByRole('button', { name: '切换创作空间' })).toContainText('信泰企业展厅');
  await page.screenshot({ path: 'output/验收截图/v2-workspace-home.png', animations: 'disabled' });
});

test('最近草稿删除同步作品回收站，恢复保留作品与素材', async ({ page }) => {
  const before = await readState(page);
  const title = '钢铁企业发展大事记';
  await page.getByRole('button', { name: `删除草稿：${title}` }).click();
  await expect(page.getByRole('dialog')).toContainText('回收站');
  await page.getByRole('dialog').getByRole('button', { name: '移入回收站', exact: true }).click();
  await expect(page.locator('.sidebar-recents').getByRole('link', { name: title, exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.res-project-card').filter({ hasText: title })).toHaveCount(0);
  await page.getByRole('button', { name: /回收站/ }).click();
  const removedCard = page.locator('.res-project-card').filter({ hasText: title });
  await expect(removedCard).toBeVisible();
  await page.screenshot({ path: 'output/验收截图/v2-project-recycle-bin.png', animations: 'disabled' });
  await removedCard.getByRole('button', { name: '恢复作品', exact: true }).click();
  await expect(removedCard).toHaveCount(0);
  await page.getByRole('button', { name: /全部作品/ }).click();
  await expect(page.locator('.res-project-card').filter({ hasText: title })).toBeVisible();
  const after = await readState(page);
  expect(after.assets).toEqual(before.assets);
  expect(after.works.find((work: {id: string}) => work.id === 'work-1').pages).toEqual(before.works.find((work: {id: string}) => work.id === 'work-1').pages);
});

test('项目卡片可删除，未发送需求删除后仍可继续输入', async ({ page }) => {
  await page.goto('/#/projects');
  const first = page.locator('.res-project-card').first();
  const title = await first.locator('h3').innerText();
  await first.getByRole('button', { name: `${title}更多操作`, exact: true }).click();
  await page.getByRole('menuitem', { name: '删除作品', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '移入回收站', exact: true }).click();
  expect((await readState(page)).works.find((work: {title: string}) => work.title === title).deletedAt).toBeTruthy();
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('准备删除的未发送需求');
  await page.getByRole('button', { name: '切换草稿类型' }).click();
  await page.getByRole('menuitem', { name: '未发送需求', exact: true }).click();
  await page.getByRole('button', { name: '删除需求草稿：准备删除的未发送需求', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除草稿', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('删除后继续创作');
  const state = await readState(page);
  expect(state.drafts.find((draft: {id: string}) => draft.id === state.activeDraftId).text).toBe('删除后继续创作');
});
