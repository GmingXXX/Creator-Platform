import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
});
test('属性输入后重新选择画布可键盘删除，输入时和锁定时不会删组件',async({page})=>{
 const node=page.locator('.node-hitbox').nth(1);const id=await node.getAttribute('data-hit-node');const target=page.locator(`[data-hit-node="${id}"]`);
 await target.click();const x=page.getByRole('spinbutton',{name:'X',exact:true});await x.fill('120');await page.keyboard.press('Backspace');await expect(target).toBeVisible();
 await target.click();await page.keyboard.press('Delete');await expect(target).toHaveCount(0);await page.getByTitle('撤销（⌘Z）').click();await expect(target).toBeVisible();
 await target.click();await page.getByTitle('锁定所选组件').click();await page.keyboard.press('Delete');await expect(target).toBeVisible();
});
test('图层拖动同步前后顺序且可以撤销',async({page})=>{
 await page.getByRole('button',{name:/^图层/}).click();const rows=page.locator('[data-layer-id]');const before=await rows.evaluateAll(els=>els.map(el=>el.getAttribute('data-layer-id')));
 expect(before.length).toBeGreaterThan(1);const source=rows.last(),target=rows.first();await source.dragTo(target,{targetPosition:{x:45,y:3}});
 await expect(rows.first()).toHaveAttribute('data-layer-id',before.at(-1)!);await page.getByTitle('撤销（⌘Z）').click();expect(await rows.evaluateAll(els=>els.map(el=>el.getAttribute('data-layer-id')))).toEqual(before);
});
test('风格只在顶部保留且原生文字提供文字样式',async({page})=>{
 await expect(page.locator('.editor-inspector')).not.toContainText('设计风格');await expect(page.locator('.editor-system-trigger')).toBeVisible();await expect(page.getByRole('button',{name:'导出管理平台运行包',exact:true})).toBeVisible();
 await page.locator('.component-tile').filter({hasText:'文本'}).first().click();await expect(page.getByRole('combobox',{name:'字体',exact:true})).toBeVisible();await page.getByRole('combobox',{name:'字重',exact:true}).selectOption('700');await page.getByRole('spinbutton',{name:'字号',exact:true}).fill('52');await expect(page.getByRole('spinbutton',{name:'字号',exact:true})).toHaveValue('52');
});
test('图表正文与整体字号实际应用到可见标签',async({page})=>{
 await page.locator('.component-tile').filter({hasText:'数据看板'}).click();
 const labels=page.locator('.scene-board .scene-chart .chart-bars>div>span');await expect(labels.first()).toBeVisible();
 await page.getByLabel('文字范围',{exact:true}).selectOption('body');await page.getByRole('spinbutton',{name:'字号',exact:true}).fill('44');await expect(labels.first()).toHaveCSS('font-size','44px');
 await page.getByLabel('文字范围',{exact:true}).selectOption('whole');await page.getByRole('spinbutton',{name:'字号',exact:true}).fill('36');await expect(labels.first()).toHaveCSS('font-size','36px');
});
