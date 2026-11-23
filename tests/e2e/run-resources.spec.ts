import {reloadAndReopen} from './reload-helpers';
import {useDemoModel} from './home-helpers';
import { test, expect, type Page } from '@playwright/test';
import type { StudioData } from '../../src/domain/types';
import { assetVersion } from '../../src/domain/resource-adoption';
import { getAssetMetadata } from '../../src/domain/asset-metadata';

const readState = (page:Page):Promise<StudioData> => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);

test.beforeEach(async ({page}) => {
 await page.route('**/api/ai/images**',route=>route.fulfill({json:{id:'demo-bg-test',status:'succeeded',url:'/api/ai/media/demo-bg-test.png'}}));await page.route('**/api/ai/media/demo-bg-test.png',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#123456"/></svg>'}));
  await page.goto('/#/login');
  await page.getByRole('button',{name:'填入',exact:true}).click();
  await page.getByRole('button',{name:'进入工作台'}).click();
  await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
});

async function create(page:Page, prompt:string) {
  await page.getByRole('textbox',{name:'创作需求'}).fill(prompt);
  await useDemoModel(page); await page.getByRole('button', {name:'发送创作需求'}).click();
}

async function complete(page:Page){await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible({timeout:15000});}
async function openPicker(page:Page){await complete(page);await page.getByRole('button',{name:'从素材库选择',exact:true}).click();return page.getByRole('dialog',{name:'选择展项背景'});}

test('完成作品后采用社区素材，绑定私有版本并保留完整展项', async ({page}) => {
 await create(page,'为钢铁科技企业制作发展大事记展项');
 const dialog=await openPicker(page);await dialog.getByRole('tab',{name:'共创社区',exact:true}).click();
 const candidate=dialog.locator('.material-picker-card').first();const label=await candidate.getAttribute('aria-label');await candidate.click();await dialog.getByRole('button',{name:'使用此素材',exact:true}).click();
 const data=await readState(page),run=data.runs[0],adopted=data.assets.find(asset=>asset.id===run.backgroundAssetId)!,work=data.works.find(work=>work.id===run.workId)!;
 expect(label).toBe(`选择${adopted.name}`);expect(adopted.public).toBe(false);expect(adopted.workspaceId).toBe('personal');expect(adopted.origin?.assetId).toBeTruthy();
 expect(work.pages[0].backgroundImage).toBe(adopted.src);expect(work.pages[0].backgroundAssetId).toBe(adopted.id);expect(work.pages[0].nodes.some(node=>node.type==='timeline')).toBe(true);
 await expect(page.getByRole('button',{name:'查看采用背景'})).toBeVisible();await reloadAndReopen(page);await expect(page.locator('.artifact-preview .scene-node-timeline')).toBeVisible();
});

test('没有匹配背景仍先完成页面，生成预览确认后才采用背景', async ({page}) => {
 await create(page,'深海珊瑚科普展项');await complete(page);const before=await readState(page),original=before.works.find(w=>w.id===before.runs[0].workId)!;
 await expect(page.locator('.background-candidate')).toHaveCount(0);await page.getByRole('button',{name:'生成背景',exact:true}).click();const dialog=page.getByRole('dialog',{name:'生成与调整背景'});
 await dialog.getByLabel('画面描述').fill('深海珊瑚背景，中央留白，不包含文字');await dialog.getByRole('button',{name:'生成预览',exact:true}).click();await expect(dialog.getByRole('button',{name:'采用这张背景',exact:true})).toBeEnabled();
 expect((await readState(page)).works.find(w=>w.id===original.id)).toEqual(original);await dialog.getByRole('button',{name:'采用这张背景',exact:true}).click();
 const data=await readState(page),run=data.runs[0],asset=data.assets.find(asset=>asset.id===run.backgroundAssetId)!,work=data.works.find(work=>work.id===run.workId)!;
 expect(work.pages[0].backgroundImage).toBe(asset.src);expect(work.pages[0].nodes).toEqual(original.pages[0].nodes);
});

test('明确客户实拍需求时不擅自绑定业务身份未确认的通用图片', async ({page}) => {
 await create(page,'为信泰企业制作发展大事记展项，使用客户自己的工厂实拍');await complete(page);
 const state=await readState(page),run=state.runs[0];expect(run.backgroundAssetId).toBeUndefined();await expect(page.locator('.background-candidate')).toHaveCount(0);
 const dialog=await openPicker(page);await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'关闭对话框',exact:true}).click();
 expect((await readState(page)).runs[0].backgroundAssetId).toBeUndefined();
});

test('未知组件明确为待适配交互程序，已适配气泡保留原生属性', async ({page}) => {
  await create(page,'生成一个手势驱动的三维粒子组件');
  await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible({timeout:15000});
  await expect(page.locator('.component-capability-note')).toContainText('可运行预览、调整位置与尺寸');
  await expect(page.locator('.component-capability-note')).toContainText('已开放参数可在生成后的试编辑中修改');
  await expect(page.locator('.component-capability-note')).toContainText('内部结构不会自动拆分');
  let data=await readState(page), run=data.runs[0];
  expect(data.assets.find(asset=>asset.id===run.assetId)?.kind).toBe('html');
  await page.getByRole('button',{name:'返回首页',exact:true}).click();
  await create(page,'制作一个 AI 语音气泡组件');
  await expect(page.getByRole('button',{name:'前往素材库',exact:true})).toBeVisible({timeout:15000});
  await expect(page.locator('.component-capability-note')).toContainText('基于已适配组件');
  data=await readState(page); run=data.runs[0];
  expect(data.assets.find(asset=>asset.id===run.assetId)?.componentType).toBe('bubble');
});

test('手动选材也不能绕过不允许智能体调用的设置', async ({page}) => {
  await page.evaluate(() => {
    const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
    const source=saved.state.assets.find((asset:{id:string})=>asset.id==='personal-asset-1');
    source.name='仅限人工编辑的背景';
    source.metadata={business:{note:'不允许AI任务调用',subject:'',confirmed:false,usage:'project',allowAi:false}};
    localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
  });
  await page.reload();
  await create(page,'深海珊瑚科普展项');
  await openPicker(page);
  const dialog=page.getByRole('dialog',{name:'选择展项背景'});
  await dialog.getByRole('button',{name:'选择仅限人工编辑的背景',exact:true}).click();
  await dialog.getByRole('button',{name:'使用此素材',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('未允许智能体调用');
  expect((await readState(page)).runs[0].status).toBe('complete');
});

for (const restriction of ['disabled','reference'] as const) {
  test(`社区素材已有限制副本时拒绝采用并保留已完成作品：${restriction}`, async ({page}) => {
    const initial=await readState(page);
    const original=initial.assets.find(asset=>asset.id==='asset-2')!;
    const metadata=getAssetMetadata(original);
    const copy={...structuredClone(original),id:'restricted-adoption',workspaceId:'personal',public:false,
      origin:{assetId:original.id,version:assetVersion(original)},
      metadata:{...metadata,business:{...metadata.business,allowAi:restriction!=='disabled',usage:restriction==='reference'?'reference' as const:'project' as const}},
    };
    await page.evaluate(({original,copy}) => {
      const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
      saved.state.assets=[copy,...saved.state.assets.filter((asset:{id:string;src:string})=>asset.src!==original.src||asset.id===original.id)];
      localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
    },{original,copy});
    await page.reload();
    await create(page,'科技发展大事记展项');
    const dialog=await openPicker(page);await dialog.getByRole('tab',{name:'共创社区',exact:true}).click();await dialog.getByRole('button',{name:`选择${original.name}`,exact:true}).click();await dialog.getByRole('button',{name:'使用此素材',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText(restriction==='disabled'?'未允许智能体调用':'仅供参考');
    const current=await readState(page);
    expect(current.runs[0].status).toBe('complete');
    expect(current.runs[0].backgroundAssetId).toBeUndefined();
    expect(current.assets.filter(asset=>asset.origin?.assetId===original.id&&asset.origin.version===copy.origin.version)).toHaveLength(1);
  });
}
