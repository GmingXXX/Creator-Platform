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

  // Compare the same workspace width regardless of the homepage's initial sidebar preference.
  await page.getByRole('button',{name:'展开侧栏'}).click();
  await expect(page.locator('.app-shell')).toHaveCSS('padding-left','240px');
  const lightMetrics = new Map<string,Awaited<ReturnType<typeof gridMetrics>>>();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: '切换到暗色模式' }).click();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--zc-bg').trim()));
    for (const width of [1440, 1024]) {
      const desktop = width === 1440;
      await page.setViewportSize({ width, height: 960 });
      await page.goto('/#/');
      const templates = page.locator('.home-template-grid');
      await expect(templates.locator('article').first()).toBeVisible();
      await expect(page.locator('.home-brand-lockup svg')).toHaveCSS('width', '64px');
      const templateSize=await gridMetrics(templates);
      expect(templateSize).toMatchObject({columns:desktop?3:2,gap:'26px 20px',width:desktop?357:352});
      if(theme==='light')lightMetrics.set('template'+width,templateSize);
      else expect(templateSize).toEqual(lightMetrics.get('template'+width));
      await page.goto('/#/projects');
      const works = page.locator('.res-projects');
      await expect(works.locator(':scope > *').first()).toBeVisible();
      const workSize=await gridMetrics(works);
      expect(workSize).toMatchObject({columns:desktop?3:2,gap:desktop?'24px':'18px',width:355});
      if(theme==='light')lightMetrics.set('work'+width,workSize);
      else expect(workSize).toEqual(lightMetrics.get('work'+width));
    }
    await page.goto('/#/');
  }
});
