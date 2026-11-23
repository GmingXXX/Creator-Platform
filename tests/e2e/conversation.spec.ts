
async function generateBackground(page:Page){await page.route('**/api/ai/images**',route=>route.fulfill({json:{id:'demo-bg-test',status:'succeeded',url:'/api/ai/media/demo-bg-test.png'}}));await page.route('**/api/ai/media/demo-bg-test.png',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#123456"/></svg>'}));await expect(page.getByRole('button',{name:'生成背景',exact:true})).toBeVisible({timeout:15000});await page.getByRole('button',{name:'生成背景',exact:true}).click();const dialog=page.getByRole('dialog',{name:'生成与调整背景'});await dialog.getByLabel('画面描述').fill('深蓝工业风格背景，无文字，为事件卡片留白');await dialog.getByRole('button',{name:'生成预览',exact:true}).click();await expect(dialog.getByRole('button',{name:'采用这张背景',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'采用这张背景',exact:true}).click();}
import {reloadAndReopen} from './reload-helpers';
import {useDemoModel} from './home-helpers';
import { expect, test, type Page } from '@playwright/test';
import type { StudioData } from '../../src/domain/types';

const readData = (page: Page): Promise<StudioData> => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);

async function login(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求' })).toBeVisible();
}

async function openCompletedWork(page: Page) {
  await login(page);
  await page.getByRole('textbox', { name: '创作需求' }).fill('这份首页需求必须保留');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
    saved.state.works = saved.state.works.map((work: {id:string}) => ({...work, aiModel:'demo'}));
    saved.state.runs = [{ id: 'run-conversation-test', prompt: '企业发展大事记', model: 'GPT', styleId: '', skillIds: [], attachmentIds: [], status: 'complete', step: 5, outputKind: 'exhibit', workId: 'work-1', createdAt: new Date().toISOString() }];
    localStorage.setItem('zhichuang-studio-v1', JSON.stringify(saved));
  });
  await page.goto('/#/create/run-conversation-test');
  await reloadAndReopen(page);
  await expect(page.getByRole('textbox', { name: '修改当前作品' })).toBeVisible();
}

test('生成缺失背景后主成果仍包含完整展项，新增素材独立展示', async ({ page }) => {
  await login(page);
  await page.getByRole('textbox',{name:'创作需求'}).fill('制作钢铁企业发展大事记，横向时间轴，2560×1120。');
  await useDemoModel(page); await page.getByRole('button', {name:'发送创作需求'}).click();
  await generateBackground(page);
  await expect(page.getByRole('button', { name: '继续编辑', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.artifact-preview .scene-node-timeline')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看采用背景' })).toBeVisible();
  const state = await readData(page), run = state.runs[0];
  const work = state.works.find(w => w.id === run.workId)!;
  const asset = state.assets.find(a => a.id === run.backgroundAssetId)!;
  expect(work.pages[0].backgroundImage).toBe(asset.src);
  expect(work.pages[0].nodes.length).toBeGreaterThan(2);
});

test('连续修改当前作品、刷新恢复对话、保留首页草稿并可撤销', async ({ page }) => {
  await openCompletedWork(page);
  const before = await readData(page), original = before.works.find(w => w.id === 'work-1')!;
  const input = page.getByRole('textbox', { name: '修改当前作品' });
  await input.fill('把背景改成暖色');
  await page.getByRole('button', { name: '发送修改', exact: true }).click();
  await expect(page.locator('.conversation-turn')).toHaveCount(1);
  await input.fill('增加一个 2025 年节点：全球布局');
  await page.getByRole('button', { name: '发送修改', exact: true }).click();
  await expect(page.locator('.conversation-turn')).toHaveCount(2);
  const historyTop = await page.locator('.conversation-history').evaluate(element => element.getBoundingClientRect().top);
  const summaryBottom = await page.locator('.completion-note').evaluate(element => element.getBoundingClientRect().bottom);
  expect(historyTop - summaryBottom).toBeLessThan(65);
  const after = await readData(page), work = after.works.find(w => w.id === original.id)!;
  expect(after.works.length).toBe(before.works.length);
  expect(after.runs.length).toBe(before.runs.length);
  expect(work.pages[0].nodes.map(n => n.id)).toEqual(original.pages[0].nodes.map(n => n.id));
  expect(work.pages[0].nodes.find(n => n.type === 'timeline')!.items!.some(item => item.year === '2025')).toBe(true);
  expect(after.drafts.find(d => d.id === before.activeDraftId)!.text).toBe('这份首页需求必须保留');
  await reloadAndReopen(page);
  await expect(page.locator('.conversation-turn')).toHaveCount(2);
  await page.locator('.conversation-turn').last().getByRole('button', { name: '撤销本次修改' }).click();
  await expect(page.locator('.conversation-turn').last()).toContainText('已撤销');
  expect((await readData(page)).works.find(w => w.id === original.id)!.pages[0].nodes.find(n => n.type === 'timeline')!.items).toEqual(original.pages[0].nodes.find(n => n.type === 'timeline')!.items);
  await page.screenshot({ path: 'output/验收截图/v2-连续创作.png', animations: 'disabled' });
});

test('组件范围明确，未知请求保留原作品', async ({ page }) => {
  await openCompletedWork(page);
  const original = (await readData(page)).works.find(w => w.id === 'work-1')!;
  const title = original.pages[0].nodes.find(n => n.type === 'text')!;
  await page.getByLabel('修改范围', { exact: true }).selectOption(`node:${original.pages[0].id}:${title.id}`);
  await page.getByRole('textbox', { name: '修改当前作品' }).fill('字号改为 36');
  await page.getByRole('button', { name: '发送修改', exact: true }).click();
  await expect(page.locator('.conversation-turn')).toHaveCount(1);
  const edited = (await readData(page)).works.find(w => w.id === original.id)!;
  expect(edited.pages[0].nodes.find(n => n.id === title.id)!.fontSize).toBe(36);
  expect(edited.pages[0].nodes.filter(n => n.id !== title.id)).toEqual(original.pages[0].nodes.filter(n => n.id !== title.id));
  await page.getByRole('textbox', { name: '修改当前作品' }).fill('帮我把这个东西变得无法描述的复杂');
  await page.getByRole('button', { name: '发送修改', exact: true }).click();
  await expect(page.locator('.conversation-turn').last()).toContainText('未修改');
  expect((await readData(page)).works.find(w => w.id === original.id)).toEqual(edited);
});

test('首页保持文字提示、回形针上传和设计风格无选项', async ({ page }) => {
  await login(page);
  await expect(page.locator('.home-prompt-pills img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '上传文件', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '设计风格', exact: true }).click();
  await page.locator('.design-picker-grid button').filter({ hasText: '科技风' }).click();
  await page.getByRole('button', { name: '设计风格', exact: true }).click();
  await page.getByRole('button', { name: '无', exact: true }).click();
  const state = await readData(page);
  expect(state.drafts.find(d => d.id === state.activeDraftId)!.styleId).toBe('');
});

test('带附件修改选中图片，保留布局并持久保存媒体', async ({ page }) => {
  await openCompletedWork(page);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
    const work = saved.state.works.find((item: {id:string}) => item.id === 'work-1');
    work.pages[0].nodes = [...work.pages[0].nodes, {...work.pages[0].nodes[0], id:'replacement-image', type:'image', name:'展项配图', src:'/media/industrial.svg', x:20, y:20, width:200, height:100}];
    localStorage.setItem('zhichuang-studio-v1', JSON.stringify(saved));
  });
  await reloadAndReopen(page);
  const before = (await readData(page)).works.find(work => work.id === 'work-1')!;
  await page.getByLabel('修改范围', {exact:true}).selectOption(`node:${before.pages[0].id}:replacement-image`);
  await page.locator('.work-followup-composer input[type=file]').setInputFiles({name:'新展项配图.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/XkAAAAASUVORK5CYII=', 'base64')});
  await expect(page.locator('.followup-attachments')).toContainText('新展项配图.png');
  await page.getByRole('textbox',{name:'修改当前作品'}).fill('替换这张图片');
  await page.getByRole('button',{name:'发送修改',exact:true}).click();
  await expect(page.locator('.conversation-turn')).toContainText('已替换选中图片');
  const after = await readData(page), changed = after.works.find(work => work.id === before.id)!;
  const previous = before.pages[0].nodes.find(node => node.id === 'replacement-image')!;
  const node = changed.pages[0].nodes.find(node => node.id === previous.id)!;
  expect(node.src).not.toBe(previous.src);
  const {src:oldSrc,assetId:oldAssetId,...previousProperties}=previous;
  const {src:newSrc,assetId:newAssetId,...currentProperties}=node;
  expect(currentProperties).toEqual(previousProperties);
  const replacement=after.assets.find(asset => asset.src === newSrc);
  expect(replacement).toBeDefined();
  expect(newAssetId).toBe(replacement!.id);
  expect(replacement!.workspaceId).toBe(before.workspaceId || 'personal');
  await reloadAndReopen(page);
  await expect(page.locator('[data-node-id="replacement-image"] img')).toHaveJSProperty('complete', true);
  expect((await readData(page)).works.find(work => work.id === before.id)!.pages[0].nodes.find(node => node.id === previous.id)!.src).toBe(node.src);
});

test('切换创作任务时清除旧作品的修改范围', async ({ page }) => {
  await openCompletedWork(page);
  const before = await readData(page), work = before.works.find(item => item.id === 'work-1')!;
  await page.getByLabel('修改范围',{exact:true}).selectOption(`page:${work.pages[0].id}`);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
    saved.state.runs.push({...saved.state.runs[0], id:'run-second-task', workId:'work-2'});
    localStorage.setItem('zhichuang-studio-v1', JSON.stringify(saved));
  });
  await reloadAndReopen(page);
  await page.getByLabel('修改范围',{exact:true}).selectOption(`page:${work.pages[0].id}`);
  await page.evaluate(() => { location.hash = '#/create/run-second-task'; });
  await expect(page.getByLabel('修改范围',{exact:true})).toHaveValue('work');
  await page.getByRole('textbox',{name:'修改当前作品'}).fill('把背景改成暖色');
  await page.getByRole('button',{name:'发送修改',exact:true}).click();
  await expect(page.locator('.conversation-turn')).toContainText('已应用');
  expect((await readData(page)).works.find(item => item.id === 'work-2')!.pages[0].background).toBe('#5b3528');
});
