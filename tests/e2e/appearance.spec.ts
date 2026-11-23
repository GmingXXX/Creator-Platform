import { expect, test, type Page } from '@playwright/test';

async function expectHomeSurface(page: Page, color: string) {
  for (const selector of ['.sidebar', '.workspace-main', '.home-workspace', '.composer']) {
    const surface = page.locator(selector);
    await expect(surface).toHaveCSS('background-color', color);
    await expect(surface).toHaveCSS('background-image', 'none');
  }
}

test('keeps appearance across login and reload, themes dialogs and editor chrome', async ({ page }, testInfo) => {
  await page.goto('/#/login');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '切换到暗色模式' }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();

  const darkSidebar = page.getByRole('button', { name: '切换到浅色模式' });
  await expect(darkSidebar).toBeVisible();
  await expectHomeSurface(page, 'rgb(20, 20, 20)');
  await page.screenshot({ path: testInfo.outputPath('home-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('background-color', 'rgb(20, 20, 20)');
  await page.screenshot({ path: testInfo.outputPath('creation-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '关闭对话框' }).click();

  await page.reload();
  await expect(darkSidebar).toBeVisible();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.workspace-switch')).toHaveCSS('background-color', 'rgb(20, 20, 20)');
  await page.goto('/#/editor/work-1');
  await expect(page.locator('.editor-toolbar')).toHaveCSS('background-color', 'rgb(20, 20, 20)');
  const scene = page.locator('.scene-board');
  await expect(scene).toBeVisible();
  const sceneStyle = await scene.getAttribute('style');
  await page.screenshot({ path: testInfo.outputPath('editor-dark.png'), animations: 'disabled' });

  await page.goto('/#/');
  await page.getByRole('button', { name: '收起侧栏' }).click();
  await expect(darkSidebar).toBeVisible();
  await darkSidebar.click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: '切换到暗色模式' })).toBeVisible();
  await page.getByRole('button', { name: '展开侧栏' }).click();
  await expectHomeSurface(page, 'rgb(250, 250, 250)');
  await page.screenshot({ path: testInfo.outputPath('home-light.png'), animations: 'disabled' });
  await page.goto('/#/editor/work-1');
  await expect(page.locator('.editor-toolbar')).toHaveCSS('background-color', 'rgb(250, 250, 250)');
  expect(await scene.getAttribute('style')).toEqual(sceneStyle);
});


test('glass filter follows selection on mobile and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.locator('.composer')).toBeVisible();
  await page.goto('/#/skills');
  const allSkills = page.getByRole('tab', { name: '全部技能' });
  const favorites = page.getByRole('tab', { name: '我的收藏' });
  const filter = page.getByRole('tablist').filter({ has: allSkills });
  const indicator = () => filter.evaluate(el => {
    const style = getComputedStyle(el, '::before');
    return { x: style.transform === 'none' ? 0 : new DOMMatrix(style.transform).m41, content: style.content, transition: style.transitionProperty };
  });
  await expect(allSkills).toHaveAttribute('aria-selected', 'true');
  expect((await indicator()).content).toEqual('""');
  await favorites.click();
  await expect(favorites).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await indicator()).x).toBeGreaterThan(30);
  const firstBox = await allSkills.boundingBox();
  const secondBox = await favorites.boundingBox();
  expect(secondBox!.x + secondBox!.width).toBeLessThanOrEqual(390);
  await expect.poll(async () => (await indicator()).x).toBeCloseTo(secondBox!.x - firstBox!.x, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await favorites.press('ArrowLeft');
  await expect(allSkills).toBeFocused();
  await expect(allSkills).toHaveAttribute('aria-selected', 'true');
  expect((await indicator()).x).toEqual(0);
  expect((await indicator()).transition).toEqual('none');
});

test('dark knowledge binding keeps its summary, demo source and fields legible', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '切换到暗色模式' }).click();
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await page.getByRole('button', { name: '切换创作空间' }).click();
  await page.getByRole('menuitem', { name: '信泰企业展厅', exact: true }).click();
  await page.getByRole('button', { name: '查看知识本地场绑定' }).click();
  const dialog = page.getByRole('dialog', { name: '管理项目空间' });
  for (const selector of ['.workspace-knowledge-current', '.workspace-knowledge-demo-choice']) {
    await expect(dialog.locator(selector)).toHaveCSS('background-color', 'rgb(20, 20, 20)');
    await expect(dialog.locator(selector).locator('strong')).toHaveCSS('color', 'rgb(237, 237, 237)');
  }
  await dialog.getByRole('button', { name: '使用演示知识本地场' }).click();
  await dialog.getByRole('button', { name: '保存绑定配置' }).click();
  await expect(dialog.locator('.workspace-knowledge-demo-choice p')).toHaveCSS('color', 'rgb(173, 173, 173)');
  await expect(dialog.getByLabel('知识本地场id', { exact: true })).toHaveCSS('color', 'rgb(237, 237, 237)');
  await expect(dialog.getByText('智创真实演示资料_20261116', { exact: true })).toHaveCSS('color', 'rgb(237, 237, 237)');
});
