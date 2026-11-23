import {reloadAndReopen} from './reload-helpers';
import { test, expect, type Page } from '@playwright/test';
import type { StudioData } from '../../src/domain/types';

const readState = (page: Page): Promise<StudioData> => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const scenarios = [
  { kind: 'presentation', hub: '/presentations', hubTitle: '智能演示', create: '新建演示', route: 'presentations', titleField: '演示名称', title: '讲解演示项目归属验收', detailField: '本页讲稿', detail: '由作品库继续编辑的讲稿。' },
  { kind: 'video', hub: '/presentations', hubTitle: '智能演示', create: '新建视频', route: 'video', titleField: '作品名称', title: '视频项目归属验收', detailField: '讲述文案', detail: '由作品库继续编辑的视频分镜文案。' },
  { kind: 'story', hub: '/dream', hubTitle: '互动影片', create: '新建互动影片', route: 'dream', titleField: '作品名称', title: '互动影片项目归属验收', detailField: '作品名称', detail: '互动影片项目 · 返回首页自动保存' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
});

for (const scenario of scenarios) {
  test(`${scenario.hubTitle} ${scenario.kind}：创建保存进入作品库、恢复编辑、回首页自动保存`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/#${scenario.hub}`);
    await expect(page.getByRole('heading',{name:'我的作品',exact:true})).toBeVisible();
    if(scenario.kind==='video'){
      await page.goto('/#/video/work-5');await page.getByLabel('作品名称',{exact:true}).fill(scenario.title);await page.getByRole('button',{name:'保存',exact:true}).click();
    }else{
    await page.locator('.sidebar').getByRole('button',{name:'新建作品',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:scenario.kind==='story'?'互动影片':'智能演示',exact:true}).click();
    if (scenario.kind === 'story') {
      await page.getByLabel('作品名称', { exact: true }).fill(scenario.title);
      await page.getByRole('button', { name: '进入空白画布', exact: true }).click();
    } else {
      await page.getByLabel('你想讲述什么？', { exact: true }).fill(scenario.title);
      await page.getByLabel('生成模型', {exact:true}).selectOption('demo');
      await page.getByRole('button', { name: '生成大纲', exact: true }).click();
      await page.getByRole('button', { name: '创建并进入编辑器', exact: true }).click();
    }
    }
    await expect(page).toHaveURL(new RegExp(`#/${scenario.route}/`));
    await expect(page.getByRole('button', { name: '查看素材库', exact: true })).toHaveCount(0);
    const created = (await readState(page)).works.find(work => work.title === scenario.title)!;
    expect(created.kind).toBe(scenario.kind);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('button', { name: '查看作品', exact: true }).click();
    await expect(page).toHaveURL(/#\/projects/);
    await page.getByRole('button', { name: `打开${scenario.title}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#/${scenario.route}/${created.id}$`));
    await page.getByLabel(scenario.detailField, { exact: true }).fill(scenario.detail);
    await page.getByRole('button', { name: '智创首页', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '创作需求', exact: true })).toBeVisible();
    const finalTitle = scenario.kind === 'story' ? scenario.detail : scenario.title;
    await page.getByRole('link', { name: '作品', exact: true }).click();
    await page.getByRole('button', { name: `打开${finalTitle}`, exact: true }).click();
    await reloadAndReopen(page);
    await expect(page.getByLabel(scenario.detailField, { exact: true })).toHaveValue(scenario.detail);
    const state = await readState(page);
    expect(state.assets.filter(asset => asset.sourceWorkId === created.id || asset.workSnapshot?.id === created.id)).toEqual([]);
    await page.getByRole('button', { name: '查看作品', exact: true }).click();
    await expect(page.getByRole('button',{name:`打开${finalTitle}`,exact:true})).toBeVisible();
    await expect(page.getByTestId('project-category-filter').getByRole('button',{name:scenario.kind==='story'?'互动影片':'智能演示',exact:true})).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });
}
