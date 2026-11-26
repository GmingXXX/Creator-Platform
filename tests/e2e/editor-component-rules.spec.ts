import {test,expect,type Page} from '@playwright/test';
import {reloadAndReopen} from './reload-helpers';
async function open(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
}
test('画布双击、手动命名、置底与两处素材筛选',async({page})=>{
 await open(page);await page.getByTitle('点击或拖入画布添加文本').click();
 const hit=page.locator('.node-hitbox.selected');await hit.dblclick();await page.getByLabel('画布文字').fill('测试展项');await page.getByLabel('画布文字').press('Control+Enter');
 await page.getByRole('button',{name:/^图层\s*\d/}).click();const row=page.locator('.layer-row').filter({hasText:'测试展项'});await row.locator('.layer-select span').dblclick();await page.getByLabel('图层名称').fill('封面主标题');await page.getByLabel('图层名称').press('Enter');
 const renamed=page.locator('.layer-row').filter({hasText:'封面主标题'});await renamed.locator('.layer-select').focus();await page.keyboard.press('Alt+End');await expect(page.locator('.layer-row').last()).toContainText('封面主标题');
 await page.getByRole('button',{name:'素材',exact:true}).first().click();await page.locator('.editor-materials-panel').getByLabel('素材类型',{exact:true}).selectOption('video');await page.getByRole('button',{name:'共创社区',exact:true}).click();await expect(page.locator('.editor-materials-panel').getByLabel('素材类型',{exact:true})).toHaveValue('video');
});
test('指定卡片作为点击继续的条件和全部读完触发是不同体验',async({page})=>{
 await open(page);await page.evaluate(()=>{
 const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),w=saved.state.works.find((x:any)=>x.id==='work-1'),p=w.pages[0],base=p.nodes[0];
 p.nodes=[{...base,id:'cards',type:'card',name:'两张卡',x:20,y:20,w:700,h:850,items:[{id:'aa',title:'甲卡',description:'甲说明'},{id:'bb',title:'乙卡',description:'乙说明'}],interactions:[]},{...base,id:'continue',type:'button',name:'继续',content:'继续',x:900,y:300,w:250,h:100,interactions:[{id:'go',event:'click',requiredVisitedIds:['aa','bb'],action:'navigate',targetId:'second'}]}];w.pages=[p,{...p,id:'second',name:'第二页',interactions:[{id:'idle',event:'idle',seconds:60,action:'navigate',targetId:p.id}],nodes:[{...base,type:'text',content:'阅读已完成'}]}];
 localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));});
 await reloadAndReopen(page);await page.locator('.editor-toolbar').getByRole('button',{name:/预览/}).first().click();
 const runtime=page.locator('.runtime-overlay');await runtime.getByRole('button',{name:'继续',exact:true}).click();await runtime.getByText('交互测试',{exact:true}).click();await expect(runtime).toContainText('还需点开 2 张卡片');
 for(const title of ['甲卡','乙卡']){await runtime.getByRole('button',{name:new RegExp(title)}).click();await runtime.getByRole('button',{name:'关闭详情'}).click()}
 await expect(runtime.getByRole('button',{name:'继续',exact:true})).toBeVisible();await runtime.getByRole('button',{name:'继续',exact:true}).click();await expect(runtime).toContainText('阅读已完成');
 await runtime.getByRole('button',{name:'模拟空闲 60 秒'}).click();await expect(runtime.getByRole('button',{name:'继续',exact:true})).toBeVisible();
});
test('卡片全部读完自动翻页，重播指令可以改为展项口令',async({page})=>{
 await open(page);await page.evaluate(()=>{
 const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),work=saved.state.works.find((x:any)=>x.id==='work-1'),p=work.pages[0],base=p.nodes[0];
 p.nodes=[{...base,id:'gallery',type:'card',name:'影片目录',x:20,y:20,w:700,h:900,items:[{id:'a',title:'第一张',description:'一'},{id:'b',title:'第二张',description:'二'}],interactions:[]}];
 p.interactions=[{id:'read',event:'allVisited',watchedIds:['a','b'],action:'navigate',targetId:'watch'}];work.pages=[p,{...p,id:'watch',name:'影片',interactions:[],nodes:[{...base,id:'v',type:'video',name:'祖冲之视频',src:'/media/demo-loop.mp4',x:200,y:80,w:1000,h:650,commands:[],interactions:[]}]}];
 localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));});
 await reloadAndReopen(page);await page.locator('.editor-toolbar').getByRole('button',{name:'预览',exact:true}).click();
 const runtime=page.locator('.runtime-overlay');for(const name of ['第一张','第一张']){await runtime.getByRole('button',{name:new RegExp(name)}).click();await runtime.getByRole('button',{name:'关闭详情'}).click()}
 await runtime.getByRole('button',{name:/第二张/}).click();await expect(runtime.locator('video')).toBeVisible();
 await runtime.getByRole('button',{name:/返回编辑/}).click();await page.locator('.page-tabs').getByRole('button',{name:/影片/}).click();await page.locator('.node-hitbox').click();await page.getByRole('button',{name:'语音指令',exact:true}).click();
 const alias=page.getByLabel('自定义说法 重新播放视频',{exact:true});await alias.fill('请祖冲之讲一讲圆周率');await alias.press('Enter');
 await page.getByLabel('测试输入',{exact:true}).fill('请祖冲之讲一讲圆周率');await page.getByRole('button',{name:'运行命令测试'}).click();await expect(runtime.locator('.scene-command-status')).toContainText('已匹配');await expect.poll(()=>runtime.locator('video').evaluate((el:HTMLVideoElement)=>el.currentTime)).toBeGreaterThan(0);
});
