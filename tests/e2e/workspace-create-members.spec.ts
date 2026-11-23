import {openSpaceSettings} from './workspace-settings-helpers';
import { test, expect, type Page } from '@playwright/test';

const readState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function openMembers(page: Page) {
  await openSpaceSettings(page,'成员与权限');
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function createSpace(page: Page, name: string) {
  await page.getByRole('button', { name: '切换创作空间' }).click();
  await page.getByRole('menuitem', { name: '新建项目空间', exact: true }).click();
  await page.getByLabel('空间名称', { exact: true }).fill(name);
  await page.getByLabel('空间说明（可选）').fill('多人共创演示');
  await page.getByRole('button', { name: '创建并进入', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('空间已创建');
}
test.beforeEach(async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
});
test('创建项目空间保留作品页面和预设空间，刷新后可继续使用', async ({ page }) => {
  await page.goto('/#/projects');
  await createSpace(page, '团队共创空间');
  await page.getByRole('button', { name: '先开始创作', exact: true }).click();
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(page.getByRole('button', { name: '切换创作空间' })).toContainText('团队共创空间');
  const state = await readState(page);
  const space = state.workspaces.find((item: {name: string}) => item.name === '团队共创空间');
  expect(space.description).toBe('多人共创演示');
  expect(state.workspaceMembers[space.id]).toEqual(expect.arrayContaining([expect.objectContaining({id:'self',role:'owner',status:'member'})]));
  await page.reload();
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(page.getByRole('heading', { name: '团队共创空间', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '切换创作空间' })).toContainText('团队共创空间');
  await page.getByRole('button', { name: '切换创作空间' }).click();
  for (const name of ['个人空间','信泰企业展厅','东莞博物馆','ai小镇展厅','团队共创空间']) await expect(page.getByRole('menuitem',{name,exact:true})).toBeVisible();
});
test('邀请、接受、查看者权限体验、修改角色和撤销分别生效', async ({ page }) => {
  await createSpace(page, '邀请权限验证');
  await page.getByRole('button', { name: '邀请成员', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('不会发送真实邀请');
  await dialog.getByLabel('账号或邮箱', {exact:true}).fill('viewer@example.com');
  await dialog.getByLabel('邀请权限').selectOption('viewer');
  await dialog.getByRole('button', { name: '邀请成员', exact: true }).click();
  const member = dialog.locator('.workspace-member-row').filter({hasText:'viewer@example.com'});
  await expect(member).toContainText('待加入');
  await member.getByRole('button',{name:'模拟viewer@example.com接受邀请',exact:true}).click();
  await expect(member).toContainText('已加入');
  await dialog.getByText('本地权限体验',{exact:true}).click();
  await dialog.getByLabel('体验成员身份').selectOption({label:'viewer@example.com · 查看者'});
  await expect(dialog).toContainText('当前以查看者身份浏览');
  await expect(dialog.getByLabel('账号或邮箱',{exact:true})).toHaveCount(0);
  await expect(dialog.getByLabel('viewer@example.com的权限')).toHaveCount(0);
  await dialog.getByRole('button',{name:'完成',exact:true}).click();
  await page.goto('/#/projects');
  await expect(page.getByRole('button',{name:'新建作品',exact:true}).first()).toBeDisabled();
  await page.getByRole('button',{name:'退出权限体验',exact:true}).click();
  await openMembers(page);
  await dialog.getByLabel('viewer@example.com的权限').selectOption('editor');
  await expect(dialog.getByLabel('viewer@example.com的权限')).toHaveValue('editor');
  await dialog.getByLabel('账号或邮箱',{exact:true}).fill('pending@example.com');
  await dialog.getByRole('button',{name:'邀请成员',exact:true}).click();
  await dialog.getByRole('button',{name:'撤销pending@example.com的邀请',exact:true}).click();
  await expect(dialog.getByText('pending@example.com',{exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'移除viewer@example.com',exact:true}).click();
  await expect(dialog.getByText('viewer@example.com',{exact:true})).toHaveCount(0);
});
