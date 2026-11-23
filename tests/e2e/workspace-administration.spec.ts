import {test,expect,type Page} from '@playwright/test';

const readState=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function openManagement(page:Page){
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await page.getByRole('menuitem',{name:'管理空间',exact:true}).click();
 return page.getByRole('dialog',{name:'管理项目空间',exact:true});
}
async function switchSpace(page:Page,name:string){
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await page.getByRole('menuitem',{name,exact:true}).click();
}
test.beforeEach(async({page})=>{
 await page.route('**/api/ai/**',route=>route.fulfill({json:{models:[{id:'demo',label:'演示模式'}],configured:{}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台',exact:true}).click();
 await expect(page.getByLabel('创作需求',{exact:true})).toBeVisible();
});

test('归档隐藏日常入口、只读预览、刷新保留并可恢复',async({page})=>{
 const before=await readState(page);
 await switchSpace(page,'信泰企业展厅');
 const dialog=await openManagement(page),row=page.getByTestId('workspace-row-xintai');
 await row.getByRole('button',{name:'信泰企业展厅的更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'归档',exact:true}).click();
 await expect(page.getByRole('button',{name:'切换创作空间',exact:true})).toContainText('个人空间');
 await openManagement(page);
 await dialog.getByRole('tab',{name:/已归档/}).click();
 await expect(row).toContainText('信泰企业展厅');
 await row.getByRole('button',{name:'只读预览',exact:true}).click();
 await expect(page.getByRole('button',{name:'新建作品',exact:true}).first()).toBeDisabled();
 await expect(page.locator('.workspace-readonly-notice')).toContainText('归档');
 await page.goto('/#/editor/workspace-demo-xintai-work-1');
 await expect(page).toHaveURL(/preview\/workspace-demo-xintai-work-1/);
 await page.goto('/#/projects');await page.reload();
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'信泰企业展厅',exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');
 const manage=await openManagement(page);await manage.getByRole('tab',{name:/已归档/}).click();
 await row.getByRole('button',{name:'信泰企业展厅的更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'恢复使用',exact:true}).click();
 const after=await readState(page);
 expect(after.workspaces.find((s:any)=>s.id==='xintai').archivedAt).toBeUndefined();
 expect(after.works).toEqual(before.works);expect(after.assets).toEqual(before.assets);expect(after.skills).toEqual(before.skills);
});

test('空间回收站恢复内容，彻底删除隔离其他空间且预设空间不回填',async({page})=>{
 const before=await readState(page),dialog=await openManagement(page),row=page.getByTestId('workspace-row-xintai');
 await row.getByRole('button',{name:'信泰企业展厅的更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'移入回收站',exact:true}).click();
 await page.getByRole('dialog',{name:'将项目空间移入回收站？',exact:true}).getByRole('button',{name:'移入回收站',exact:true}).click();
 await dialog.getByRole('tab',{name:/回收站/}).click();
 await row.getByRole('button',{name:'恢复空间',exact:true}).click();
 expect((await readState(page)).works).toEqual(before.works);
 await dialog.getByRole('tab',{name:/使用中/}).click();
 await row.getByRole('button',{name:'信泰企业展厅的更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'移入回收站',exact:true}).click();
 await page.getByRole('dialog',{name:'将项目空间移入回收站？',exact:true}).getByRole('button',{name:'移入回收站',exact:true}).click();
 await dialog.getByRole('tab',{name:/回收站/}).click();
 await row.getByRole('button',{name:'彻底删除',exact:true}).click();
 const confirm=page.getByRole('dialog',{name:'彻底删除项目空间？',exact:true});
 await expect(confirm).toContainText('ACP');
 await expect(confirm.getByRole('button',{name:'确认彻底删除',exact:true})).toBeDisabled();
 await confirm.getByRole('textbox').fill('信泰企业展厅');
 await confirm.getByRole('button',{name:'确认彻底删除',exact:true}).click();
 await expect(row).toHaveCount(0);
 await page.reload();
 const after=await readState(page);
 expect(after.workspaces.find((s:any)=>s.id==='xintai').purgedAt).toBeTruthy();
 expect(after.works.filter((w:any)=>w.workspaceId==='xintai')).toHaveLength(0);
 expect(after.works.filter((w:any)=>w.workspaceId!=='xintai')).toEqual(before.works.filter((w:any)=>w.workspaceId!=='xintai'));
 expect(after.assets.filter((a:any)=>a.workspaceId!=='xintai')).toEqual(before.assets.filter((a:any)=>a.workspaceId!=='xintai'));
 await page.goto('/#/editor/workspace-demo-xintai-work-1');
 await expect(page.locator('.scene-board')).toHaveCount(0);
});

test('大量空间可搜索且固定操作可见，个人空间和编辑者无删除归档权限',async({page})=>{
 await page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  for(let i=1;i<=25;i++){const id=`list-test-${i}`;data.state.workspaces.push({id,name:`演示空间${i}`,description:'测试',color:'#527786'});data.state.workspaceMembers[id]=structuredClone(data.state.workspaceMembers.xintai);}
  data.state.workspaceMembers.xintai.push({id:'test-editor',account:'editor',name:'编辑者',role:'editor',status:'member'});data.state.workspaceActors.xintai='test-editor';
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));
 });await page.reload();
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'新建项目空间',exact:true})).toBeInViewport();
 await expect(page.getByRole('menuitem',{name:'管理空间',exact:true})).toBeInViewport();
 await page.getByRole('textbox',{name:'搜索项目空间',exact:true}).fill('演示空间25');
 await expect(page.getByRole('menuitem',{name:'演示空间25',exact:true})).toBeVisible();
 await expect(page.getByRole('menuitem',{name:'演示空间1',exact:true})).toHaveCount(0);
 await page.getByRole('menuitem',{name:'管理空间',exact:true}).click();
 const personal=page.getByTestId('workspace-row-personal'),editor=page.getByTestId('workspace-row-xintai');
 await expect(personal.getByRole('button',{name:/更多操作/})).toHaveCount(0);
 await expect(editor.getByRole('button',{name:/更多操作/})).toHaveCount(0);
 await expect(editor.getByRole('button',{name:'移入回收站',exact:true})).toHaveCount(0);
});
