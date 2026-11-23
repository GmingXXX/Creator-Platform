import {openSpaceSettings} from './workspace-settings-helpers';
import { test, expect, type Page } from '@playwright/test';

async function selectSpace(page: Page, name: string) {
  await page.getByRole('button', { name: '切换创作空间' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
async function openMembers(page: Page) {
  await openSpaceSettings(page,'成员与权限');
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('模拟成员邀请、权限变更与空间隔离清楚且可用', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
  await selectSpace(page, '信泰企业展厅');
  await openMembers(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('不会发送真实邀请');
  await expect(dialog).toContainText('个人素材与 Skills');
  await dialog.getByRole('button', { name: '邀请成员', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('请输入');
  await dialog.getByLabel('账号或邮箱', { exact: true }).fill('王设计');
  await dialog.getByRole('button', { name: '邀请成员', exact: true }).click();
  await expect(dialog).toContainText('待加入 · 本地邀请');
  await dialog.getByLabel('王设计的权限').selectOption('viewer');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await page.reload();
  await openMembers(page);
  await expect(dialog.getByLabel('王设计的权限')).toHaveValue('viewer');
  await page.screenshot({ path: 'output/验收截图/v15-workspace-members.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await selectSpace(page, '东莞博物馆');
  await openMembers(page);
  await expect(dialog.getByText('王设计', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await selectSpace(page, '信泰企业展厅');
  await openMembers(page);
  await dialog.getByRole('button', { name: '撤销王设计的邀请' }).click();
  await expect(dialog.getByText('王设计', { exact: true })).toHaveCount(0);
});
