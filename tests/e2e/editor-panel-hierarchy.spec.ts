import {test,expect,type Page} from '@playwright/test';

async function enter(page:Page){
  await page.goto('/#/login');
  await page.getByRole('button',{name:'填入',exact:true}).click();
  await page.getByRole('button',{name:'进入工作台'}).click();
  await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
}

for(const theme of ['light','dark'])test('组件分类和属性标题可辨识、可用键盘操作 · '+theme,async({page})=>{
  await enter(page);
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:/切换到(暗|浅)色模式/}).click();
  await page.goto('/#/editor/work-1');
  const group=page.getByRole('heading',{name:'复合组件',exact:true,level:2}).getByRole('button');
  const family=page.getByRole('heading',{name:'时间轴',exact:true,level:3}).getByRole('button');
  await expect(group).toBeVisible();
  expect(await page.locator('.editor-catalog button[aria-controls]').evaluateAll(buttons=>buttons.every(button=>{
    const id=button.getAttribute('aria-controls')||'';
    return !/\s/.test(id)&&!!document.getElementById(id);
  }))).toBe(true);
  const size=(locator:typeof group)=>locator.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  expect(await size(group)).toBeGreaterThan(await size(family));
  const primaryInk=await group.evaluate(el=>{
    const sample=document.createElement('span');sample.style.color='var(--zc-text)';el.appendChild(sample);
    const expected=getComputedStyle(sample).color;sample.remove();
    return {actual:getComputedStyle(el).color,expected};
  });
  expect(primaryInk.actual).toBe(primaryInk.expected);
  await group.focus();
  await group.press('Space');
  await expect(family).toBeHidden();
  await group.press('Enter');
  await family.focus();
  await family.press('Enter');
  const variant=page.getByTitle('点击或拖入画布添加鱼骨时间轴');
  await expect(variant).toBeVisible();
  expect(await variant.getAttribute('draggable')).toBe('true');
  await variant.click();
  await expect(page.locator('.node-hitbox.selected')).toBeVisible();
  const inspector=page.locator('.inspector-section h3 button').first();
  const controls=await inspector.getAttribute('aria-controls');
  expect(controls).toBeTruthy();
  await inspector.press('Space');
  await expect(inspector).toHaveAttribute('aria-expanded','false');
  const query=page.getByRole('textbox',{name:'搜索组件'});
  await query.fill('鱼骨');
  await expect(page.getByRole('heading',{name:'基础组件',exact:true})).toHaveCount(0);
  await expect(variant).toBeVisible();
  await group.click();
  await expect(variant).toBeHidden();
  await query.fill('完全无此组件');
  await expect(page.getByText('未找到匹配的组件')).toBeVisible();
  await query.fill('');
  await expect(variant).toBeVisible();
});

test('演示编辑器区分面板标题、当前页和页面属性',async({page})=>{
  await enter(page);
  await page.goto('/#/presentations/work-4');
  await expect(page.getByRole('heading',{name:'页面',exact:true,level:2})).toBeVisible();
  const inspector=page.locator('.studio-inspector');
  await expect(inspector.getByRole('heading',{name:'属性',exact:true,level:2})).toBeVisible();
  const thumbnails=page.locator('.slide-thumbnails > button');
  await thumbnails.nth(1).click();
  await expect(thumbnails.nth(1)).toHaveAttribute('aria-current','page');
  await expect(page.locator('.slide-thumbnails [aria-current="page"]')).toHaveCount(1);
  const tier=(el:Element)=>parseFloat(getComputedStyle(el).fontSize);
  expect(await inspector.getByRole('heading',{name:'属性',exact:true}).evaluate(tier)).toBeGreaterThan(await thumbnails.nth(1).locator(':scope > div > small').evaluate(tier));
});
