import {openSpaceSettings} from './workspace-settings-helpers';
import {test,expect,type Page} from '@playwright/test';
const readState=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function members(page:Page){await openSpaceSettings(page,'成员与权限');}
test('查看者预览作品、阻止直接编辑及共享上传，个人素材仍可上传；编辑者可继续创作',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();await page.goto('/#/projects');
 await page.getByRole('button',{name:'新建作品',exact:true}).first().click();await page.getByRole('dialog').getByRole('button',{name:'交互页面',exact:true}).click();await page.getByRole('button',{name:/从空白画布新建/}).click();await page.getByLabel('作品名称',{exact:true}).fill('成员权限预览验收');await page.getByRole('button',{name:'创建作品',exact:true}).click();await expect(page).toHaveURL(/editor\//);
 const work=(await readState(page)).works.find((w:any)=>w.title==='成员权限预览验收');
 await page.goto('/#/projects');await members(page);const dialog=page.getByRole('dialog');await dialog.getByLabel('账号或邮箱',{exact:true}).fill('viewer@example.com');await dialog.getByLabel('邀请权限').selectOption('viewer');await dialog.getByRole('button',{name:'邀请成员',exact:true}).click();await dialog.getByRole('button',{name:'模拟viewer@example.com接受邀请',exact:true}).click();await dialog.getByText('本地权限体验',{exact:true}).click();await dialog.getByLabel('体验成员身份').selectOption({label:'viewer@example.com · 查看者'});await dialog.getByRole('button',{name:'完成',exact:true}).click();
 await page.locator('.res-project-card').filter({hasText:'成员权限预览验收'}).locator('h3').click();await expect(page).toHaveURL(new RegExp(`preview/${work.id}`));await expect(page.getByRole('button',{name:'编辑展项',exact:true})).toBeDisabled();await page.getByRole('button',{name:'返回',exact:true}).click();await expect(page).toHaveURL(/#\/projects$/);
 await page.goto(`/#/editor/${work.id}`);await expect(page).toHaveURL(new RegExp(`preview/${work.id}`));
 await page.goto('/#/library?type=document&scope=shared');await expect(page.getByRole('button',{name:'上传文档',exact:true}).first()).toBeDisabled();await expect(page.locator('.res-page > input[type=file]')).toBeDisabled();
 await page.goto('/#/library?type=document&scope=mine');await expect(page.getByRole('button',{name:'上传文档',exact:true}).first()).toBeEnabled();await page.locator('.res-page > input[type=file]').setInputFiles({name:'查看者个人资料.txt',mimeType:'text/plain',buffer:Buffer.from('仍属于个人的资料')});await expect(page.getByText('已添加',{exact:true})).toBeVisible();expect((await readState(page)).assets.find((a:any)=>a.name==='查看者个人资料.txt').workspaceId).toBe('personal');await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.getByRole('button',{name:'退出权限体验',exact:true}).click();await members(page);await dialog.getByLabel('viewer@example.com的权限').selectOption('editor');await dialog.getByText('本地权限体验',{exact:true}).click();await dialog.getByLabel('体验成员身份').selectOption({label:'viewer@example.com · 编辑者'});await dialog.getByRole('button',{name:'完成',exact:true}).click();await page.goto(`/#/editor/${work.id}`);await expect(page).toHaveURL(new RegExp(`editor/${work.id}`));await expect(page.getByRole('button',{name:'保存',exact:true})).toBeEnabled();
});
async function seedStoppedTask(page:Page,viewer:boolean){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
 await page.evaluate(viewer=>{const key='zhichuang-studio-v1',saved=JSON.parse(localStorage.getItem(key)!);saved.state.runs=[{id:'space-route-task',workspaceId:viewer?'xintai':'personal',prompt:'保留的旧任务',model:'demo',styleId:'none',skillIds:[],attachmentIds:[],status:'stopped',step:0,outputKind:'exhibit',createdAt:new Date().toISOString()}];if(viewer){saved.state.workspaceMembers.xintai.push({id:'route-viewer',name:'测试查看者',account:'route-viewer',role:'viewer',status:'member'});saved.state.workspaceActors.xintai='route-viewer';}localStorage.setItem(key,JSON.stringify(saved));},viewer);
 await page.reload();await page.goto('/#/create/space-route-task');
}
test('旧任务按实际归属校验权限，个人空间身份不能绕过项目只读',async({page})=>{
 await seedStoppedTask(page,true);await expect(page.getByRole('button',{name:'切换创作空间'})).toContainText('信泰企业展厅');await expect(page.getByText('当前空间为只读',{exact:true})).toBeVisible();await expect(page.getByText('保留的旧任务',{exact:true})).toHaveCount(0);
});
test('从旧任务新建空间后退出旧任务，进入新空间继续创作',async({page})=>{
 await seedStoppedTask(page,false);await expect(page.getByText('保留的旧任务',{exact:true})).toBeVisible();await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'新建项目空间',exact:true}).click();await page.getByLabel('空间名称',{exact:true}).fill('旧任务之外的新空间');await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.getByRole('button',{name:'先开始创作',exact:true}).click();await expect(page).toHaveURL(/#\/$/);await expect(page.getByRole('button',{name:'切换创作空间'})).toContainText('旧任务之外的新空间');await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toHaveValue('');
});
