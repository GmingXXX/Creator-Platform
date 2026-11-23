import {test,expect,type Page} from '@playwright/test';
const data=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function manage(page:Page,id='xintai'){
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'成员与共享设置',exact:true})).toHaveCount(0);
 await page.getByRole('menuitem',{name:'管理空间',exact:true}).click();
 await page.getByTestId(`workspace-row-${id}`).getByRole('button',{name:'管理',exact:true}).click();
 return page.getByRole('dialog',{name:'管理项目空间',exact:true});
}
test.beforeEach(async({page})=>{
 await page.route('**/api/ai/**',r=>r.fulfill({json:{models:[],configured:{}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台',exact:true}).click();
});
test('统一管理可编辑非当前空间且名称与绑定刷新保留',async({page})=>{
 const dialog=await manage(page);
 await dialog.getByLabel('空间名称',{exact:true}).fill('信泰新展厅');
 await dialog.getByLabel('空间说明',{exact:true}).fill('统一管理测试');
 await dialog.getByRole('button',{name:'保存基本信息',exact:true}).click();
 await dialog.getByRole('tab',{name:'知识本地场',exact:true}).click();
 await dialog.getByLabel('知识本地场名称',{exact:true}).fill('信泰知识库');await dialog.getByLabel('知识本地场id',{exact:true}).fill('acp-settings-test');
 await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();
 let state=await data(page);expect(state.activeWorkspaceId).toBe('personal');expect(state.workspaceKnowledge.xintai.fieldId).toBe('acp-settings-test');
 await page.reload();await manage(page);await expect(dialog.getByLabel('空间名称',{exact:true})).toHaveValue('信泰新展厅');
 await dialog.getByRole('tab',{name:'知识本地场',exact:true}).click();await expect(dialog.getByLabel('知识本地场id',{exact:true})).toHaveValue('acp-settings-test');
 await page.screenshot({path:'output/workspace-settings-knowledge.png',animations:'disabled'});
});
test('统一成员页支持邀请和转让，权限随转让持久生效',async({page})=>{
 const dialog=await manage(page);await dialog.getByRole('tab',{name:'成员与权限',exact:true}).click();
 await dialog.getByLabel('账号或邮箱',{exact:true}).fill('nextowner');await dialog.getByRole('button',{name:'邀请成员',exact:true}).click();
 await dialog.getByRole('button',{name:'模拟nextowner接受邀请',exact:true}).click();
 await dialog.getByRole('button',{name:'转让负责人给nextowner',exact:true}).click();
 await dialog.getByRole('button',{name:'确认转让',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'邀请成员',exact:true})).toHaveCount(0);
 await dialog.getByRole('tab',{name:'基本信息',exact:true}).click();await expect(dialog.getByLabel('空间名称',{exact:true})).toBeDisabled();
 await page.reload();await manage(page);const state=await data(page);expect(state.workspaceMembers.xintai.find((m:any)=>m.id==='self').role).toBe('editor');expect(state.workspaceMembers.xintai.filter((m:any)=>m.role==='owner')).toHaveLength(1);
});
test('归档详情只读且个人空间不开放协作设置',async({page})=>{
 const dialog=await manage(page);
 await dialog.getByRole('button',{name:'归档',exact:true}).click();
 await expect(dialog.getByLabel('空间名称',{exact:true})).toBeDisabled();
 await dialog.getByRole('tab',{name:'成员与权限',exact:true}).click();await expect(dialog.getByRole('button',{name:'邀请成员',exact:true})).toHaveCount(0);
 await dialog.getByRole('tab',{name:'知识本地场',exact:true}).click();await expect(dialog.getByRole('button',{name:'保存绑定配置',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'返回空间列表',exact:true}).click();await dialog.getByRole('tab',{name:'使用中',exact:true}).click();await page.getByTestId('workspace-row-personal').getByRole('button',{name:'管理',exact:true}).click();
 await expect(dialog.getByRole('tab',{name:'成员与权限',exact:true})).toHaveCount(0);await expect(dialog.getByRole('tab',{name:'知识本地场',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'归档',exact:true})).toHaveCount(0);
});
