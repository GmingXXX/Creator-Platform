import {reloadAndReopen} from './reload-helpers';
import {useDemoModel} from './home-helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

const errors = new WeakMap<Page, string[]>();
async function saveScreenshot(page: Page, name: string) {
  await mkdir('output/验收截图', { recursive: true });
  await page.screenshot({ path: `output/验收截图/studios-${name}.png`, fullPage: true, animations: 'disabled' });
}
async function open(page: Page, route: string) {
  await page.goto(`/#${route}`);
}
async function storyStart(page: Page) {
  await page.getByRole('button', { name: '开始探索', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).first().click();
}

test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)?.push(error.message));
  await open(page, '/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await page.waitForURL('**/#/');
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), 'No uncaught browser errors').toEqual([]);
});

test('演示编辑保存刷新，讲解追问后继续', async ({ page }) => {
  const speechTexts:string[]=[],questionInputs:string[]=[];
  await page.route('**/api/ai/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/ai/config')return route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,speech:true}}});
    if(path==='/api/ai/speech'){speechTexts.push(route.request().postDataJSON().text);return route.fulfill({json:{url:'/api/ai/speech/test.wav'}});}
    if(path==='/api/ai/speech/test.wav')return route.fulfill({path:'public/media/narration.wav',contentType:'audio/wav'});
    if(path==='/api/ai/chat'){questionInputs.push(JSON.stringify(route.request().postDataJSON()));return route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({answer:'本页介绍企业如何连接技术、内容与未来。',sourcePages:[1]})}});}
    return route.fulfill({status:503,json:{error:'测试阻止未配置的 AI 请求'}});
  });
  await open(page, '/presentations');
  await expect(page).toHaveURL(/#\/projects\?category=presentation-video$/);
  await expect(page.getByRole('heading', { name: '我的作品', exact: true })).toBeVisible();
  await saveScreenshot(page, '01-hub');
  await open(page, '/presentations/work-4');
  await expect(page.locator('.slide-thumbnails>button')).toHaveCount(8);
  await page.locator('.slide-edit-stage .slide-element').first().click();
  await page.getByLabel('文字内容', { exact: true }).fill('企业创新成果 · 验收修改');
  await page.getByLabel('本页讲稿').fill('欢迎来到创新展厅。这一页讲解企业如何连接技术、内容与未来。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await reloadAndReopen(page);
  await page.locator('.slide-edit-stage .slide-element').first().click();
  await expect(page.getByLabel('文字内容', { exact: true })).toHaveValue('企业创新成果 · 验收修改');
  await expect(page.getByLabel('本页讲稿')).toHaveValue('欢迎来到创新展厅。这一页讲解企业如何连接技术、内容与未来。');
  await saveScreenshot(page, '02-presentation-editor');
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await page.getByRole('button', { name: '开始讲解', exact: true }).click();
  await expect(page.locator('.player-caption')).toBeVisible();
  await expect(page.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible();
  expect(speechTexts[0]).toBe('欢迎来到创新展厅。');
  await page.getByRole('button', { name: '提问', exact: true }).click();
  await page.getByRole('button', { name: '这一页的核心观点是什么？', exact: true }).click();
  await expect(page.locator('.player-answer')).toContainText('企业如何连接技术、内容与未来');
  expect(questionInputs).toHaveLength(1);expect(questionInputs[0]).toContain('企业创新成果 · 验收修改');expect(questionInputs[0]).toContain('这一页的核心观点是什么？');
  await page.getByRole('button', { name: '继续讲解', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '暂停讲解', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '结束演示' }).click();
});

test('视频分镜新增排序持久化，工程下载包含用户修改', async ({ page }) => {
  await open(page, '/video/work-5');
  await page.getByLabel('画面时长（秒）').fill('11');
  await page.getByRole('button', { name: '添加分镜', exact: true }).last().click();
  await page.getByLabel('分镜标题', { exact: true }).fill('新增可编辑分镜');
  await page.getByRole('button', { name: '前移', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await reloadAndReopen(page);
  await expect(page.locator('.video-shot-list>button')).toHaveCount(5);
  await saveScreenshot(page, '03-video-editor');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: '视频工程（JSON）', exact: true }).click();
  const download = await downloading;
  const json = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(json.shots[0].duration).toBe(11);
  expect(json.shots[3].title).toBe('新增可编辑分镜');
  expect(json.renderStatus).toBe('not-rendered');
  expect(json).not.toHaveProperty('sample');
  await page.getByRole('button', { name: '预览分镜' }).click();
  await expect(page.locator('.video-sequence-preview')).toBeVisible();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续播放', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭对话框' }).click();
});

test('故事两种结局、真实拖拽连线、条件分支与校验', async ({ page }) => {
  await open(page, '/dream');
  await expect(page).toHaveURL(/#\/projects\?category=interactive-film$/);
  await expect(page.getByRole('heading', { name: '我的作品', exact: true })).toBeVisible();
  await saveScreenshot(page, '04-dream-hub');
  await open(page, '/dream/work-6');
  await expect(page.locator('.story-node')).toHaveCount(5);
  await page.getByRole('button', { name: '检查流程', exact: true }).click();
  await expect(page.locator('.story-validation-panel')).toContainText('流程检查通过');
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await saveScreenshot(page, '05-story-editor');
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await storyStart(page);
  await page.getByRole('button', { name: '绿色材料', exact: true }).click();
  await expect(page.locator('.story-preview-body h2')).toHaveText('绿色未来');
  await page.getByRole('button', { name: '体验另一种结局', exact: true }).click();
  await storyStart(page);
  await page.getByRole('button', { name: '数字制造', exact: true }).click();
  await expect(page.locator('.story-preview-body h2')).toHaveText('智造先锋');
  await saveScreenshot(page, '06-story-ending');
  await page.getByRole('button', { name: '关闭对话框' }).click();
  await page.locator('.story-node-copy>b').filter({ hasText: '发现未来工厂' }).click();
  await page.getByLabel('节点名称', { exact: true }).fill('可持久保存的场景');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await reloadAndReopen(page);
  await expect(page.locator('.story-node-copy>b').filter({ hasText: '可持久保存的场景' })).toBeVisible();
  const storedX = () => page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w: { id: string }) => w.id === 'work-6').storyNodes.find((n: { id: string }) => n.id === 'scene').x);
  const beforeDrag = await storedX();
  const node = (await page.locator('.react-flow__node[data-id="scene"]').boundingBox())!;
  await page.mouse.move(node.x + 50, node.y + 15);
  await page.mouse.down();
  await page.mouse.move(node.x + 95, node.y + 45, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  expect(await storedX()).not.toBe(beforeDrag);
  const from = (await page.locator('.react-flow__node[data-id="scene"] .react-flow__handle-right').boundingBox())!;
  const to = (await page.locator('.react-flow__node[data-id="green"] .react-flow__handle-left').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('绿色材料', { exact: true }).locator('..').click();
  await page.locator('.story-event-fields summary').filter({hasText:'生效条件'}).click();
  await page.getByLabel('生效条件', { exact: true }).selectOption('visited');
  await page.getByLabel('判断哪一幕', { exact: true }).selectOption('scene');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await storyStart(page);
  await expect(page.getByRole('button', { name: /绿色材料/ })).toBeEnabled();
  await expect(page.locator('.story-preview-config select')).toHaveCount(0);
  await page.getByRole('button', { name: '绿色材料', exact: true }).click();
  await expect(page.locator('.story-preview-body h2')).toHaveText('绿色未来');
  await page.getByRole('button', { name: '关闭对话框' }).click();
  await page.getByRole('button', { name: '普通节点',exact:true }).click();
  await expect(page.locator('.story-node')).toHaveCount(6);
  await page.getByRole('button', { name: '检查流程', exact: true }).click();
  await expect(page.locator('.story-validation-panel')).toContainText('未连接');
  await page.getByRole('button', { name: '删除节点', exact: true }).click();
  await expect(page.locator('.story-node')).toHaveCount(5);
  await expect(page.locator('.story-validation-panel')).toContainText('流程检查通过');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(async () => {
    const lastNode = await page.locator('.react-flow__node[data-id="green"]').boundingBox();
    const inspector = await page.locator('.studio-inspector').boundingBox();
    return lastNode!.x + lastNode!.width < inspector!.x;
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await saveScreenshot(page, '07-story-1280');
});

test('上传资料编辑大纲，统一入口生成可编辑智能演示', async ({ page }) => {
  await open(page, '/presentations');
  await page.locator('.sidebar').getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('dialog').getByRole('button',{name:'智能演示',exact:true}).click();
  await page.getByLabel('你想讲述什么？', { exact: true }).fill('政务服务创新中心接待讲解');
  await page.getByRole('button', { name: '选择设计风格', exact: true }).click();
  const styles = page.getByRole('dialog', { name: '选择设计风格' });
  await styles.locator('.presentation-style-choices > button').filter({ hasText: '政务风' }).click();
  await styles.getByRole('button', { name: '使用此风格' }).click();
  await expect(page.getByRole('button', { name: '选择设计风格' })).toContainText('政务风');
  await page.getByRole('dialog',{name:'新建智能演示'}).locator('input[type=file]').first().setInputFiles({ name: '参考资料.txt', mimeType: 'text/plain', buffer: Buffer.from('政务服务创新中心，提供一站式公共服务。') });
  await expect(page.locator('.creation-source-file')).toContainText('参考资料.txt');
  await page.getByLabel('生成模型',{exact:true}).selectOption('demo');
  await page.getByLabel(/建议页数|建议分镜数量/).selectOption('8');
  await page.getByRole('button', { name: /^(生成大纲|生成分镜)$/, exact: true }).click();
  await page.getByRole('button',{name:'展开全部',exact:true}).click();await page.getByRole('button', { name: '删除第8页', exact: true }).click();
  await page.getByLabel('第2页标题', { exact: true }).fill('以群众需求为中心');
  await saveScreenshot(page, '08-outline');
  await page.getByRole('button', { name: '开始生成', exact: true }).click();
  await expect(page.locator('.slide-thumbnails>button')).toHaveCount(7);
  await expect(page.locator('.slide-thumbnails')).toContainText('以群众需求为中心');
  await saveScreenshot(page, '09-created-presentation');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.locator('.sidebar').getByRole('button',{name:'新建作品',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'智能演示',exact:true}).click();
  await expect(page.getByRole('button',{name:'视频创作',exact:true})).toHaveCount(0);
  await page.getByLabel('你想讲述什么？', { exact: true }).fill('城市未来发展宣传片');
  await page.getByLabel('生成模型',{exact:true}).selectOption('demo');
  await page.getByLabel(/建议页数|建议分镜数量/).selectOption('8');
  await page.getByRole('button', { name: /^(生成大纲|生成分镜)$/, exact: true }).click();
  await page.getByRole('button', { name: '开始生成', exact: true }).click();
  await expect(page.locator('.slide-thumbnails>button')).toHaveCount(8);
});

test('空白故事缺少结局时阻止试运行', async ({ page }) => {
  await open(page, '/dream');
  await page.locator('.sidebar').getByRole('button',{name:'新建作品',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'互动影片',exact:true}).click();
  await page.getByLabel('作品名称', { exact: true }).fill('空白创作验收');
  await page.getByRole('button', { name: '进入空白画布', exact: true }).click();
  await expect(page.locator('.story-node')).toHaveCount(0);
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(page.locator('.story-validation-panel')).toContainText('请添加至少一个结局节点');
  await expect(page.locator('.story-preview-scene')).toHaveCount(0);
});


test('创作入口与成果归属清晰，全部作品保存在作品库', async ({ page }) => {
  await expect(page.locator('.sidebar-nav').getByRole('link', { name: '素材库', exact: true })).toBeVisible();
  await expect(page.locator('.sidebar-nav .nav-dot')).toHaveCount(0);
  await open(page, '/projects');
  await expect(page.locator('.res-project-card')).toHaveCount(6);
  await expect(page.locator('.res-project-card').filter({ hasText: '企业创新成果讲解' })).toBeVisible();
  await expect(page.locator('.res-project-card').filter({ hasText: '面向未来 · 品牌短片' })).toBeVisible();
  await expect(page.getByRole('button', { name: '打开未来工厂探索之旅', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '未来工厂探索之旅更多操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '预览作品', exact: true }).click();
  await expect(page).toHaveURL(/preview\/work-6/);
  await storyStart(page);
  await page.getByRole('button', { name: '绿色材料', exact: true }).click();
  await expect(page.locator('.story-preview-body h2')).toHaveText('绿色未来');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '打开未来工厂探索之旅', exact: true }).click();
  await expect(page).toHaveURL(/dream\/work-6/);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page).toHaveURL(/#\/projects/);
  await open(page, '/presentations');
  await expect(page.getByRole('button', { name: '查看素材库', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/projects\?category=presentation-video$/);
  await expect(page.getByRole('button',{name:'打开企业创新成果讲解',exact:true})).toBeVisible();
  await page.locator('.sidebar-search').click();
  await page.getByPlaceholder('搜索作品、素材、Skills 或设计风格…').fill('企业创新成果讲解');
  const results = page.getByRole('listbox', { name: '搜索结果' });
  await expect(results.getByRole('option')).toHaveCount(1);
  await results.getByRole('option', { name: '企业创新成果讲解 作品', exact: true }).click();
  await expect(page).toHaveURL(/#\/presentations\/work-4$/);
});

test('首页视频成果展示当前分镜，保存为可继续编辑的项目', async ({ page }) => {
  await page.getByRole('textbox', { name: '创作需求' }).fill('制作一段金融论坛开场短片，包含可调整的分镜与讲解文案');
  await useDemoModel(page); await page.getByRole('button', {name:'发送创作需求'}).click();
  await expect(page.getByRole('button', { name: '前往作品库', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.completion-note')).toContainText('已保存到作品库');
  await expect(page.locator('.artifact-preview').getByTestId('video-material-preview')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '修改当前作品' })).toBeEditable();
  const sourceId = await page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.runs[0].workId);
  await page.getByRole('button', { name: '前往作品库', exact: true }).click();
  const generatedTitle = await page.evaluate((id) => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((work: { id: string }) => work.id === id).title, sourceId);
  await page.getByRole('button', { name: `打开${generatedTitle}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`video/${sourceId}`));
  await expect(page.locator('.video-shot-list>button')).not.toHaveCount(0);
});

for (const scenario of [
  { route: '/presentations/work-4', titleField: '演示名称', target: '返回', workId: 'work-4', title: '跨空间演示修改' },
  { route: '/video/work-5', titleField: '作品名称', target: '查看作品', workId: 'work-5', title: '跨空间视频修改' },
  { route: '/dream/work-6', titleField: '作品名称', target: '返回', workId: 'work-6', title: '跨空间互动影片修改' },
]) {
  test(`跨空间深链接返回成果时保留原工程：${scenario.workId}`, async ({ page }) => {
    await page.getByRole('button', { name: '切换创作空间', exact: true }).click();
    await page.getByRole('menuitem', { name: '信泰企业展厅', exact: true }).click();
    await open(page, scenario.route);
    const titleArea = scenario.workId === 'work-4' ? page.getByRole('banner') : page;
    await titleArea.getByLabel(scenario.titleField, { exact: true }).fill(scenario.title);
    await page.getByRole('button', { name: scenario.target, exact: true }).click();
    await expect(page.locator('.workspace-switch')).toContainText('个人空间');
    if (scenario.target === '返回') {
      await expect(page).toHaveURL(/#\/$/);
      await page.getByRole('link', { name: '作品', exact: true }).click();
    }
    await expect(page).toHaveURL(/#\/projects/);
    await expect(page.getByRole('button', { name: `打开${scenario.title}`, exact: true })).toBeVisible();
    const saved = await page.evaluate((id) => {
      const state = JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;
      return { workspaceId: state.activeWorkspaceId, work: state.works.find((item: { id: string }) => item.id === id) };
    }, scenario.workId);
    expect(saved.workspaceId).toBe('personal');
    expect(saved.work.workspaceId).toBe('personal');
    expect(saved.work.title).toBe(scenario.title);
  });
}

test('历史视频预览链接展示实际分镜，编辑时回到成果原空间', async ({ page }) => {
  await page.getByRole('button', { name: '切换创作空间', exact: true }).click();
  await page.getByRole('menuitem', { name: '信泰企业展厅', exact: true }).click();
  await open(page, '/preview/work-5');
  await expect(page.getByTestId('video-material-preview')).toBeVisible();
  await expect(page.locator('.res-material-note')).toContainText('完整视频尚未合成');
  await expect(page.getByLabel('预览语音口令')).toHaveCount(0);
  await page.getByRole('button', { name: '编辑视频工程', exact: true }).click();
  await expect(page).toHaveURL(/video\/work-5/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.activeWorkspaceId)).toBe('personal');
  await page.getByRole('button', { name: '查看作品', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开面向未来 · 品牌短片', exact: true })).toBeVisible();
});
