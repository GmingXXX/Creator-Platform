import {openSpaceSettings} from './workspace-settings-helpers';
import {test,expect,type Page} from '@playwright/test';

async function switchSpace(page:Page,name:string){await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
async function knowledge(page:Page){await openSpaceSettings(page,'知识本地场');return page.getByRole('dialog',{name:'管理项目空间',exact:true});}
const readState=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();});

test('现有空间绑定知识本地场并刷新保留，明确尚未接通ACP',async({page})=>{
 await switchSpace(page,'信泰企业展厅');const dialog=await knowledge(page);await expect(dialog).toContainText('尚未绑定');await dialog.getByLabel('知识本地场名称',{exact:true}).fill('信泰知识本地场');await dialog.getByLabel('知识本地场id',{exact:true}).fill('acp-xintai-001');await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await expect(dialog).toContainText('已保存绑定配置');await expect(page.locator('[role=dialog]')).toHaveCount(1);await expect(dialog).toContainText('ACP未连接');await expect(dialog).toContainText('尚未提交到 ACP');
 await page.screenshot({path:'output/acp-knowledge-binding.png',animations:'disabled'});
 expect((await readState(page)).workspaceKnowledge.xintai).toMatchObject({fieldId:'acp-xintai-001',fieldName:'信泰知识本地场',status:'configured'});
 await dialog.getByRole('button',{name:'完成',exact:true}).click();await expect(page.locator('[role=dialog]')).toHaveCount(0);await page.reload();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();await knowledge(page);await expect(dialog.getByLabel('知识本地场id',{exact:true})).toHaveValue('acp-xintai-001');
 await dialog.getByRole('button',{name:'解除绑定',exact:true}).click();await expect(dialog).toContainText('不会迁移或删除');await dialog.getByRole('button',{name:'确认解除',exact:true}).click();await expect(dialog).toContainText('尚未绑定');expect((await readState(page)).workspaceKnowledge.xintai).toBeUndefined();
});

test('新建空间时可同时绑定，另一项目不能重复绑定同一标识',async({page})=>{
 await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'新建项目空间',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('空间名称',{exact:true}).fill('中铁共创项目');await dialog.getByText('绑定ACP知识本地场（可稍后设置）',{exact:true}).click();await dialog.getByLabel('知识本地场名称',{exact:true}).fill('中铁知识本地场');await dialog.getByLabel('知识本地场id',{exact:true}).fill('acp-rail-001');await page.screenshot({path:'output/acp-new-workspace-binding.png',animations:'disabled'});await dialog.getByRole('button',{name:'创建并进入',exact:true}).click();await expect(dialog).toContainText('空间已创建');await expect(dialog).toContainText('中铁知识本地场');await dialog.getByRole('button',{name:'先开始创作',exact:true}).click();let state=await readState(page);const space=state.workspaces.find((item:any)=>item.name==='中铁共创项目');expect(state.workspaceKnowledge[space.id].fieldId).toBe('acp-rail-001');
 await switchSpace(page,'东莞博物馆');dialog=await knowledge(page);await dialog.getByLabel('知识本地场名称',{exact:true}).fill('错误重复');await dialog.getByLabel('知识本地场id',{exact:true}).fill('acp-rail-001');await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();expect((await readState(page)).workspaceKnowledge.dongguan).toBeUndefined();
});

test('查看者只能查看绑定配置，绑定统一通过管理空间进入',async({page})=>{
 await page.getByRole('button',{name:'切换创作空间'}).click();await expect(page.getByRole('menuitem',{name:'知识本地场设置',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');await switchSpace(page,'东莞博物馆');let dialog=await knowledge(page);await dialog.getByLabel('知识本地场名称',{exact:true}).fill('东莞博物馆知识本地场');await dialog.getByLabel('知识本地场id',{exact:true}).fill('acp-museum-001');await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await dialog.getByRole('button',{name:'完成',exact:true}).click();
 await openSpaceSettings(page,'成员与权限');dialog=page.getByRole('dialog');await dialog.getByLabel('账号或邮箱',{exact:true}).fill('viewer');await dialog.getByLabel('邀请权限').selectOption('viewer');await dialog.getByRole('button',{name:'邀请成员',exact:true}).click();await dialog.getByRole('button',{name:'模拟viewer接受邀请',exact:true}).click();await dialog.getByText('本地权限体验',{exact:true}).click();await dialog.getByLabel('体验成员身份').selectOption({label:'viewer · 查看者'});await dialog.getByRole('button',{name:'完成',exact:true}).click();
 dialog=await knowledge(page);await expect(dialog).toContainText('东莞博物馆知识本地场');await expect(dialog).toContainText('只有空间负责人');await expect(dialog.getByRole('button',{name:'保存绑定配置',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'解除绑定',exact:true})).toHaveCount(0);await expect(dialog.getByLabel('知识本地场id',{exact:true})).toHaveCount(0);
});
