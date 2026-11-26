import {reloadAndReopen} from './reload-helpers';
import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function openEditor(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
}
const currentWork=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w:{id:string})=>w.id==='work-1'));
test('编辑器针对选中组件连续修改，刷新保留记录，撤销不会被自动保存阻断',async({page})=>{
 await openEditor(page);const before=await currentWork(page);await page.locator('.node-hitbox').nth(1).click();await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();await page.getByLabel('修改模型',{exact:true}).selectOption('demo');
 const target=page.getByLabel('修改范围',{exact:true});await expect(target).toHaveValue(`node:${before.pages[0].id}:${before.pages[0].nodes[1].id}`);
 await page.getByLabel('修改当前作品',{exact:true}).fill('把文字改为“焕新未来”');await page.getByRole('button',{name:'发送修改',exact:true}).click();await expect(page.locator('.scene-board .scene-renderer')).toContainText('焕新未来');
 await page.getByLabel('修改当前作品',{exact:true}).fill('字号改为 60');await page.getByRole('button',{name:'发送修改',exact:true}).click();await expect(page.locator('.conversation-turn.applied')).toHaveCount(2);await expect(page.locator('.editor-document')).toContainText('所有更改已保存');
 await mkdir('output/验收截图',{recursive:true});await page.screenshot({path:'output/验收截图/v2-editor-conversation.png'});
 await page.setViewportSize({width:1024,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.getByLabel('修改当前作品',{exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:'发送修改',exact:true})).toBeInViewport();await page.setViewportSize({width:1440,height:960});
 const after=await currentWork(page);expect(after.id).toBe(before.id);expect(after.pages[0].nodes[1].fontSize).toBe(60);expect(after.pages[0].nodes[2]).toEqual(before.pages[0].nodes[2]);
 await page.getByRole('button',{name:'撤销本次修改',exact:true}).click();await expect(page.locator('.conversation-turn.reverted')).toHaveCount(1);expect((await currentWork(page)).pages[0].nodes[1].fontSize).toBe(before.pages[0].nodes[1].fontSize);
 await reloadAndReopen(page);await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();await expect(page.getByLabel('修改范围',{exact:true})).toHaveValue(`node:${before.pages[0].id}:${before.pages[0].nodes[1].id}`);await expect(page.locator('.conversation-turn')).toHaveCount(2);await expect(page.locator('.scene-board .scene-renderer')).toContainText('焕新未来');
});
test('设计风格无不改变画面，运行预览和独立预览返回保留编辑视角',async({page})=>{
 await openEditor(page);await page.locator('.node-hitbox').nth(1).click();await page.getByTitle('放大',{exact:true}).click();const zoom=await page.locator('.zoom-readout').innerText();const selected=await page.locator('.node-hitbox.selected').count();
 await page.getByRole('button',{name:'预览',exact:true}).first().click();await page.getByRole('button',{name:/返回编辑/}).click();await expect(page.locator('.zoom-readout')).toHaveText(zoom);expect(await page.locator('.node-hitbox.selected').count()).toBe(selected);
 const before=await currentWork(page);await page.locator('.editor-system-trigger').click();await page.locator('.editor-system-menu').getByRole('button',{name:'无',exact:true}).click();await expect.poll(async()=>(await currentWork(page)).styleId).toBe('');expect((await currentWork(page)).pages).toEqual(before.pages);
 await page.goto('/#/preview/work-1');await page.getByRole('button',{name:'编辑展项',exact:true}).click();await expect(page.locator('.zoom-readout')).toHaveText(zoom);expect(await page.locator('.node-hitbox.selected').count()).toBe(selected);
});

test('解除浅色设计风格后实际时间轴卡片样式保持不变',async({page})=>{
 await openEditor(page);
 for(const name of ['政务风','珠宝银','人文典藏','现代财经']){
  await page.locator('.editor-system-trigger').click();await page.locator('.editor-system-menu').getByRole('button',{name:new RegExp(name)}).click();
  const scene=page.locator('.scene-board .scene-renderer');await expect(scene).toHaveAttribute('data-scene-theme','light');
  const card=scene.locator('.event-card').first();const before=await card.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('h3')!).color}));
  await page.locator('.editor-system-trigger').click();await page.locator('.editor-system-menu').getByRole('button',{name:'无',exact:true}).click();
  await expect(scene).toHaveAttribute('data-scene-theme','light');expect(await card.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('h3')!).color}))).toEqual(before);
 }
});
