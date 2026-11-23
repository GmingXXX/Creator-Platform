import {useDemoModel} from './home-helpers';
import { test, expect, type Page } from '@playwright/test';

const readState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);

test.beforeEach(async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
});

test('成功提交消费输入，Logo返回保留新未发草稿和原任务', async ({ page }) => {
  const prompt = '生成一张工业蓝色背景图片';
  await page.getByRole('textbox', { name: '创作需求', exact: true }).fill(prompt);
  await useDemoModel(page); await page.getByRole('button', {name:'发送创作需求'}).click();
  await expect(page).toHaveURL(/create\//);
  await page.getByRole('link', { name: '智创首页', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('');
  expect((await readState(page)).runs[0].prompt).toBe(prompt);
  await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('新的未发送需求，不应丢失');
  await page.getByRole('link', { name: '素材库', exact: true }).click();
  await page.getByRole('link', { name: '智创首页', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('新的未发送需求，不应丢失');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toHaveValue('新的未发送需求，不应丢失');
});

test('项目不再提供归档，删除恢复仍完整保留', async ({ page }) => {
  await page.getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.getByRole('button', { name: '已归档', exact: true })).toHaveCount(0);
  const card = page.locator('.res-project-card').first();
  const title = await card.locator('h3').innerText();
  await card.getByRole('button', { name: `${title}更多操作`, exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '归档作品', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: '删除作品', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '移入回收站', exact: true }).click();
  await page.getByRole('button', { name: /回收站/ }).click();
  await page.locator('.res-project-card').filter({ hasText: title }).getByRole('button', { name: '恢复作品' }).click();
  await page.getByRole('button', { name: /全部作品/ }).click();
  await expect(page.locator('.res-project-card').filter({ hasText: title })).toBeVisible();
});

test('演示中心精简入口，工作台Logo保存并回首页', async ({ page }) => {
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '智能演示', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看素材库', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '返回上一步', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '新建作品', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('link', { name: '作品', exact: true }).click();
  await page.getByRole('button', { name: '打开企业创新成果讲解', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('演示名称', { exact: true }).fill('Logo 返回前修改的演示');
  await page.getByRole('button', { name: '智创首页', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
  expect((await readState(page)).works.some((work: { title: string }) => work.title === 'Logo 返回前修改的演示')).toBe(true);
});

test('画布Logo保存并回首页，侧栏双箭头独立于选择状态', async ({ page }) => {
  await page.goto('/#/editor/work-1');
  await page.getByLabel('展项名称', { exact: true }).fill('画布 Logo 保存验证');
  await expect(page.locator('.editor-contextbar').getByRole('button', { name: '收起组件面板' })).toHaveCount(0);
  await page.getByRole('button', { name: '收起组件面板', exact: true }).click();
  await expect(page.locator('.editor-left')).toBeHidden();
  await page.getByRole('button', { name: '展开组件面板', exact: true }).click();
  await expect(page.locator('.editor-left')).toBeVisible();
  await page.getByRole('button', { name: '智创首页', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
  expect((await readState(page)).works.find((work: { id: string }) => work.id === 'work-1').title).toBe('画布 Logo 保存验证');
});
