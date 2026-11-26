import { expect, test, type Page } from '@playwright/test';
import type { StudioData } from '../../src/domain/types';

const sessionId = 'chat-contextual-timeline';
const runId = 'run-contextual-timeline';
const title = '星澜智造荣誉与案例时间廊';
const pageName = '历年荣誉与突破';
const backgroundUrl = '/api/ai/media/timeline-background.png';

async function studio(page: Page): Promise<StudioData> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
}

async function openCompletedTimeline(page: Page) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: '填入', exact: true }).click();
  await page.getByRole('button', { name: '进入工作台' }).click();
  await expect(page.getByRole('textbox', { name: '创作需求' })).toBeVisible();

  const workId = await page.evaluate(({ sessionId, runId, title, pageName }) => {
    const storageKey = 'zhichuang-studio-v1';
    const record = JSON.parse(localStorage.getItem(storageKey)!);
    const state: StudioData = record.state;
    const seed = state.works.find(w => w.type === '时间演进型' && w.kind === 'exhibit')!;
    const workspaceId = state.activeWorkspaceId;
    const work = { ...seed, workspaceId, title, pages: seed.pages.map(p => ({ ...p, name: pageName })) };
    const draft = { ...state.drafts[0], workspaceId, text: '帮我把公司资料做成一个可演示的展项', model: 'deepseek-flash' };
    const run = {
      id: runId, workspaceId, workId: work.id, creationPluginId: 'exhibit' as const,
      outputKind: 'exhibit' as const, status: 'complete' as const, step: 5,
      prompt: draft.text, model: draft.model, styleId: work.styleId,
      skillIds: [], attachmentIds: [], createdAt: new Date().toISOString(),
    };
    const session = {
      id: sessionId, workspaceId, prepared: true, runId, draft,
      messages: [{ id: 'original-request', role: 'user' as const, text: draft.text }],
    };
    localStorage.setItem(storageKey, JSON.stringify({ ...record, state: {
      ...state, works: state.works.map(w => w.id === work.id ? work : w),
      runs: [run, ...state.runs], creationSessions: [session, ...(state.creationSessions || [])],
    } }));
    return work.id;
  }, { sessionId, runId, title, pageName });
  await page.reload();
  await page.goto('/#/create/' + sessionId);
  await expect(page.getByRole('textbox', { name: '修改当前作品' })).toBeVisible();
  return workId;
}

test('完成时间轴后继续对话生成背景，保留展项并在采用时只替换页面背景', async ({ page }) => {
  const submissions: { prompt: string; size: string }[] = [];
  await page.route('**/api/ai/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/ai/config') return route.fulfill({ json: {
      models: [{ id: 'deepseek-flash', label: 'DeepSeek Flash' }], configured: { deepseek: true, image: true },
    } });
    if (path === backgroundUrl) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="teal"/></svg>' });
    if (path === '/api/ai/images' && route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON());
      return route.fulfill({ json: { id: 'timeline-background', status: 'succeeded', url: backgroundUrl } });
    }
    if (path === '/api/ai/images/timeline-background') return route.fulfill({ json: {
      id: 'timeline-background', status: 'succeeded', url: backgroundUrl,
    } });
    return route.fulfill({ status: 400, json: { error: '当前用例只生成背景素材' } });
  });
  const workId = await openCompletedTimeline(page);
  const before = await studio(page);
  const original = before.works.find(w => w.id === workId)!;
  const timeline = original.pages[0].nodes.find(n => n.type === 'timeline')!;
  expect(timeline.items?.length).toBeGreaterThan(0);
  expect(timeline.interactions?.length).toBeGreaterThan(0);

  await page.getByRole('textbox', { name: '修改当前作品' }).fill('生成一张背景图素材');
  await page.getByRole('button', { name: '发送修改' }).click();
  await expect.poll(() => submissions.length, { timeout: 8000 }).toBe(1);
  expect(submissions[0].prompt).toContain(title);
  expect(submissions[0].prompt).toContain(pageName);
  expect(submissions[0].size).toBe(original.width + '*' + original.height);
  await expect(page.getByRole('button', { name: '采用这张背景' })).toBeVisible();
  const candidate = page.getByLabel('完整展项预览').filter({ has: page.locator('.scene-renderer[style*="timeline-background.png"]') });
  await expect(candidate).toBeVisible();
  await expect(candidate).toContainText(timeline.items![0].title);
  const preview = await studio(page);
  expect(preview.creationSessions?.find(s => s.id === sessionId)?.runId).toBe(runId);
  expect(preview.runs.map(r => r.id)).toEqual(before.runs.map(r => r.id));
  expect(preview.works.find(w => w.id === workId)?.pages).toEqual(original.pages);

  await page.getByRole('button', { name: '查看原背景' }).click();
  await expect(candidate).toHaveCount(0);
  await page.getByRole('button', { name: '预览新背景' }).click();
  await expect(candidate).toBeVisible();
  await page.getByRole('button', { name: '采用这张背景' }).click();
  await expect.poll(async () => (await studio(page)).works.find(w => w.id === workId)?.pages[0].backgroundImage).toBe(backgroundUrl);
  const adopted = (await studio(page)).works.find(w => w.id === workId)!;
  expect(adopted.pages[0].nodes).toEqual(original.pages[0].nodes);
  expect(adopted.pages[0].interactions).toEqual(original.pages[0].interactions);
  expect(adopted.pages.slice(1)).toEqual(original.pages.slice(1));
  await expect(page).toHaveURL(new RegExp('/create/' + sessionId + '$'));
});
