import {test,expect,type Page} from '@playwright/test';

const snapshot=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function enter(page:Page){
 await page.route('**/api/ai/config',r=>r.fulfill({json:{configured:false,models:[]}}));
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);data.state.drafts.find((d:{id:string})=>d.id===data.state.activeDraftId).model='demo';localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));});
 await page.reload();
 await page.getByRole('button',{name:'荣誉与案例展示',exact:true}).click();
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 await expect(page.getByRole('heading',{name:'你希望完整展示，还是精选重点用于讲解？'})).toBeVisible();
}
test('模糊示例等待回答，完整浏览进入交互页面',async({page})=>{
 let calls=0;await page.route('**/api/ai/chat',r=>{calls++;return r.fulfill({status:503,json:{error:'must not call'}});});
 await enter(page);const before=await snapshot(page);
 expect(before.runs).toHaveLength(0);expect(calls).toBe(0);
 await expect(page.getByRole('radio')).toHaveCount(2);
 await page.screenshot({path:'/tmp/zc-honors-clarification-light.png',fullPage:true,animations:'disabled'});
 await page.getByRole('radio',{name:/完整展示/}).check();
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();
 await expect(page).toHaveURL(/#\/create\//);
 const after=await snapshot(page);expect(after.runs).toHaveLength(1);
 expect(after.runs[0].outputKind).toBe('exhibit');
 expect(after.runs[0].prompt).toContain('用户确认制作：交互页面');
});
test('精选讲解收集受众和时长，刷新可恢复并正确分流',async({page})=>{
 await enter(page);await page.getByRole('radio',{name:/精选重点/}).check();
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('请选择讲解受众和时长');
 expect((await snapshot(page)).runs).toHaveLength(0);
 await page.getByLabel('讲解受众',{exact:true}).selectOption('客户与合作伙伴');
 await page.getByLabel('讲解时长',{exact:true}).selectOption('5 分钟');
 await page.getByRole('textbox',{name:'补充展示需求'}).fill('只展示2024年后的成果');
 await expect(page.getByRole('radio',{name:/精选重点/})).toBeChecked();
 await page.reload();await expect(page.getByRole('radio',{name:/精选重点/})).toBeChecked();
 await expect(page.getByLabel('讲解时长',{exact:true})).toHaveValue('5 分钟');
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();await expect(page).toHaveURL(/#\/create\//);
 const after=await snapshot(page);expect(after.runs[0].outputKind).toBe('presentation');
 expect(after.runs[0].prompt).toContain('面向受众：客户与合作伙伴；讲解时长：5 分钟');
});
test('自由回答不按场地猜测，情境分支需求可进入互动影片',async({page})=>{
 await enter(page);await page.getByRole('textbox',{name:'补充展示需求'}).fill('长期放在展厅');
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('请选择展示目的');expect((await snapshot(page)).runs).toHaveLength(0);
 await page.getByRole('textbox',{name:'补充展示需求'}).fill('让访客选择故事分支，进入不同结局');
 await expect(page.locator('.intent-recommendation')).toContainText('互动影片');
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();await expect(page).toHaveURL(/#\/create\//);
 expect((await snapshot(page)).runs[0].outputKind).toBe('story');
});
test('取消和修改需求保留草稿，不沿用旧答案；深色窄屏可用',async({page})=>{
 await enter(page);const original=(await snapshot(page)).activeDraftId;
 await page.getByRole('radio',{name:/精选重点/}).check();
 await page.getByRole('button',{name:'取消需求澄清'}).click();
 await expect(page.locator('.intent-question')).toHaveCount(0);
 expect((await snapshot(page)).activeDraftId).toBe(original);
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 await expect(page.getByRole('radio',{name:/精选重点/})).not.toBeChecked();
 await page.getByRole('button',{name:'切换到暗色模式',exact:true}).click();
 await page.setViewportSize({width:1024,height:900});
 await page.screenshot({path:'/tmp/zc-honors-clarification-dark.png',fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('textbox',{name:'创作需求',exact:true}).fill('把企业荣誉制作成交互页面');
 await expect(page.locator('.intent-question')).toHaveCount(0);
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();await expect(page).toHaveURL(/#\/create\//);
 expect((await snapshot(page)).runs[0].outputKind).toBe('exhibit');
});
for(const choice of ['browse','present'] as const)test(`绑定模拟知识场后 ${choice} 引用同一批荣誉案例资料`,async({page})=>{
 await enter(page);
 await page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  data.state.activeWorkspaceId='xintai';
  data.state.drafts.find((d:{id:string})=>d.id===data.state.activeDraftId).workspaceId='xintai';
  data.state.workspaceKnowledge.xintai={provider:'acp',fieldId:'demo-honors',fieldName:'荣誉案例模拟场',demoCatalogId:'zhichuang-20261116',revision:1,status:'configured',updatedAt:new Date().toISOString()};
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));
 });
 await page.reload();
 await page.getByRole('radio',{name:choice==='browse'?/完整展示/:/精选重点/}).check();
 if(choice==='present'){
  await page.getByLabel('讲解受众',{exact:true}).selectOption('领导接待');
  await page.getByLabel('讲解时长',{exact:true}).selectOption('5 分钟');
 }
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();await expect(page).toHaveURL(/#\/create\//);
 const state=await snapshot(page),run=state.runs[0];
 expect(run.outputKind).toBe(choice==='browse'?'exhibit':'presentation');
 expect(run.attachmentIds).toHaveLength(2);
 const inputs=state.assets.filter((asset:{id:string})=>run.attachmentIds.includes(asset.id));
 expect(inputs.map((asset:{name:string})=>asset.name).sort()).toEqual(['星澜智造_技术案例.md','星澜智造_荣誉资质.md']);
 expect(inputs.every((asset:{package:{params:{knowledgeCase:string;knowledgeFieldId:string}}})=>asset.package.params.knowledgeCase==='honors'&&asset.package.params.knowledgeFieldId==='demo-honors')).toBe(true);
});

test('一般展项需求先选择体验方式，不注入荣誉主题',async({page})=>{
 await enter(page);
 await page.getByRole('button',{name:'取消需求澄清'}).click();
 await page.getByRole('textbox',{name:'创作需求',exact:true}).fill('根据这些资料做个展厅展示');
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 await expect(page.getByRole('heading',{name:'你希望访客自由浏览、听讲解，还是参与故事？'})).toBeVisible();
 await expect(page.getByRole('radio')).toHaveCount(3);
 await page.getByRole('radio',{name:/精选重点/}).check();
 await page.getByLabel('讲解受众',{exact:true}).selectOption('公众参观');
 await page.getByLabel('讲解时长',{exact:true}).selectOption('5 分钟');
 await page.getByRole('button',{name:'确认并继续',exact:true}).click();
 await expect(page).toHaveURL(/#\/create\//);
 const run=(await snapshot(page)).runs[0];expect(run.outputKind).toBe('presentation');expect(run.prompt).not.toContain('荣誉');
});
