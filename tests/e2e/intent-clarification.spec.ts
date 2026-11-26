import {test,expect,type Page} from '@playwright/test';
const data=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function enter(page:Page,knowledge=false){
 await page.route('**/api/ai/config',r=>r.fulfill({json:{configured:false,models:[]}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
 await page.evaluate(knowledge=>{const v=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),s=v.state;
 const d=s.drafts.find((item:{id:string})=>item.id===s.activeDraftId);d.model='demo';
 if(knowledge){s.activeWorkspaceId='xintai';d.workspaceId='xintai';s.workspaceKnowledge.xintai={provider:'acp',fieldId:'honors',fieldName:'测试知识场',demoCatalogId:'zhichuang-20261116',revision:1,status:'configured',updatedAt:new Date().toISOString()};}
 localStorage.setItem('zhichuang-studio-v1',JSON.stringify(v));},knowledge);
 await page.reload();await page.getByRole('button',{name:'荣誉与案例展示',exact:true}).click();
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();await expect(page).toHaveURL(/#\/create\/chat-/);
 await expect(page.locator('.session-answer').last().getByRole('button',{name:'自由浏览',exact:true})).toBeVisible();
}
for(const [kind,answer] of [['exhibit','自由浏览'],['presentation','自动讲解'],['story','分支故事']])test('在会话选择 '+answer+' 并调用对应能力',async({page})=>{
 await enter(page,kind==='exhibit');const url=page.url();
 await expect(page.locator('.artifact-heading')).not.toContainText('交互页面');
 expect((await data(page)).runs).toHaveLength(0);await page.reload();
 await page.getByRole('button',{name:answer,exact:true}).click();
 await expect.poll(async()=>(await data(page)).runs[0]?.creationPluginId).toBe(kind);
 await expect(page).toHaveURL(url);await expect(page.getByRole('textbox',{name:'继续对话'})).toBeVisible();
 if(kind==='exhibit')expect((await data(page)).runs[0].attachmentIds).toHaveLength(2);
});
test('自由补充、返回首页、恢复会话、移动端切换预览',async({page})=>{
 await enter(page);const url=page.url();await page.getByRole('textbox',{name:'继续对话'}).fill('长期放在展厅');
 await page.getByRole('button',{name:'发送会话消息'}).click();expect((await data(page)).runs).toHaveLength(0);
 await page.getByRole('button',{name:'返回首页',exact:true}).click();
 const expand=page.getByRole('button',{name:'展开侧栏'});if(await expand.isVisible())await expand.click();
 await page.locator('a[href*="/create/chat-"]').first().click();await expect(page).toHaveURL(url);
 await expect(page.getByText('长期放在展厅',{exact:true})).toBeVisible();
 await page.setViewportSize({width:400,height:760});await page.getByRole('button',{name:'查看预览'}).click();
 await expect(page.getByText('方案将在这里呈现')).toBeVisible();await page.getByRole('button',{name:'返回对话'}).click();
 const input=page.getByRole('textbox',{name:'继续对话'});await input.fill('由接待人员自动讲五分钟');await input.press('Enter');
 await expect.poll(async()=>(await data(page)).runs[0]?.outputKind).toBe('presentation');
});

test('交互页面从方案到预览，生成期间的补充在同一会话生效',async({page})=>{
 await enter(page);const url=page.url();await page.getByRole('button',{name:'自由浏览',exact:true}).click();
 await page.getByRole('textbox',{name:'确认作品标题'}).fill('展会案例索引');await page.getByRole('button',{name:'确认内容，继续生成'}).click();
 await page.getByRole('textbox',{name:'继续对话'}).fill('把背景改成暖色');await page.getByRole('button',{name:'发送会话消息'}).click();
 await expect(page.getByRole('textbox',{name:'修改当前作品'})).toBeVisible({timeout:16000});
 await expect.poll(async()=>(await data(page)).conversationTurns.at(-1)?.status).toBe('applied');
 await expect(page).toHaveURL(url);await page.reload();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible();
});
