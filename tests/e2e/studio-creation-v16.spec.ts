import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/api/ai/config',r=>r.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
});
test('首页互动影片直接弹窗，非必填流程与脚本，空白创建与作品列表直接打开',async({page})=>{
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'互动影片',exact:true}).click();
 await expect(page).toHaveURL(/#\/$/);await expect(page.getByRole('dialog',{name:'创建互动影片'})).toBeVisible();
 await expect(page.getByRole('button',{name:'生成节点草稿',exact:true})).toHaveCount(0);
 await page.getByLabel('作品名称',{exact:true}).fill('真正空白的互动影片');await page.getByLabel('画面分辨率',{exact:true}).selectOption('2520×1080');await page.getByRole('button',{name:'进入空白画布',exact:true}).click();
 await expect(page).toHaveURL(/#\/dream\//);await expect(page.locator('.story-node')).toHaveCount(0);await expect(page.getByRole('button',{name:'添加开始节点'})).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w:any)=>w.title==='真正空白的互动影片'));
 expect(saved.width).toBe(2520);expect(saved.storyNodes).toEqual([]);expect(saved.storyEdges).toEqual([]);
 await page.getByRole('button',{name:'查看作品',exact:true}).click();await page.getByRole('button',{name:'打开真正空白的互动影片',exact:true}).click();await expect(page).toHaveURL(new RegExp(saved.id));await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('真实节点草稿应用脚本，上传HTML并绑定，运行隔离且继续下一节点',async({page})=>{
 let prompt='';await page.route('**/api/ai/chat',async r=>{prompt=JSON.stringify(r.request().postDataJSON());await r.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({nodes:[{id:'s',type:'start',title:'开始',text:'欢迎'},{id:'html',type:'scene',title:'互动问答',text:'完成体验后继续'},{id:'e',type:'end',title:'结束',text:'谢谢'}],edges:[{source:'s',target:'html',label:'开始体验'},{source:'html',target:'e',label:'继续'}]})}});});
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'互动影片',exact:true}).click();
 await page.getByLabel('作品名称',{exact:true}).fill('HTML 节点验收');await page.getByRole('dialog').locator('input[type=file]').first().setInputFiles({name:'策划脚本.txt',mimeType:'text/plain',buffer:Buffer.from('开始体验，进行互动问答，完成后结束。')});
 await expect(page.locator('.creation-source-file')).toContainText('已解析文字');await page.getByRole('button',{name:'生成节点草稿',exact:true}).click();await expect(page.locator('.creation-node')).toHaveCount(3);expect(prompt).toContain('进行互动问答');
 await page.locator('.creation-node').nth(1).locator('input[type=file]').setInputFiles({name:'问答.html',mimeType:'text/html',buffer:Buffer.from('<!doctype html><button onclick="parent.postMessage({type:\'zhichuang:complete\'},\'*\')">完成体验</button>')});
 await expect(page.getByText('1 份素材可分配',{exact:true})).toBeVisible();await expect(page.locator('.creation-node').nth(1).locator('.asset-review-source')).toContainText('问答.html');await page.getByRole('button',{name:'创建并进入节点画布',exact:true}).click();
 await page.getByRole('button',{name:'预览',exact:true}).click();await page.getByRole('button',{name:'开始体验',exact:true}).click();
 const frame=page.locator('iframe[title="互动问答"]');await expect(frame).toHaveAttribute('sandbox','allow-scripts');await page.frameLocator('iframe[title="互动问答"]').getByRole('button',{name:'完成体验',exact:true}).click();await expect(page.getByRole('status')).toContainText('体验已完成');await page.getByRole('button',{name:'继续',exact:true}).click();await expect(page.locator('.story-preview-body h2')).toHaveText('结束');
});
test('演示直接新建、返回类型选择保留首页、模型大纲讲稿与无风格持久化',async({page})=>{
 await page.route('**/api/ai/chat',r=>r.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({title:'真实大纲验收',sections:[{title:'企业概况',bullets:['企业概况内容'],narration:'这是来自模型的企业概况讲稿'},{title:'案例成果',bullets:['案例成果内容'],narration:'这是案例讲稿'}]})}}));
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();await expect(page).toHaveURL(/#\/$/);await page.getByRole('button',{name:'返回上一步',exact:true}).click();await expect(page.getByRole('dialog',{name:'新建作品'})).toBeVisible();await expect(page).toHaveURL(/#\/$/);await page.getByRole('button',{name:'关闭对话框',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();await page.getByLabel('你想讲述什么？',{exact:true}).fill('真实大纲验收');await expect(page.getByRole('dialog').getByRole('button',{name:'选择设计风格',exact:true})).toContainText('无 · 根据内容自动编排');await page.getByRole('button',{name:'生成大纲',exact:true}).click();await expect(page.getByLabel('第1页讲稿',{exact:true})).toHaveValue('这是来自模型的企业概况讲稿');
 await page.getByRole('button',{name:'下移第1页',exact:true}).click();await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);await expect(page.getByLabel('本页讲稿',{exact:true})).toHaveValue('这是案例讲稿');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w:any)=>w.title==='真实大纲验收'));expect(saved.styleId).toBe('');expect(saved.pages[0].backgroundImage).toBeUndefined();
});
