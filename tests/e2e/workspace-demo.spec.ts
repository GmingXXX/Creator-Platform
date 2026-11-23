import {test,expect,type Page} from '@playwright/test';

const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function switchSpace(page:Page,name:string){await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();});

test('知识本地场紧随设计风格，长名称和较窄桌面仍可打开设置',async({page})=>{
 await switchSpace(page,'信泰企业展厅');const field=page.getByRole('button',{name:'查看知识本地场绑定'}),style=page.getByRole('button',{name:'设计风格',exact:true});
 const a=await style.boundingBox(),b=await field.boundingBox();expect(b!.x).toBeGreaterThanOrEqual(a!.x+a!.width);expect(Math.abs(b!.y-a!.y)).toBeLessThan(3);
 await expect(page.locator('.composer > .knowledge-field-context')).toHaveCount(0);await page.screenshot({path:'output/space-demo-toolbar-desktop.png',animations:'disabled'});
 await field.click();const dialog=page.getByRole('dialog',{name:'管理项目空间'});await dialog.getByLabel('知识本地场名称',{exact:true}).fill('信泰企业展厅客户案例与发展历程知识本地场');await dialog.getByLabel('知识本地场id',{exact:true}).fill('toolbar-preview-field');await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await dialog.getByRole('button',{name:'完成',exact:true}).click();
 await page.setViewportSize({width:1024,height:768});await expect(field).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'output/space-demo-toolbar-1024.png',animations:'disabled'});
 await field.click();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'完成',exact:true}).click();
});

test('三个预设空间都有对应作品、共享素材和可启停技能，作品可运行',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [id,name] of [['xintai','信泰企业展厅'],['dongguan','东莞博物馆'],['aitown','ai小镇展厅']]){
  await page.goto('/#/projects');await switchSpace(page,name);const data=await state(page),works=data.works.filter((w:any)=>w.workspaceId===id&&w.id.startsWith('workspace-demo-'));
  expect(works).toHaveLength(2);await expect(page.locator('.res-project-card')).toHaveCount(2);
  await page.screenshot({path:`output/space-demo-${id}-projects.png`,animations:'disabled'});
  for(const work of works){
   await page.goto(`/#/preview/${work.id}`);await expect(page.locator('.runtime-page')).toBeVisible();await expect(page.locator('.runtime-page > header')).toContainText(work.title);
   await expect.poll(()=>page.locator('.runtime-page img').evaluateAll((images:HTMLImageElement[])=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
   if(work.kind==='exhibit'&&id==='xintai'){await page.getByRole('button',{name:'2000 初创探索',exact:true}).click();await expect(page.getByRole('dialog',{name:'初创探索',exact:true})).toContainText('模拟');await page.getByRole('button',{name:'关闭详情',exact:true}).click();}
   if(work.kind==='presentation'){await page.locator('.res-page-strip button').nth(1).click();await expect(page.locator('.res-page-strip button').nth(1)).toHaveClass('active');await expect(page.locator(`[data-node-id="${work.pages[1].nodes[1].id}"]`)).toHaveText(work.pages[1].nodes[1].content);}
   if(work.kind==='story'){await page.getByRole('button',{name:'开始探索',exact:true}).click();await page.getByRole('button',{name:'继续',exact:true}).click();await page.getByRole('button',{name:'水乡生活',exact:true}).click();await expect(page.getByRole('button',{name:'体验另一种结局'})).toBeVisible();}
   await page.screenshot({path:`output/${work.id}-runtime.png`,animations:'disabled'});
  }
  await page.goto('/#/library?scope=shared');for(const asset of data.assets.filter((a:any)=>a.workspaceId===id&&a.id.startsWith('workspace-demo-')))await expect(page.getByRole('button',{name:`预览${asset.name}`,exact:true})).toBeVisible();
  await page.goto('/#/skills?scope=shared');const skill=data.skills.find((s:any)=>s.workspaceId===id);await expect(page.getByRole('button',{name:`查看${skill.name}`,exact:true})).toBeVisible();
  const skillCard=page.getByRole('article').filter({has:page.getByRole('button',{name:`查看${skill.name}`,exact:true})});await skillCard.getByRole('button',{name:'停用技能',exact:true}).click();expect((await state(page)).skills.find((s:any)=>s.id===skill.id).enabled).toBe(false);await skillCard.getByRole('button',{name:'启用技能',exact:true}).click();expect((await state(page)).skills.find((s:any)=>s.id===skill.id).enabled).toBe(true);
 }
 expect(errors).toEqual([]);
});

test('旧浏览器数据刷新自动补齐演示，之后移除示例不会重新补回',async({page})=>{
 await page.evaluate(()=>{const key='zhichuang-studio-v1',saved=JSON.parse(localStorage.getItem(key)!);delete saved.state.workspaceDemoVersion;for(const type of ['works','assets','skills'])saved.state[type]=saved.state[type].filter((item:any)=>!item.id.startsWith('workspace-demo-'));localStorage.setItem(key,JSON.stringify(saved));});
 await page.reload();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();await switchSpace(page,'信泰企业展厅');let data=await state(page);expect(data.workspaceDemoVersion).toBe(1);const demo=data.works.find((w:any)=>w.workspaceId==='xintai'&&w.id.startsWith('workspace-demo-'));expect(demo).toBeTruthy();
 await page.evaluate(id=>{const key='zhichuang-studio-v1',saved=JSON.parse(localStorage.getItem(key)!);saved.state.works=saved.state.works.filter((w:any)=>w.id!==id);localStorage.setItem(key,JSON.stringify(saved));},demo.id);
 await page.reload();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();await page.goto('/#/projects');await expect(page.locator('.res-project-card')).toHaveCount(1);expect((await state(page)).works.some((w:any)=>w.id===demo.id)).toBe(false);
});

test('搜索共享示例直接打开对应素材和技能详情',async({page})=>{
 await switchSpace(page,'信泰企业展厅');const data=await state(page);
 for(const item of [data.assets.find((a:any)=>a.id==='workspace-demo-xintai-asset-1'),data.skills.find((s:any)=>s.id==='workspace-demo-xintai-skill')]){
  await page.locator('.sidebar-search').click();await page.getByPlaceholder('搜索作品、素材、Skills 或设计风格…').fill(item.name);await page.locator('.global-results button').filter({hasText:item.name}).click();
  await expect(page.getByRole('dialog',{name:item.name,exact:true})).toBeVisible();await expect(page).toHaveURL(item.id.includes('-asset-')?/scope=shared/:/skills\?skill=/);await page.getByRole('dialog').getByRole('button',{name:'关闭对话框',exact:true}).click();
 }
});
