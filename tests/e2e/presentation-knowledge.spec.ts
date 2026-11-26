import {openSpaceSettings} from './workspace-settings-helpers';
import {test,expect} from '@playwright/test';
import {reloadAndReopen} from './reload-helpers';
test.beforeEach(async({page})=>{await page.route('**/api/ai/speech',route=>route.fulfill({json:{url:'/api/ai/speech/knowledge-test.wav'}}));await page.route('**/api/ai/speech/knowledge-test.wav',route=>route.fulfill({path:'public/media/narration.wav',contentType:'audio/wav'}));});
test('问答继承空间知识场，保存引用，试问和播放均明确未检索ACP',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/ai/chat',route=>{requests.push(route.request().postData()||'');return route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({answer:'仅依据演示内容回答。',sourcePages:[1]})}})});
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();await openSpaceSettings(page,'知识本地场');
 const dialog=page.getByRole('dialog',{name:'管理项目空间',exact:true});await dialog.getByLabel('知识本地场名称',{exact:true}).fill('信泰问答知识本地场');await dialog.getByLabel('知识本地场id',{exact:true}).fill('qa-private-field');await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await dialog.getByRole('button',{name:'完成',exact:true}).click();
 await page.goto('/#/presentations/workspace-demo-xintai-work-2');await page.getByRole('tab',{name:'互动问答',exact:true}).click();await expect(page.getByRole('region',{name:'问答知识本地场'})).toContainText('信泰问答知识本地场');await page.getByLabel('引用项目空间知识本地场',{exact:true}).check();await page.getByRole('button',{name:'保存',exact:true}).click();
 await reloadAndReopen(page);await page.getByRole('tab',{name:'互动问答',exact:true}).click();await expect(page.getByLabel('引用项目空间知识本地场',{exact:true})).toBeChecked();await page.getByLabel('试问作品').fill('核心观点？');await page.getByRole('button',{name:'试问',exact:true}).click();await expect(page.locator('.qa-trial-answer')).toContainText('仅依据演示');await expect(page.locator('.qa-trial .presentation-knowledge-notice')).toContainText('未检索 ACP');
 await page.getByRole('button',{name:'预览',exact:true}).click();await page.getByRole('button',{name:'提问',exact:true}).click();await expect(page.locator('.player-question-panel .presentation-knowledge-notice')).toContainText('未检索 ACP');await page.getByText('文字辅助输入',{exact:true}).click();await page.getByLabel('演示追问').fill('核心观点？');await page.getByRole('button',{name:'发送问题',exact:true}).click();await expect(page.locator('.player-answer')).toContainText('仅依据演示');expect(requests).toHaveLength(2);expect(requests.join('')).not.toContain('qa-private-field');
 await page.getByLabel('结束演示').click();await page.screenshot({path:'output/qa-scope-cards-knowledge.png'});await page.getByLabel('引用项目空间知识本地场',{exact:true}).uncheck();await page.getByRole('button',{name:'保存',exact:true}).click();await reloadAndReopen(page);await page.getByRole('tab',{name:'互动问答',exact:true}).click();await expect(page.getByLabel('引用项目空间知识本地场',{exact:true})).not.toBeChecked();
});

test('模拟知识场支持试问、来源核对、保存与观众提问，无需上传或远程问答',async({page})=>{
 let chats=0;await page.route('**/api/ai/chat',route=>{chats++;return route.abort();});
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();
 await page.goto('/#/presentations/workspace-demo-xintai-work-2');await page.getByRole('tab',{name:'互动问答',exact:true}).click();
 await page.getByRole('button',{name:'前往管理空间绑定',exact:true}).click();const dialog=page.getByRole('dialog',{name:'管理项目空间',exact:true});await dialog.getByRole('button',{name:'使用演示知识本地场',exact:true}).click();await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await dialog.getByRole('button',{name:'完成',exact:true}).click();
 const field=page.getByRole('region',{name:'问答知识本地场'});await expect(field).toContainText('模拟绑定');await expect(field).toContainText('知识本地场id');await page.getByLabel('引用项目空间知识本地场',{exact:true}).check();await expect(field).toContainText('可用资料 · 4 份');
 await page.getByLabel('试问作品').fill('绿色运营的单位产品能耗下降多少？');await page.getByRole('button',{name:'试问',exact:true}).click();await expect(page.locator('.qa-trial-answer')).toContainText('12%');await expect(page.locator('.qa-trial [aria-label="知识资料出处"]')).toContainText('星澜智造_智能演示大纲.pptx · 第 5 页');
 const source=page.locator('.qa-trial [aria-label="知识资料出处"] a').first();const href=await source.getAttribute('href');expect((await page.request.get(href!)).ok()).toBe(true);
 await page.getByRole('button',{name:'保存',exact:true}).click();await reloadAndReopen(page);await page.getByRole('tab',{name:'互动问答',exact:true}).click();await expect(page.getByLabel('引用项目空间知识本地场',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'预览',exact:true}).click();await page.getByRole('button',{name:'提问',exact:true}).click();await page.getByText('文字辅助输入',{exact:true}).click();await page.getByLabel('演示追问').fill('储能监测采集间隔是多少？');await page.getByRole('button',{name:'发送问题',exact:true}).click();await expect(page.locator('.player-answer')).toContainText('5秒缩短至1秒');await expect(page.locator('.player-answer [aria-label="知识资料出处"]')).toContainText('星澜智造');
 await page.getByLabel('演示追问').fill('董事长的手机号码是多少？');await page.getByRole('button',{name:'发送问题',exact:true}).click();await expect(page.locator('.player-answer')).toContainText('未提供');expect(chats).toBe(0);
 await page.screenshot({path:'output/presentation-demo-qa.png'});
});
