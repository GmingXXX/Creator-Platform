import {reloadAndReopen} from './reload-helpers';
import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import type { StudioData } from '../../src/domain/types';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE0cAAAAASUVORK5CYII=', 'base64');
async function makePackage() {
 const zip = new JSZip();
 zip.file('timeline/SKILL.md', '---\nname: exhibit-timeline\ndescription: 将项目资料编排为可编辑展项\nmetadata:\n  version: "2.1"\n---\n# ZIP 展项编排技能\n\n## 输入\n作品名称与发展节点\n\n## 步骤\n1. 整理已确认资料\n2. 编排时间轴');
 zip.file('timeline/references/rules.md', '# 排版规则\n保留来源');
 zip.file('timeline/assets/preview.png', png);
 zip.file('timeline/scripts/helper.js', 'window.skillArchiveMustNotExecute = true;');
 return zip.generateAsync({ type: 'nodebuffer' });
}

test.beforeEach(async ({ page }) => {
 await page.goto('/#/login');
 await page.getByLabel('账号', { exact: true }).fill('jiming');
 await page.getByLabel('密码', { exact: true }).fill('123456');
 await page.getByRole('button', { name: '进入工作台' }).click();
 await expect(page).toHaveURL(/#\/$/);
});

test('ZIP 技能：预览包内容、刷新后保留原包、原地启用保留原草稿', async ({ page }, testInfo) => {
 await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('保留原来的需求');
 await page.goto('/#/skills');
 await page.getByRole('button', { name: '上传技能', exact: true }).click();
 const original = await makePackage();
 await page.getByLabel('上传 ZIP 技能包').setInputFiles({ name: 'timeline.zip', mimeType: 'application/zip', buffer: original });
 const dialog = page.getByRole('dialog');
 await expect(dialog.getByText('格式检查通过')).toBeVisible();
 await expect(dialog.getByRole('heading', { name: 'ZIP 展项编排技能' })).toBeVisible();
 await expect(dialog.getByText('timeline/references/rules.md', { exact: true })).toBeVisible();
 await expect(dialog.getByRole('img', { name: 'ZIP 展项编排技能效果预览' })).toHaveAttribute('src', /^data:image\/png;base64,/);
 await expect(dialog.getByText('包含脚本依赖，已保留原文件；上传不会执行脚本。')).toBeVisible();
 await dialog.getByRole('button', { name: '添加技能', exact: true }).click();
 await expect(dialog).not.toBeVisible();
 await reloadAndReopen(page);
 await page.getByRole('button', { name: '查看ZIP 展项编排技能', exact: true }).click();
 await expect(page.getByRole('dialog').getByText('timeline/references/rules.md', { exact: true })).toBeVisible();
 const downloadPromise = page.waitForEvent('download');
 await page.getByRole('button', { name: '下载原始技能包' }).click();
 const download = await downloadPromise, target = testInfo.outputPath('original-skill.zip');
 await download.saveAs(target);
 expect(await readFile(target)).toEqual(original);
 expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).skillArchiveMustNotExecute)).toBeUndefined();
 await page.getByRole('dialog').getByRole('button',{name:'停用技能',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'启用技能',exact:true}).click();
 await expect(page).toHaveURL(/#\/skills$/);
 const state = await page.evaluate<StudioData>(() => JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
 const skill = state.skills.find(s => s.name === 'ZIP 展项编排技能')!;
 const draft = state.drafts.find(d => d.id === state.activeDraftId)!;
 expect(draft.text).toContain('保留原来的需求');
 expect(draft.text).toBe('保留原来的需求');
 expect(draft.skillIds).not.toContain(skill.id);
 expect(skill.enabled).toBe(true);
 expect(skill.sourcePackage?.storageKey).toBeTruthy();
 await page.screenshot({ path: testInfo.outputPath('skill-ready.png'), fullPage: true });
});

test('示例 ZIP 可以直接重新导入', async ({ page }, testInfo) => {
 await page.goto('/#/skills');
 await page.getByRole('button', { name: '上传技能', exact: true }).click();
 const downloadPromise = page.waitForEvent('download');
 await page.getByRole('button', { name: '下载示例 ZIP' }).click();
 const download = await downloadPromise, target = testInfo.outputPath(download.suggestedFilename());
 expect(download.suggestedFilename()).toMatch(/\.zip$/);
 await download.saveAs(target);
 await page.getByLabel('上传 ZIP 技能包').setInputFiles(target);
 await expect(page.getByRole('dialog').getByText('格式检查通过')).toBeVisible();
 await expect(page.getByRole('dialog').getByRole('heading', { name: '企业时间轴编排' })).toBeVisible();
});

test('不安全技能包被阻止，换一个合法包可继续导入', async ({ page }) => {
 await page.goto('/#/skills');
 await page.getByRole('button', { name: '上传技能', exact: true }).click();
 const unsafe = new JSZip();unsafe.file('SKILL.md', '# 技能\n用途描述');unsafe.file('../outside.txt', 'outside');
 await page.getByLabel('上传 ZIP 技能包').setInputFiles({ name: 'unsafe.zip', mimeType: 'application/zip', buffer: await unsafe.generateAsync({ type: 'nodebuffer' }) });
 await expect(page.getByRole('alert')).toContainText('不安全的文件路径');
 await expect(page.getByRole('dialog').getByRole('button', { name: '添加技能', exact: true })).toBeDisabled();
 await page.getByLabel('上传 ZIP 技能包').setInputFiles({ name: 'valid.zip', mimeType: 'application/zip', buffer: await makePackage() });
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByRole('dialog').getByRole('button', { name: '添加技能', exact: true })).toBeEnabled();
});
