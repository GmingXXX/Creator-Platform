import {test,expect} from '@playwright/test';
import type {StoryNode} from '../../src/domain/types';
const plan={title:'泰山寻碑',nodes:[{id:'s',type:'start',title:'候云',text:'这是模拟互动故事，进入泰山寻碑之旅。'},{id:'c',type:'choice',title:'择路',text:'你想先看云海还是石刻？'},{id:'east',type:'scene',title:'登临云海',text:'远处云层缓缓散开。'},{id:'west',type:'scene',title:'探访碑林',text:'石刻留下了行旅者的记忆。'},{id:'a',type:'end',title:'结局：云海记忆',text:'你带走了一幅云海的风景。'},{id:'b',type:'end',title:'结局：石刻回声',text:'你带走了一段石刻的故事。'}],edges:[{source:'s',target:'c',label:'请君入山'},{source:'c',target:'east',label:'看云海'},{source:'c',target:'west',label:'寻石刻'},{source:'east',target:'a',label:'留下云海记忆'},{source:'west',target:'b',label:'倾听石刻回声'}]};
test.beforeEach(async({page})=>{
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
});
test('真实模型节点经过确认和素材绑定，两条路线进入不同结局',async({page})=>{
 let request='';await page.route('**/api/ai/chat',async route=>{request=JSON.stringify(route.request().postDataJSON());await route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify(plan)}});});
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'互动影片',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'创建互动影片'});await dialog.getByLabel('作品名称',{exact:true}).fill('泰山寻碑真实节点验收');
 await dialog.locator('input[type=file]').first().setInputFiles({name:'泰山寻碑策划.md',mimeType:'text/markdown',buffer:Buffer.from('模拟故事：候云后进入择路，观众看云海或寻石刻。两条路线分别抵达云海记忆和石刻回声。')});
 await page.getByRole('button',{name:'生成节点草稿',exact:true}).click();await expect(page.locator('.creation-node')).toHaveCount(6);expect(request).toContain('两条路线分别抵达');
 const stateBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);expect(stateBefore.works.some((w:{title:string})=>w.title==='泰山寻碑真实节点验收')).toBe(false);
 await dialog.locator('.creation-node').nth(2).locator('input[type=file]').setInputFiles({name:'云海互动.html',mimeType:'text/html',buffer:Buffer.from('<!doctype html><meta charset="utf-8"><body style="background:#16465a;color:white"><h1>云海之门</h1><button onclick="parent.postMessage({type:\'zhichuang:complete\'},\'*\')">完成探索</button></body>')});
 await dialog.getByRole('button',{name:'创建并进入节点画布',exact:true}).click();await expect(page).toHaveURL(/#\/dream\//);
 const work=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w:{title:string})=>w.title==='泰山寻碑真实节点验收'));
 expect(work.storyNodes).toHaveLength(6);expect(work.storyNodes.find((n:StoryNode)=>n.id==='east').mediaAssetId).toBeTruthy();expect(work.creationPackage.params.scriptText).toContain('模拟故事');
 await page.getByRole('button',{name:'试运行',exact:true}).click();await expect(page.getByText('探索倾向',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'请君入山',exact:true}).click();await page.getByRole('button',{name:'看云海',exact:true}).click();
 await expect(page.frameLocator('iframe[title="登临云海"]').getByRole('heading',{name:'云海之门'})).toBeVisible();await page.frameLocator('iframe[title="登临云海"]').getByRole('button',{name:'完成探索'}).click();await expect(page.getByRole('status')).toContainText('体验已完成');
 await page.getByRole('button',{name:'留下云海记忆',exact:true}).click();await expect(page.locator('.story-preview-body h2')).toHaveText('结局：云海记忆');
 await page.getByRole('button',{name:'体验另一种结局',exact:true}).click();await page.getByRole('button',{name:'请君入山',exact:true}).click();await page.getByRole('button',{name:'寻石刻',exact:true}).click();await page.getByRole('button',{name:'倾听石刻回声',exact:true}).click();await expect(page.locator('.story-preview-body h2')).toHaveText('结局：石刻回声');
 await page.screenshot({path:'output/验收截图/story-real-two-endings.png',animations:'disabled'});
});
test('模型返回坏图不会创建，确认时改坏连接也会明确阻止',async({page})=>{
 let bad=true;await page.route('**/api/ai/chat',route=>route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify(bad?{...plan,edges:plan.edges.filter(e=>e.target!=='west')}:plan)}}));
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'互动影片',exact:true}).click();const dialog=page.getByRole('dialog',{name:'创建互动影片'});
 await dialog.getByLabel('体验流程',{exact:false}).fill('候云，择路，云海和石刻两个结局');await page.getByRole('button',{name:'生成节点草稿',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('不同去向');await expect(page.locator('.creation-node')).toHaveCount(0);
 bad=false;await page.getByRole('button',{name:'生成节点草稿',exact:true}).click();await expect(page.locator('.creation-node')).toHaveCount(6);
 await dialog.getByLabel('择路后续节点',{exact:true}).last().selectOption('east');await expect(dialog.getByRole('alert')).toContainText('不同去向');await expect(page.getByRole('button',{name:'创建并进入节点画布',exact:true})).toBeDisabled();
});

test('Agent 确认离开再继续任务保留节点、连线与素材编辑，不重复请求模型',async({page})=>{
 let calls=0;await page.route('**/api/ai/chat',async route=>{calls++;await route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify(plan)}});});
 await page.getByRole('textbox',{name:'创作需求',exact:true}).fill('创建互动影片：泰山寻碑，观众选择云海与石刻两条路线，分别抵达不同结局。');await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 const dialog=page.locator('.agent-creation-surface');await expect(dialog.locator('.creation-node')).toHaveCount(6);
 await dialog.getByLabel('节点 2 名称',{exact:true}).fill('我修改的择路节点');await dialog.getByLabel('节点 2 内容',{exact:true}).fill('请从两条路径中选一条，修改内容需要保留。');
 await dialog.getByLabel('我修改的择路节点选项文案',{exact:true}).first().fill('去看我修改的云海');
 await dialog.locator('.creation-node').nth(2).locator('input[type=file]').setInputFiles({name:'确认草稿素材.html',mimeType:'text/html',buffer:Buffer.from('<!doctype html><h1>草稿素材</h1>')});await expect(dialog.locator('.creation-node').nth(2).locator('.asset-review-source')).toContainText('确认草稿素材.html');
 const runUrl=page.url();await page.getByRole('link',{name:'首页',exact:true}).click();await page.goto(runUrl);await expect(dialog.locator('.creation-node')).toHaveCount(6);
 await expect(dialog.getByLabel('节点 2 名称',{exact:true})).toHaveValue('我修改的择路节点');await expect(dialog.getByLabel('节点 2 内容',{exact:true})).toHaveValue('请从两条路径中选一条，修改内容需要保留。');await expect(dialog.getByLabel('我修改的择路节点选项文案',{exact:true}).first()).toHaveValue('去看我修改的云海');await expect(dialog.locator('.creation-node').nth(2).locator('.asset-review-source')).toContainText('确认草稿素材.html');expect(calls).toBe(1);
});

test('Agent 分析期间保持右侧确认，完成后离开再继续显示同一草稿',async({page})=>{
 let calls=0,finish:()=>void=()=>{};const released=new Promise<void>(resolve=>{finish=resolve;});
 await page.route('**/api/ai/chat',async route=>{calls++;await released;await route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify(plan)}});});
 await page.getByRole('textbox',{name:'创作需求',exact:true}).fill('创建互动影片：泰山寻碑，云海与石刻两个结局。');await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 const dialog=page.locator('.agent-creation-surface');await expect(dialog.getByRole('button',{name:'正在整理节点…',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);const response=page.waitForResponse('**/api/ai/chat');finish();await response;await expect(dialog.locator('.creation-node')).toHaveCount(6);
 const runUrl=page.url();await page.getByRole('link',{name:'首页',exact:true}).click();await page.goto(runUrl);await expect(dialog.locator('.creation-node')).toHaveCount(6);expect(calls).toBe(1);
});


test('Agent 从完整需求提炼简短作品名，重生成仍保留用户修改的名称',async({page})=>{
 let calls=0;await page.route('**/api/ai/chat',async route=>{calls++;await route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({...plan,title:calls===1?'泰山寻碑':'模型建议的新名称'})}});});
 const prompt='创建互动影片：根据上传脚本制作泰山寻碑故事，让观众在云海与石刻之间选择路线，并体验不同结局。';
 await page.getByRole('textbox',{name:'创作需求',exact:true}).fill(prompt);await page.getByRole('button',{name:'发送创作需求',exact:true}).click();const dialog=page.locator('.agent-creation-surface');await expect(dialog.locator('.creation-node')).toHaveCount(6);
 await dialog.getByRole('button',{name:'调整创作要求',exact:true}).click();await expect(dialog.getByLabel('作品名称',{exact:true})).toHaveValue('泰山寻碑');await expect(dialog.getByLabel('体验流程',{exact:false})).toHaveValue(prompt);await dialog.getByLabel('作品名称',{exact:true}).fill('我命名的泰山之旅');await dialog.getByRole('button',{name:'生成节点草稿',exact:true}).click();await expect(dialog.locator('.creation-node')).toHaveCount(6);
 await dialog.getByLabel('自动生成缺失节点素材',{exact:false}).uncheck();await dialog.getByRole('button',{name:'按此方案生成作品',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('我命名的泰山之旅');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0]);expect(saved.title).toBe('我命名的泰山之旅');expect(calls).toBe(2);
});
