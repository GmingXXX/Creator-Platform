import {test,expect,type Page} from '@playwright/test';
async function login(page:Page){await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();}
async function mockVoice(page:Page){await page.addInitScript(()=>{class MockRecognition{onresult:any;onend:any;onerror:any;start(){(window as any).__voice=this;}stop(){setTimeout(()=>this.onend?.(),20);}abort(){setTimeout(()=>this.onend?.(),20);}};(window as any).SpeechRecognition=MockRecognition;});}
test('首页提示词保留原稿并刷新；模板可预览复用',async({page})=>{await login(page);const input=page.getByRole('textbox',{name:'创作需求',exact:true});await input.fill('保留的客户资料');await page.getByRole('button',{name:'企业鱼骨时间轴',exact:true}).click();await expect(input).toHaveValue(/^保留的客户资料\n\n/);const text=await input.inputValue();await page.getByRole('button',{name:'换一组提示词'}).click();await expect(input).toHaveValue(text);await expect(page.locator('.home-template-card')).toHaveCount(6);await page.screenshot({path:'output/验收截图/home-v15-1440.png',fullPage:true});await page.locator('.home-template-cover').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'快速复用并编辑'}).click();await expect(page).toHaveURL(/#\/(editor|dream|video|presentations)\//);});
test('语音取消保留原文，停止转写后可编辑，发送只提交一次',async({page})=>{await mockVoice(page);await login(page);const input=page.getByRole('textbox',{name:'创作需求',exact:true});await input.fill('原文');await page.getByRole('button',{name:'语音输入',exact:true}).click();await page.evaluate(()=>(window as any).__voice.onresult({results:[[{transcript:'不要保存'}]]}));await page.getByRole('button',{name:'取消录音'}).click();await expect(input).toHaveValue('原文');await page.getByRole('button',{name:'语音输入',exact:true}).click();await page.evaluate(()=>(window as any).__voice.onresult({results:[[{transcript:'录音内容'}]]}));await page.screenshot({path:'output/验收截图/voice-v15.png'});await page.getByRole('button',{name:'停止录音并转写'}).click();await expect(input).toHaveValue('原文\n录音内容');await expect(page).toHaveURL(/#\/$/);await page.getByRole('button',{name:'选择大模型'}).click();await page.getByRole('button',{name:/演示模式 · 离线示例/}).click();await page.getByRole('button',{name:'语音输入',exact:true}).click();await page.evaluate(()=>(window as any).__voice.onresult({results:[[{transcript:'制作时间轴'}]]}));await page.getByRole('button',{name:'结束录音并发送'}).click();await expect(page).toHaveURL(/create/);const runs=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.runs);expect(runs).toHaveLength(1);expect(runs[0].prompt).toBe('原文\n录音内容\n制作时间轴');});
test('语音权限错误保留文字，窄屏没有水平溢出',async({page})=>{await mockVoice(page);await login(page);await page.getByRole('textbox',{name:'创作需求',exact:true}).fill('已有内容');await page.getByRole('button',{name:'语音输入',exact:true}).click();await page.evaluate(()=>(window as any).__voice.onerror({error:'not-allowed'}));await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toHaveValue('已有内容');await expect(page.getByRole('button',{name:'语音输入',exact:true})).toBeVisible();await page.setViewportSize({width:1024,height:768});await page.screenshot({path:'output/验收截图/home-v15-1024.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});

test('首页简洁布局保留案例、快捷键提示、模板收藏和模拟来源入口', async ({page}) => {
 await login(page);
 const home = page.locator('.home-workspace');
 await expect(home.getByRole('heading', {name:'模板精选'})).toBeVisible({timeout:2500});
 await expect(home.locator('.knowledge-field-backdrop, .composer-hint, .home-template-note')).toHaveCount(0);
 const first = home.locator('.home-template-card').first();
 await expect(first.locator('footer')).toHaveText('快速复用');
 const favorite = first.getByRole('button', {name:/收藏模板/});
 const wasPressed = await favorite.getAttribute('aria-pressed');
 await favorite.click();
 await expect(favorite).toHaveAttribute('aria-pressed', String(wasPressed !== 'true'));
 const input = home.getByRole('textbox', {name:'创作需求'});
 const send = home.getByRole('button', {name:'发送创作需求'});
 await input.fill('演示内容');
 await input.press('Shift+Enter');
 await expect(input).toHaveValue('演示内容\n');
 await send.focus();
 await expect(home.getByRole('tooltip', {name:'Enter 发送，Shift + Enter 换行'})).toBeVisible();
 await input.focus();
 await expect(home.getByRole('tooltip')).toBeHidden();
 await page.getByRole('button', {name:'切换创作空间'}).click();
 await page.getByRole('menuitem', {name:'信泰企业展厅', exact:true}).click();
 const binding = home.getByRole('button', {name:'查看知识本地场绑定'});
 await binding.click();
 const manage = page.getByRole('dialog', {name:'管理项目空间'});
 await manage.getByRole('button', {name:'使用演示知识本地场'}).click();
 await manage.getByRole('button', {name:'保存绑定配置'}).click();
 await expect(manage.getByText('智创真实演示资料_20261116', {exact:true})).toBeVisible();
 await manage.getByRole('button', {name:'完成', exact:true}).click();
 await expect(binding).toContainText('模拟');
 await expect(home.getByText(/四个演示案例已就绪|智创真实演示资料_20261116/)).toHaveCount(0);
 await home.getByRole('button', {name:'企业鱼骨时间轴', exact:true}).click();
 await expect(input).toHaveValue(/知识本地场/);
});
