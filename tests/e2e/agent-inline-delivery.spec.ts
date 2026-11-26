import {reloadAndReopen} from './reload-helpers';
import {test,expect,type Page} from '@playwright/test';
async function prepare(page:Page,kind:'presentation'|'story'){
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(kind=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);data.state.runs.unshift({id:'inline-test',workspaceId:'personal',prompt:kind==='story'?'创作一个山间探索互动故事':'根据企业大纲制作智能演示',model:'deepseek-flash',styleId:'technology',skillIds:[],attachmentIds:[],status:'waiting',step:2,outputKind:kind,studioReview:true,createdAt:new Date().toISOString()});localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));},kind);
 await page.reload();await page.goto('/#/create/inline-test');
}
function mockMedia(page:Page){let requests=0;const prompts:string[]=[];
 page.route('**/api/ai/images',route=>{requests++;prompts.push(route.request().postDataJSON().prompt);return route.fulfill({json:{id:requests.toString(16).padStart(32,'0'),status:'pending'}});});
 page.route('**/api/ai/images/*',route=>{const id=route.request().url().split('/').pop();return route.fulfill({json:{id,status:'succeeded',url:`/api/ai/media/${id}.png`}});});
 page.route('**/api/ai/media/*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5uoAAAAASUVORK5CYII=','base64')}));
 page.route('**/api/ai/speech',route=>route.fulfill({json:{url:'/api/ai/audio/test.wav'}}));
 return {count:()=>requests,prompts};
}
test('Agent智能演示在右侧确认和生成，配图及语音完成后仍留成果页',async({page})=>{
 const media=mockMedia(page);await page.route('**/api/ai/chat',route=>route.fulfill({json:{content:JSON.stringify({title:'企业能力',sections:[{title:'我们是谁',bullets:['企业简介'],narration:'欢迎了解企业',layout:'title'},{title:'核心能力',bullets:['产品创新'],narration:'我们关注产品创新',layout:'split'}]})}}));
 await prepare(page,'presentation');await page.getByRole('button',{name:'展开全部',exact:true}).click();await expect(page.getByLabel('第2页正文要点')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.locator('.asset-review').first().getByRole('button',{name:'AI 生成',exact:true}).click();await page.getByLabel('素材生成提示词').fill('蓝青色工厂概念图，右侧留白');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('企业能力');await expect(page).toHaveURL(/#\/create\/inline-test$/);
 expect(media.count()).toBe(2);expect(media.prompts[0]).toContain('蓝青色工厂概念图');
 const result=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;return state.works.find((work:any)=>work.id===state.runs[0].workId);});expect(result.pages).toHaveLength(2);expect(result.pages.every((p:any)=>p.nodes.some((n:any)=>n.type==='image'))).toBe(true);expect(JSON.parse(result.creationPackage.params.presentationStudio).pages[result.pages[0].id].sentences[0]).toMatchObject({audioUrl:'/api/ai/audio/test.wav',audioText:'欢迎了解企业'});
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);
});
test('Agent故事由文字生成节点素材，完成后先在右侧运行分支',async({page})=>{
 const media=mockMedia(page);await page.route('**/api/ai/chat',route=>route.fulfill({json:{content:JSON.stringify({title:'山间探索',nodes:[{id:'s',type:'start',title:'山门',text:'从山门出发'},{id:'e',type:'end',title:'山顶',text:'抵达山顶'}],edges:[{source:'s',target:'e',label:'沿路前进'}]})}}));
 await prepare(page,'story');await expect(page.locator('.creation-node')).toHaveCount(2);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByLabel('节点 1 素材描述').fill('青山山门，水墨风格');await page.getByRole('button',{name:'按此方案生成作品',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('山间探索');await expect(page).toHaveURL(/#\/create\/inline-test$/);expect(media.count()).toBe(2);expect(media.prompts[0]).toContain('青山山门');
 await page.locator('.story-experience').getByRole('button',{name:'沿路前进',exact:true}).click();await expect(page.locator('.story-preview-body h2')).toHaveText('山顶');
});
test('确认草稿返回后恢复编辑及素材绑定，不重复调用策划模型',async({page})=>{
 let calls=0;mockMedia(page);await page.route('**/api/ai/chat',route=>{calls++;return route.fulfill({json:{content:JSON.stringify({title:'可恢复演示',sections:[{title:'初始标题',bullets:['初始要点'],narration:'初始讲稿',layout:'title'}]})}});});
 await prepare(page,'presentation');await page.getByLabel('第1页标题').fill('用户修改标题');await page.locator('.asset-review').first().getByRole('button',{name:'AI 生成',exact:true}).click();await page.getByLabel('素材生成提示词').fill('用户修改配图描述');await page.keyboard.press('Escape');
 await page.locator('.asset-review').getByRole('button',{name:'AI 生成',exact:true}).click();await page.getByRole('button',{name:'生成图片',exact:true}).click();await expect(page.getByRole('button',{name:'采用此素材',exact:true})).toBeEnabled();await page.getByRole('button',{name:'采用此素材',exact:true}).click();await expect(page.locator('.asset-review-source')).toContainText('AI 生成');
 await reloadAndReopen(page);await expect(page.getByLabel('第1页标题')).toHaveValue('用户修改标题');await page.locator('.asset-review').first().getByRole('button',{name:'AI 生成',exact:true}).click();await expect(page.getByLabel('素材生成提示词')).toHaveValue('用户修改配图描述');await page.keyboard.press('Escape');await expect(page.locator('.asset-review-source')).toContainText('AI 生成');expect(calls).toBe(1);
 await page.screenshot({path:'output/agent-inline-confirmation.png',fullPage:true});
});
test('设计风格在真实页面中预览并应用到生成作品',async({page})=>{
 await prepare(page,'presentation');await page.goto('/#/');
 await page.getByRole('button',{name:'新建作品',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'智能演示',exact:true}).click();
 await page.getByRole('button',{name:'选择设计风格'}).click();
 const style=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.systems.find((s:{id:string})=>s.id==='industrial'));
 await page.locator('.presentation-style-choices').getByRole('button',{name:new RegExp(style.name)}).click();
 await expect(page.locator('.presentation-style-preview')).toContainText(style.name);
 await page.getByRole('button',{name:'使用此风格'}).click();
 await expect(page.getByRole('button',{name:'选择设计风格'})).toContainText(style.name);
 await page.getByLabel('你想讲述什么？',{exact:true}).fill('风格测试');
 await page.getByLabel('生成模型',{exact:true}).selectOption('demo');
 await page.getByRole('button',{name:'生成大纲',exact:true}).click();
 await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);
 const applied=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0].styleId);expect(applied).toBe(style.id);
});
test('Agent互动影片自动生成场景视频并保留最终节点绑定',async({page})=>{
 const media=mockMedia(page);let videos=0;await page.route('**/api/ai/videos',route=>{videos++;expect(route.request().postDataJSON().referenceImage).toMatch(/\/api\/ai\/media\//);return route.fulfill({json:{id:'f'.repeat(32),workspaceId:'personal',status:'succeeded',url:`/api/ai/video-media/${'f'.repeat(32)}.mp4`,duration:5,size:'1280*720'}});});
 await page.route('**/api/ai/chat',route=>route.fulfill({json:{content:JSON.stringify({title:'山间影片',nodes:[{id:'s',type:'start',title:'入口',text:'起点'},{id:'v',type:'scene',title:'山间镜头',text:'漫游山间'},{id:'e',type:'end',title:'结束',text:'终点'}],edges:[{source:'s',target:'v',label:'进入山间'},{source:'v',target:'e',label:'完成旅程'}]})}}));
 await prepare(page,'story');await expect(page.locator('.creation-node')).toHaveCount(3);await page.getByRole('button',{name:'按此方案生成作品',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('山间影片');expect(videos).toBe(1);expect(media.count()).toBe(3);
 const result=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;return state.works.find((w:any)=>w.id===state.runs[0].workId);});expect(result.storyNodes.find((n:any)=>n.title==='山间镜头').media).toMatch(/video-media\/f+\.mp4/);
});
for(const kind of ['presentation','story'] as const)test(`Agent ${kind}补充参考资料刷新后仍用于规划及最终作品`,async({page})=>{
 const requests:string[]=[];mockMedia(page);await page.route('**/api/ai/chat',route=>{requests.push(JSON.stringify(route.request().postDataJSON()));const plan=kind==='presentation'?{title:'资料恢复验收',sections:[{title:'概况',bullets:['资料内容'],narration:'介绍补充资料。',layout:'title'}]}:{title:'资料恢复验收',nodes:[{id:'s',type:'start',title:'开始',text:'启程'},{id:'e',type:'end',title:'结束',text:'抵达'}],edges:[{source:'s',target:'e',label:'继续'}]};return route.fulfill({json:{content:JSON.stringify(plan)}});});
 await prepare(page,kind);const surface=page.locator('.agent-creation-surface');await expect(surface.getByRole('button',{name:kind==='presentation'?'开始生成':'按此方案生成作品',exact:true})).toBeVisible();
 await surface.getByRole('button',{name:'调整创作要求',exact:true}).click();await surface.locator('input[type=file]').first().setInputFiles({name:'新增参考资料.txt',mimeType:'text/plain',buffer:Buffer.from('新增参考事实：蓝鲸计划于2028年启动，编号TEST-NEW-SOURCE。')});await expect(surface.locator('.creation-source-file')).toContainText('已解析');
 await reloadAndReopen(page);await expect(surface.locator('.creation-source-file')).toContainText('新增参考资料.txt');expect(requests).toHaveLength(1);
 await surface.getByRole('button',{name:kind==='presentation'?'生成大纲':'生成节点草稿',exact:true}).click();await expect(surface.getByRole('button',{name:kind==='presentation'?'开始生成':'按此方案生成作品',exact:true})).toBeVisible();expect(requests.at(-1)).toContain('TEST-NEW-SOURCE');
 await reloadAndReopen(page);await expect(surface.getByRole('button',{name:kind==='presentation'?'开始生成':'按此方案生成作品',exact:true})).toBeVisible();expect(requests).toHaveLength(2);
 await surface.getByRole('button',{name:'调整创作要求',exact:true}).click();await expect(surface.locator('.creation-source-file')).toContainText('新增参考资料.txt');await surface.getByRole('button',{name:kind==='presentation'?'生成大纲':'生成节点草稿',exact:true}).click();await expect(surface.getByRole('button',{name:kind==='presentation'?'开始生成':'按此方案生成作品',exact:true})).toBeVisible();expect(requests.at(-1)).toContain('TEST-NEW-SOURCE');
 await surface.locator('.generation-delivery-status input[type=checkbox]').uncheck();await surface.getByRole('button',{name:kind==='presentation'?'开始生成':'按此方案生成作品',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('资料恢复验收');
 const pkg=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;return state.works.find((work:any)=>work.id===state.runs[0].workId).creationPackage;});expect(pkg.files.some((file:any)=>file.name==='新增参考资料.txt')).toBe(true);expect(pkg.params[kind==='presentation'?'referenceText':'scriptText']).toContain('TEST-NEW-SOURCE');
});
