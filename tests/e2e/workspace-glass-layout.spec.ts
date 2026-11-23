import { expect, test, type Locator } from '@playwright/test';

async function gridMetrics(grid: Locator) {
  return grid.evaluate(el => {
    const style = getComputedStyle(el);
    const card = el.children[0].getBoundingClientRect();
    return {
      columns: style.gridTemplateColumns.split(' ').length,
      gap: style.gap,
      width: Math.round(card.width),
      height: Math.round(card.height),
    };
  });
}

test('切换主题时浏览器底色同步，作品与模板保持原有卡片规格', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();

  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: '切换到暗色模式' }).click();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', theme === 'dark' ? '#141414' : '#fafafa');
    for (const width of [1440, 1024]) {
      const desktop = width === 1440;
      await page.setViewportSize({ width, height: 960 });
      await page.goto('/#/');
      const templates = page.locator('.home-template-grid');
      await expect(templates.locator('article').first()).toBeVisible();
      await expect(page.locator('.home-brand-lockup svg')).toHaveCSS('width', '64px');
      expect(await gridMetrics(templates)).toEqual({
        columns: desktop ? 3 : 2, gap: '26px 20px', width: desktop ? 357 : 352, height: desktop ? 279 : 276,
      });
      await page.goto('/#/projects');
      const works = page.locator('.res-projects');
      await expect(works.locator(':scope > *').first()).toBeVisible();
      expect(await gridMetrics(works)).toEqual({
        columns: desktop ? 3 : 2, gap: desktop ? '24px' : '18px', width: 355, height: desktop ? 367 : 365,
      });
    }
    await page.goto('/#/');
  }
});
