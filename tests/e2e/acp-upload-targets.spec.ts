import {openSpaceSettings} from './workspace-settings-helpers';
import {test,expect,type Page} from '@playwright/test';

const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const file=(name:string)=>({name,mimeType:'text/plain',buffer:Buffer.from('客户企业资料：1998年成立，2020年建设智能工厂。')});
async function switchSpace(page:Page,name:string){await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
async function bind(page:Page,id:string,name:string){
 await openSpaceSettings(page,'知识本地场');
 const dialog=page.getByRole('dialog',{name:'管理项目空间',exact:true});await dialog.getByLabel('知识本地场名称',{exact:true}).fill(name);await dialog.getByLabel('知识本地场id',{exact:true}).fill(id);await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await expect(dialog).toContainText('已保存绑定配置');await dialog.getByRole('button',{name:'完成',exact:true}).click();
}
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();});

test('对话附件记录上传时目标，改绑和切换空间不改写历史文件',async({page})=>{
 await switchSpace(page,'信泰企业展厅');await bind(page,'field-xintai-a','信泰资料一');await expect(page.getByRole('button',{name:'查看知识本地场绑定'})).toContainText('信泰资料一');
 await page.getByLabel('添加文件',{exact:true}).setInputFiles(file('改绑前资料.txt'));
 await expect.poll(async()=>(await state(page)).assets.find((a:any)=>a.name==='改绑前资料.txt')?.knowledgeTarget).toMatchObject({workspaceId:'xintai',fieldId:'field-xintai-a',state:'not-connected'});
 await bind(page,'field-xintai-b','信泰资料二');await page.getByLabel('添加文件',{exact:true}).setInputFiles(file('改绑后资料.txt'));
 await expect.poll(async()=>(await state(page)).assets.find((a:any)=>a.name==='改绑后资料.txt')?.knowledgeTarget.fieldId).toBe('field-xintai-b');
 expect((await state(page)).assets.find((a:any)=>a.name==='改绑前资料.txt').knowledgeTarget.fieldId).toBe('field-xintai-a');
 await switchSpace(page,'东莞博物馆');await page.getByLabel('添加文件',{exact:true}).setInputFiles(file('未绑定资料.txt'));
 await expect.poll(async()=>(await state(page)).assets.find((a:any)=>a.name==='未绑定资料.txt')?.knowledgeTarget).toEqual({workspaceId:'dongguan',state:'unbound'});
});

test('个人库与空间共享上传分别记录归属，明确ACP未连接',async({page})=>{
 await switchSpace(page,'信泰企业展厅');await bind(page,'field-shared','信泰共享知识');
 for(const shared of [false,true]){
  await page.goto(`/#/library?type=document${shared?'&scope=shared':'&scope=mine'}`);await page.getByRole('button',{name:'上传文档',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'上传文档',exact:true});
  await expect(dialog).toContainText(shared?'ACP目标：信泰共享知识':'个人资料，不关联项目空间知识本地场');if(shared)await expect(dialog).toContainText('尚未提交ACP');
  const name=shared?'共享资料.txt':'个人资料.txt';await page.locator('.res-page > input[type=file]').setInputFiles(file(name));await expect(dialog.getByText('已添加',{exact:true})).toBeVisible();
  expect((await state(page)).assets.find((a:any)=>a.name===name).knowledgeTarget).toMatchObject(shared?{workspaceId:'xintai',fieldId:'field-shared',state:'not-connected'}:{workspaceId:'personal',state:'personal'});
  if(shared)await page.screenshot({path:'output/acp-shared-upload.png',animations:'disabled'});await dialog.getByRole('button',{name:'完成',exact:true}).click();
 }
});

test('智能演示参考资料使用所属项目绑定并展示上传时归属',async({page})=>{
 await switchSpace(page,'信泰企业展厅');await bind(page,'field-deck','信泰演示知识');
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();const dialog=page.getByRole('dialog',{name:'新建智能演示',exact:true});
 await dialog.locator('input[type=file]').first().setInputFiles(file('演示大纲.txt'));await expect(dialog.locator('.creation-source-file')).toContainText('已解析文字');
 await expect(dialog.getByTestId('knowledge-target-notice')).toContainText('上传时归属：信泰企业展厅');await expect(dialog).toContainText('ACP目标：信泰演示知识');
 expect((await state(page)).assets.find((a:any)=>a.name==='演示大纲.txt')).toMatchObject({workspaceId:'xintai',knowledgeTarget:{workspaceId:'xintai',fieldId:'field-deck',state:'not-connected'}});
});
