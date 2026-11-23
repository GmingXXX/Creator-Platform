import {test,expect} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const fixture=path.resolve('output/folder-intake-fixture/企业资料');
test.beforeAll(async()=>{await mkdir(path.join(fixture,'发展历程'),{recursive:true});await writeFile(path.join(fixture,'企业简介.txt'),'模拟企业：星澜智造');await writeFile(path.join(fixture,'发展历程','大事件.csv'),'年份,事件\n2024,储能中心投产');});
test.afterAll(async()=>{await rm(path.dirname(fixture),{recursive:true,force:true});});
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();});
test('附件菜单、文件夹目录、解析状态、持久化及纯附件入口',async({page})=>{
 await expect(page.locator('.composer-tools')).not.toContainText('Skills');await page.getByRole('button',{name:'上传文件',exact:true}).click();await expect(page.getByRole('button',{name:'添加文件夹',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'指定技能',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await page.getByLabel('添加文件夹',{exact:true}).setInputFiles(fixture);await expect(page.locator('.attachment-folder')).toContainText('2 个文件 · 2 个已解析');await page.locator('.attachment-folder>details>summary').click();await expect(page.locator('.attachment-folder')).toContainText('企业简介.txt');await page.locator('.attachment-tree summary').click();await expect(page.locator('.attachment-tree').first()).toContainText('大事件.csv');await page.screenshot({path:'output/folder-intake-browser.png'});
 await page.reload();await expect(page.locator('.attachment-folder')).toContainText('2 个文件');await page.locator('.attachment-folder>details>summary').click();await page.getByRole('button',{name:'移除 企业资料/企业简介.txt',exact:true}).click();await expect(page.locator('.attachment-folder')).toContainText('1 个文件');await page.getByRole('button',{name:'移除文件夹 企业资料',exact:true}).click();await expect(page.locator('.attachment-folder')).toHaveCount(0);
});
test('zip保持完整与文件格式失败提示',async({page})=>{
 await page.getByLabel('添加文件',{exact:true}).setInputFiles({name:'提纲.txt',mimeType:'text/plain',buffer:Buffer.from('三页企业简介大纲')});await expect(page.locator('.attachment-chip')).toContainText('已解析正文');
 const zip=new JSZip();zip.file('index.html','<!doctype html><title>演示</title>');zip.file('assets/app.js','window.demo = true');await page.getByLabel('添加文件',{exact:true}).setInputFiles({name:'组件.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});await expect(page.locator('.attachment-chip').filter({hasText:'组件.zip'})).toContainText('组件包');
 await page.getByLabel('添加文件',{exact:true}).setInputFiles({name:'错误.zip',mimeType:'application/zip',buffer:Buffer.from('bad zip')});await expect(page.getByRole('alert').filter({hasText:'错误.zip'})).toBeVisible();await expect(page.locator('.attachment-chip')).toHaveCount(2);
});
test('异步导入切换空间后仍归属原草稿且保留并发附件',async({page})=>{
 const draftId=await page.evaluate(()=>{
  const original=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.activeDraftId;
  const f=new File(['延迟文档正文'],'慢速.txt',{type:'text/plain'});const originalText=f.text.bind(f);
  const gate=new Promise<void>(resolve=>{(window as any).releaseAttachmentTest=resolve;});Object.defineProperty(f,'text',{value:async()=>{await gate;return originalText();}});
  const transfer=new DataTransfer();transfer.items.add(f);const input=document.querySelector('input[aria-label="添加文件"]') as HTMLInputElement;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return original;
 });
 await expect(page.getByRole('status').filter({hasText:'正在读取'})).toBeVisible();
 await page.getByRole('button',{name:'企业智能演示',exact:true}).click();await page.getByRole('button',{name:'添加示例资料',exact:true}).click();await expect(page.locator('.attachment-folder')).toHaveCount(1);
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();
 await page.evaluate(()=>{(window as any).releaseAttachmentTest();delete (window as any).releaseAttachmentTest;});
 await expect(page.getByRole('status').filter({hasText:'正在读取'})).toHaveCount(0);
 const saved=await page.evaluate((id)=>{const s=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;return{workspace:s.activeWorkspaceId,active:s.drafts.find((d:any)=>d.id===s.activeDraftId)?.attachmentIds,original:s.drafts.find((d:any)=>d.id===id)?.attachmentIds,uploaded:s.assets.find((a:any)=>a.name==='慢速.txt'),example:s.assets.find((a:any)=>a.name==='星澜智造_智能演示大纲.pptx')};},draftId);
 expect(saved.workspace).toBe('xintai');expect(saved.original).toContain(saved.uploaded?.id);expect(saved.original).toContain(saved.example?.id);expect(saved.active).not.toContain(saved.uploaded?.id);expect(saved.uploaded?.workspaceId).toBe('personal');
});

test('递归拖入目录保留路径并适配窄屏',async({page})=>{
 await page.locator('.composer').evaluate(element=>{
  const leaf={name:'脚本.txt',isFile:true,isDirectory:false,file:(done:(file:File)=>void)=>done(new File(['体验流程：入场、选择、结局'],'脚本.txt',{type:'text/plain'}))};
  const directory={name:'互动故事',isFile:false,isDirectory:true,createReader:()=>{let read=false;return{readEntries:(done:(items:unknown[])=>void)=>{done(read?[]:[leaf]);read=true;}}}};
  const event=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{items:[{webkitGetAsEntry:()=>directory}],files:[]}});element.dispatchEvent(event);
 });
 await expect(page.locator('.attachment-folder')).toContainText('互动故事');await page.locator('.attachment-folder summary').first().click();await expect(page.getByRole('button',{name:'移除 互动故事/脚本.txt',exact:true})).toBeVisible();
 await page.setViewportSize({width:1024,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
