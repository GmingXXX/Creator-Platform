import {reloadAndReopen} from './reload-helpers';
import { test, expect, type Page } from '@playwright/test';
import type { StudioData } from '../../src/domain/types';

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE0cAAAAASUVORK5CYII=', 'base64');
const readState = (page: Page): Promise<StudioData> => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);

test.beforeEach(async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
});

test('上传素材仅提取客观信息，业务说明保存后可检索且刷新保留', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByRole('button', { name: '上传素材', exact: true }).first().click();
  await page.locator('input[type=file]').setInputFiles({ name: '最终版背景03.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByText('已添加', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '预览最终版背景03.png', exact: true }).click();
  await page.getByRole('tab', { name: '素材信息', exact: true }).click();
  const details = page.getByTestId('asset-metadata');
  await expect(details).toContainText('待补充内容说明');
  await expect(details).toContainText('1 × 1');
  await expect(page.getByLabel('适用对象', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('已确认该素材属于上述对象', { exact: true })).not.toBeChecked();
  await page.getByLabel('业务说明', { exact: true }).fill('客户提供的晋江工厂实拍，可用于企业介绍页面');
  await page.getByLabel('适用对象', { exact: true }).fill('信泰晋江工厂');
  await page.getByLabel('已确认该素材属于上述对象', { exact: true }).check();
  await page.getByRole('button', { name: '保存素材信息', exact: true }).click();
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索素材名称、说明或标签', exact: true }).fill('晋江工厂');
  await expect(page.getByRole('button', { name: '预览最终版背景03.png', exact: true })).toBeVisible();
  await reloadAndReopen(page);
  await page.getByRole('button', { name: '预览最终版背景03.png', exact: true }).click();
  await page.getByRole('tab', { name: '素材信息', exact: true }).click();
  await expect(page.getByLabel('业务说明', { exact: true })).toHaveValue('客户提供的晋江工厂实拍，可用于企业介绍页面');
  await expect(page.getByLabel('已确认该素材属于上述对象', { exact: true })).toBeChecked();
  const asset = (await readState(page)).assets.find(item => item.name === '最终版背景03.png')!;
  expect(asset.public).toBe(false);
  expect(asset.metadata?.business?.subject).toBe('信泰晋江工厂');
  await page.screenshot({ path: 'output/验收截图/v13-material-metadata.png', animations: 'disabled' });
});

test('社区素材信息只读，素材管理移除归档选项', async ({ page }) => {
  await page.goto('/#/library');
  await expect(page.getByLabel('素材状态')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveText(['全部素材','图片','视频','音频','组件','文档资料']);
  await page.goto('/#/community?tab=assets');
  await page.locator('.res-assets-grid .res-cover-button').first().click();
  await page.getByRole('tab', { name: '素材信息', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存素材信息', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('asset-metadata')).toContainText('社区发布信息');
});

test('未保存素材说明切换页签保留，关闭时可继续编辑、放弃或保存', async ({ page }) => {
  await page.goto('/#/library');
  const initial = (await readState(page)).assets.find(asset => asset.id === 'personal-asset-1')!;
  await page.getByRole('button', { name: `预览${initial.name}`, exact: true }).click();
  await page.getByRole('tab', { name: '素材信息', exact: true }).click();
  await page.getByLabel('业务说明', { exact: true }).fill('切换预览后仍应保留的说明');
  await page.getByRole('tab', { name: '效果预览', exact: true }).click();
  await page.getByRole('tab', { name: '素材信息', exact: true }).click();
  await expect(page.getByLabel('业务说明', { exact: true })).toHaveValue('切换预览后仍应保留的说明');
  await page.getByRole('button', { name: '保存素材信息', exact: true }).click();
  await page.getByLabel('业务说明', { exact: true }).fill('尚未保存的下一份说明');
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '保存素材信息？', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByLabel('业务说明', { exact: true })).toHaveValue('尚未保存的下一份说明');
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await confirmation.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await readState(page)).assets.find(asset => asset.id === initial.id)?.metadata?.business?.note).toBe('切换预览后仍应保留的说明');
  await page.getByRole('button', { name: `预览${initial.name}`, exact: true }).click();
  await page.getByRole('tab', { name: '素材信息', exact: true }).click();
  await page.getByLabel('业务说明', { exact: true }).fill('关闭前确认保存的说明');
  await page.getByRole('tab', { name: '使用说明', exact: true }).click();
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await confirmation.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await readState(page)).assets.find(asset => asset.id === initial.id)?.metadata?.business?.note).toBe('关闭前确认保存的说明');
});
