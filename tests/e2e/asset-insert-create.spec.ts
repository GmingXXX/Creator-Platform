import {test,expect,type Page} from '@playwright/test';
import type {StudioData} from '../../src/domain/types';
const saved=(page:Page):Promise<StudioData>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function setup(page:Page,empty=false,workspaceId='personal'){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(({empty,workspaceId})=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);if(empty)data.state.works=[];data.state.assets.push({id:'insert-test',name:'悬浮卡片组件',kind:'html',src:'/media/interactive.html',description:'',tags:[],author:'纪鸣',source:'uploaded',workspaceId:'personal',createdAt:new Date().toISOString()});localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));},{empty,workspaceId});
 await page.reload();await expect(page).toHaveURL(/#\/$/);if(workspaceId!=='personal'){await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();}await page.goto('/#/library?asset=insert-test');await page.getByRole('button',{name:'插入画布',exact:true}).click();
}
test('新建交互页面并插入，取消不创建，参数与组件刷新保留',async({page})=>{
 await setup(page);const before=await saved(page);const dialog=page.getByRole('dialog');
 await dialog.getByRole('tab',{name:'新建交互页面',exact:true}).click();
 await dialog.getByLabel('作品名称',{exact:true}).fill('组件体验项目');
 await dialog.getByLabel('屏幕分辨率',{exact:true}).selectOption('1080×1920');
 await dialog.getByRole('button',{name:'返回素材',exact:true}).click();expect((await saved(page)).works).toEqual(before.works);
 await dialog.getByRole('button',{name:'插入画布',exact:true}).click();
 await dialog.getByRole('tab',{name:'新建交互页面',exact:true}).click();
 await page.screenshot({path:'output/验收截图/asset-insert-new-project.png'});
 await dialog.getByRole('button',{name:'创建并插入画布',exact:true}).click();await expect(page).toHaveURL(/#\/editor\//);
 await expect(page.locator('.scene-board')).toBeVisible();await expect(page.locator('.scene-board iframe')).toBeVisible();
 const state=await saved(page),work=state.works[0];expect(state.works).toHaveLength(before.works.length+1);expect(work.title).toBe('组件体验项目');expect([work.width,work.height]).toEqual([1080,1920]);expect(work.workspaceId).toBe(state.activeWorkspaceId);expect(work.displayForm).toBeNull();expect(work.contentPurposes).toEqual([]);expect(work.pages[0].nodes).toHaveLength(1);expect(work.pages[0].nodes[0].assetId).toBe('insert-test');
 await page.reload();await expect(page).toHaveURL(/#\/$/);expect((await saved(page)).works.find(w=>w.id===work.id)).toEqual(work);
});
test('没有项目也可新建，自定义尺寸错误不产生空项目',async({page})=>{
 await setup(page,true);const dialog=page.getByRole('dialog');await dialog.getByRole('tab',{name:'新建交互页面',exact:true}).click();
 await dialog.getByLabel('屏幕分辨率',{exact:true}).selectOption('custom');await dialog.getByLabel('宽度 px',{exact:true}).fill('0');
 await dialog.getByRole('button',{name:'创建并插入画布',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('320');expect((await saved(page)).works).toHaveLength(0);
 await dialog.getByLabel('宽度 px',{exact:true}).fill('1600');await dialog.getByLabel('高度 px',{exact:true}).fill('900');await dialog.getByRole('button',{name:'创建并插入画布',exact:true}).click();await expect(page).toHaveURL(/#\/editor\//);const work=(await saved(page)).works[0];expect([work.width,work.height]).toEqual([1600,900]);expect(work.pages[0].nodes).toHaveLength(1);
});
test('已有作品插入仍保留原有内容，不创建额外项目',async({page})=>{
 await setup(page);const before=await saved(page),work=before.works.find(w=>w.kind==='exhibit'&&!w.deletedAt&&(w.workspaceId||'personal')===before.activeWorkspaceId)!;
 await page.getByLabel('目标展项',{exact:true}).selectOption(work.id);await page.getByRole('button',{name:'添加并打开画布',exact:true}).click();await expect(page).toHaveURL(new RegExp(work.id));const after=await saved(page),updated=after.works.find(w=>w.id===work.id)!;expect(after.works).toHaveLength(before.works.length);expect(updated.pages[0].nodes.slice(0,-1)).toEqual(work.pages[0].nodes);expect(updated.pages[0].nodes.at(-1)?.assetId).toBe('insert-test');
});

test('项目共创空间新建采用空间素材副本，个人原件保留',async({page})=>{
 await setup(page,false,'xintai');const before=await saved(page),original=before.assets.find(a=>a.id==='insert-test');const dialog=page.getByRole('dialog');
 await dialog.getByRole('tab',{name:'新建交互页面',exact:true}).click();await dialog.getByLabel('作品名称',{exact:true}).fill('   ');await dialog.getByRole('button',{name:'创建并插入画布',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('作品名称');expect((await saved(page)).works).toHaveLength(before.works.length);
 await dialog.getByLabel('作品名称',{exact:true}).fill('信泰组件体验');await dialog.getByRole('button',{name:'创建并插入画布',exact:true}).click();await expect(page).toHaveURL(/#\/editor\//);
 const after=await saved(page),work=after.works[0],asset=after.assets.find(a=>a.id===work.pages[0].nodes[0].assetId);expect(work.workspaceId).toBe('xintai');expect(asset?.workspaceId).toBe('xintai');expect(asset?.id).not.toBe(original?.id);expect(after.assets.find(a=>a.id==='insert-test')).toEqual(original);
});
