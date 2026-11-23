import {expect, test} from '@playwright/test';
import {useDemoModel} from './home-helpers';

test('创作进度只在左侧显示，停止和恢复继续使用同一流程', async ({page}, testInfo) => {
  await page.route('**/api/ai/**', route => route.fulfill({json: {models: [], configured: {}}}));
  await page.goto('/#/login');
  await page.getByRole('button', {name: '填入', exact: true}).click();
  await page.getByRole('button', {name: '进入工作台'}).click();
  const input = page.getByRole('textbox', {name: '创作需求', exact: true});
  await input.fill('制作企业发展大事记展项');
  await useDemoModel(page);
  await page.getByRole('button', {name: '发送创作需求'}).click();

  const progress = page.locator('.run-conversation').getByRole('region', {name: '创作进度'});
  await expect(progress.getByRole('status')).toHaveText('进行中');
  await expect(page.locator('.run-artifact').getByRole('region', {name: '创作进度'})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('creation-progress-sidebar.png')});
  await page.getByRole('button', {name: '停止生成', exact: true}).click();
  await expect(progress.getByRole('status')).toHaveText('已停止');
  await expect(progress.locator('.spinner')).toHaveCount(0);
  await page.getByRole('button', {name: '继续创作', exact: true}).click();
  await expect(page.getByRole('button', {name: '继续编辑', exact: true})).toBeVisible({timeout: 15000});
  await expect(progress).toHaveCount(0);
  await page.getByRole('button', {name: '创作流程已完成'}).click();
  await expect(progress.getByText('已完成', {exact: true})).toHaveCount(6);
});
