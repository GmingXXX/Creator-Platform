import {test,expect,type Page} from '@playwright/test';
async function enter(page:Page){await page.route('**/api/ai/config',r=>r.fulfill({json:{configured:false,models:[]}}));await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();}
async function admin(page:Page){await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);data.state.role='reviewer';localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));});await page.goto('/#/admin');await page.reload();}
test('首页首次收起、显式偏好保留，创作者管理路由不提权',async({page})=>{
 await enter(page);await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);await page.getByRole('button',{name:'展开侧栏',exact:true}).click();await page.reload();await expect(page.locator('.app-shell')).not.toHaveClass(/sidebar-collapsed/);
 await page.goto('/#/admin');await expect(page.getByText('需要管理员权限',{exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.role)).toBe('creator');
});
test('管理员邀请、委派权限、下架恢复与私有作品保留',async({page})=>{
 await enter(page);await admin(page);await expect(page.getByRole('heading',{name:'管理中心',exact:true})).toBeVisible();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works);
 await page.getByRole('button',{name:'创建模拟邀请',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('姓名',{exact:true}).fill('演示访客');await dialog.getByLabel('邮箱',{exact:true}).fill('demo@example.com');await dialog.getByRole('button',{name:'创建邀请',exact:true}).click();await expect(page.getByText('demo@example.com',{exact:true})).toBeVisible();
 await page.getByLabel('林安的平台角色').selectOption('admin');await page.getByRole('tab',{name:'权限配置',exact:true}).click();await page.getByRole('button',{name:'后台职责',exact:true}).click();await page.getByLabel('配置权限的管理员').selectOption('linan');await page.getByLabel('社区审核',{exact:true}).check();
 await page.getByLabel('模拟管理员身份').selectOption('linan');await page.getByRole('tab',{name:'共享资源',exact:true}).click();await expect(page.getByText('当前管理员未获此项权限')).toBeVisible();await page.goto('/#/review');await expect(page.getByRole('heading',{name:'社区审核',exact:true})).toBeVisible();
 await page.goto('/#/admin');await page.getByLabel('模拟管理员身份').selectOption('jiming');await page.getByRole('tab',{name:'权限配置',exact:true}).click();await page.getByRole('button',{name:'后台职责',exact:true}).click();await page.getByLabel('配置权限的管理员').selectOption('linan');await page.getByLabel('社区审核',{exact:true}).uncheck();await page.getByLabel('模拟管理员身份').selectOption('linan');await page.goto('/#/review');await expect(page.getByText('当前管理员没有审核权限')).toBeVisible();
 await page.goto('/#/admin');await page.getByLabel('模拟管理员身份').selectOption('jiming');await page.getByRole('tab',{name:'共享资源',exact:true}).click();const row=page.locator('.admin-row').nth(1),title=await row.locator('strong').innerText();await row.getByRole('button',{name:'下架',exact:true}).click();await page.getByRole('dialog').getByLabel('下架原因').fill('演示核验');await page.getByRole('button',{name:'确认下架'}).click();await expect(row.getByText('已下架',{exact:true})).toBeVisible();await page.goto('/#/community');await expect(page.locator('.res-card h3').filter({hasText:title})).toHaveCount(0);
 await page.goto('/#/admin');await page.getByRole('tab',{name:'共享资源',exact:true}).click();await page.locator('.admin-row').filter({hasText:title}).getByRole('button',{name:'恢复公开',exact:true}).click();await page.goto('/#/community');await expect(page.locator('.res-card h3').filter({hasText:title})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works)).toEqual(before);
});

test('默认配置创作者的空间权限，保存后刷新保留，成员列表使用同一权限',async({page})=>{
 await enter(page);await admin(page);await page.getByRole('tab',{name:'权限配置',exact:true}).click();
 const policy=page.getByRole('region',{name:'林安的项目空间权限'}),permission=policy.getByLabel('信泰企业展厅的成员权限');
 await expect(permission).toHaveValue('none');await permission.selectOption('viewer');
 const getMember=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.workspaceMembers.xintai.find((m:{account:string})=>m.account==='linan@demo.local'));
 expect(await getMember()).toBeUndefined();await policy.getByRole('button',{name:'保存成员权限'}).click();
 expect(await getMember()).toMatchObject({role:'viewer',status:'member'});
 await page.reload();await page.getByRole('tab',{name:'权限配置',exact:true}).click();await expect(permission).toHaveValue('viewer');
 await permission.selectOption('editor');await policy.getByRole('button',{name:'撤销更改'}).click();await expect(permission).toHaveValue('viewer');
 await permission.selectOption('editor');await policy.getByRole('button',{name:'保存成员权限'}).click();
 expect(await getMember()).toMatchObject({role:'editor'});await page.getByRole('tab',{name:'操作记录'}).click();await expect(page.getByText('信泰企业展厅 · 编辑者')).toBeVisible();
});

test('模型设置分区可配置和核对，限额与默认模型刷新后保留',async({page})=>{
 await enter(page);await admin(page);
 await page.route('**/api/ai/config',r=>r.fulfill({json:{models:[],configured:{deepseek:true,image:false,video:false,speech:true}}}));
 const openModels=async()=>{
  await page.getByRole('tab',{name:'平台配置'}).click();
  await page.getByRole('button',{name:'模型服务',exact:true}).click();
 };
 await openModels();
 await page.getByLabel('默认创作模型').selectOption('demo');
 await page.getByLabel('每空间每日 Agent 创作任务上限').fill('8');
 await page.getByRole('button',{name:'保存限额'}).click();
 await page.getByRole('button',{name:'查看服务配置状态'}).click();
 await expect(page.getByText(/文本已配置 · 图片待配置/)).toBeVisible();
 await page.reload();await openModels();
 await expect(page.getByLabel('默认创作模型')).toHaveValue('demo');
 await expect(page.getByLabel('每空间每日 Agent 创作任务上限')).toHaveValue('8');
});

test('撤销旧账号和邮箱两个成员记录后刷新仍无法编辑',async({page})=>{
 await enter(page);
 await page.evaluate(()=>{
  const key='zhichuang-studio-v1',record=JSON.parse(localStorage.getItem(key)!);
  const members=record.state.workspaceMembers.xintai,base={name:'林安',role:'editor',status:'member'};
  record.state={...record.state,role:'reviewer',workspaceMembers:{...record.state.workspaceMembers,xintai:[...members,{...base,id:'old-handle',account:'linan'},{...base,id:'old-email',account:'linan@demo.local'}]}};
  localStorage.setItem(key,JSON.stringify(record));
 });
 await page.goto('/#/admin');await page.reload();await page.getByRole('tab',{name:'权限配置',exact:true}).click();
 const policy=page.getByRole('region',{name:'林安的项目空间权限'}),permission=policy.getByLabel('信泰企业展厅的成员权限');
 await expect(permission).toHaveValue('editor');await permission.selectOption('none');
 await policy.getByRole('button',{name:'保存成员权限'}).click();await page.reload();
 await page.getByRole('tab',{name:'权限配置',exact:true}).click();await expect(permission).toHaveValue('none');
 const aliases=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.workspaceMembers.xintai.filter((m:{id:string})=>['old-email','old-handle'].includes(m.id)));
 expect(aliases).toEqual([]);
});
