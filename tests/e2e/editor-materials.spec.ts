import {reloadAndReopen} from './reload-helpers';
import {test,expect,type Page} from '@playwright/test';

async function openEditor(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
}
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const work=(page:Page)=>saved(page).then(state=>state.works.find((item:{id:string})=>item.id==='work-1'));
async function chooseFirst(page:Page,scope?:string){
 const dialog=page.getByRole('dialog');
 if(scope)await dialog.getByRole('tab',{name:scope,exact:true}).click();
 await dialog.locator('.material-picker-card').first().click();
 await dialog.getByRole('button',{name:'使用此素材',exact:true}).click();
 await expect(dialog).toHaveCount(0);
}

test('拖入空图片容器，可先调整尺寸再选择素材，支持取消与撤销',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await openEditor(page);const initial=await work(page);
 await page.getByTitle('点击或拖入画布添加图片').dragTo(page.locator('.scene-board'),{targetPosition:{x:110,y:110}});
 const hits=page.locator('.node-hitbox');
 await expect(hits).toHaveCount(initial.pages[0].nodes.length+1);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const placeholder=page.locator('.scene-board .scene-media-placeholder');
 await expect(placeholder).toContainText('添加图片');
 await page.getByRole('spinbutton',{name:'W',exact:true}).fill('620');
 await expect.poll(async()=>(await work(page)).pages[0].nodes.at(-1).w).toBe(620);
 expect((await work(page)).pages[0].nodes.at(-1).src).toBeUndefined();
 await page.getByRole('button',{name:'预览',exact:true}).click();
 await expect(page.locator('.runtime-overlay .scene-media-placeholder')).toHaveCount(0);
 await expect(page.locator('.runtime-overlay .scene-node-image img')).toHaveCount(0);
 await page.getByRole('button',{name:/返回编辑/}).click();
 await hits.last().dblclick();
 await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
 await expect(placeholder).toBeVisible();
 const empty=(await work(page)).pages[0].nodes.at(-1);
 await page.getByRole('button',{name:'添加图片',exact:true}).click();await chooseFirst(page);
 await expect(placeholder).toHaveCount(0);
 await page.getByLabel('素材适配',{exact:true}).selectOption('contain');
 await expect.poll(async()=>(await work(page)).pages[0].nodes.at(-1).mediaFit).toBe('contain');
 const before=(await work(page)).pages[0].nodes.at(-1);
 expect(before).toMatchObject({id:empty.id,x:empty.x,y:empty.y,w:empty.w,h:empty.h});
 expect(before.assetId).toBeTruthy();
 await page.getByRole('button',{name:'替换素材',exact:true}).click();await chooseFirst(page,'共创社区');
 await expect.poll(async()=>(await work(page)).pages[0].nodes.at(-1).assetId).not.toBe(before.assetId);
 const state=await saved(page),after=state.works.find((item:{id:string})=>item.id==='work-1').pages[0].nodes.at(-1);
 const adopted=state.assets.find((asset:{id:string})=>asset.id===after.assetId);
 expect(adopted.public).toBe(false);expect(adopted.origin.assetId).toBeTruthy();
 expect({...after,src:before.src,assetId:before.assetId}).toEqual(before);
 await expect(page.locator('.scene-board .scene-node-image').last().locator('img')).toHaveCSS('object-fit','contain');
 await page.getByTitle('撤销（⌘Z）').click();await expect.poll(async()=>(await work(page)).pages[0].nodes.at(-1).assetId).toBe(before.assetId);
 await page.getByTitle('锁定所选组件').click();await expect(page.getByRole('button',{name:'替换素材',exact:true})).toBeDisabled();
 await page.screenshot({animations:'disabled',path:'output/验收截图/v13-editor-material-replace.png'});
 expect(errors).toEqual([]);
});

test('素材可拖入画布且替换同类型组件，来源切换和1024布局可用',async({page})=>{
 await openEditor(page);
 await page.locator('.component-panel-tabs').getByRole('button',{name:'素材',exact:true}).click();
 const first=page.locator('.editor-material-tile').first();
 await first.dragTo(page.locator('.editor-viewport'),{targetPosition:{x:80,y:120}});
 await expect(page.locator('.node-hitbox')).toHaveCount(6);
 await expect.poll(async()=>(await work(page)).pages[0].nodes.length).toBe(6);
 const before=(await work(page)).pages[0].nodes.at(-1);
 await page.locator('.editor-material-sources').getByRole('button',{name:'共创社区',exact:true}).click();
 const target=page.locator(`[data-hit-node="${before.id}"]`);
 await page.locator('.editor-material-tile').nth(1).dragTo(target);
 await expect(page.locator('.node-hitbox')).toHaveCount(6);
 await expect.poll(async()=>(await work(page)).pages[0].nodes.at(-1).assetId).not.toBe(before.assetId);
 const next=(await work(page)).pages[0].nodes.at(-1);
 expect([next.x,next.y,next.w,next.h]).toEqual([before.x,before.y,before.w,before.h]);
 await page.setViewportSize({width:1024,height:768});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.getByRole('button',{name:'收起组件面板',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'收起组件面板',exact:true}).click();await expect(page.getByRole('button',{name:'展开组件面板',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'展开组件面板',exact:true}).click();
 await page.getByRole('button',{name:'收起属性面板',exact:true}).click();await page.getByRole('button',{name:'展开属性面板',exact:true}).click();
 await expect(page.locator('.editor-material-list')).toBeVisible();
 await page.screenshot({animations:'disabled',path:'output/验收截图/v13-editor-materials-1024.png'});
 await page.getByRole('button',{name:'替换素材',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('tab',{name:'共创社区',exact:true})).toBeInViewport();
 await expect(page.getByRole('dialog').getByRole('button',{name:'使用此素材',exact:true})).toBeInViewport();
 await page.screenshot({animations:'disabled',path:'output/验收截图/v13-editor-picker-1024.png'});
 await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
});

test('背景和条目图片共享素材选择，上传到目标空间并刷新保留',async({page})=>{
 await openEditor(page);const original=await work(page);
 await page.getByRole('button',{name:'替换背景',exact:true}).click();
 await page.getByLabel('上传可用素材',{exact:true}).setInputFiles({name:'编辑器上传背景.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=','base64')});
 await expect(page.getByRole('dialog').getByRole('button',{name:'使用此素材',exact:true})).toBeEnabled();
 await page.getByRole('dialog').getByRole('button',{name:'使用此素材',exact:true}).click();
 await expect.poll(async()=>(await work(page)).pages[0].backgroundImage).toContain('idb:');
 expect((await work(page)).pages[0].nodes).toEqual(original.pages[0].nodes);
 await page.locator('.node-hitbox').nth(3).dblclick();
 await page.getByRole('button',{name:'替换条目图片',exact:true}).first().click();await chooseFirst(page,'共创社区');
 await expect.poll(async()=>(await work(page)).pages[0].nodes[3].items[0].assetId).toBeTruthy();
 await reloadAndReopen(page);await expect(page.locator('.scene-board')).toBeVisible();
 await expect.poll(()=>page.locator('.scene-board .scene-renderer').evaluate(element=>getComputedStyle(element).backgroundImage)).toContain('blob:');
 const state=await saved(page),asset=state.assets.find((item:{name:string})=>item.name==='编辑器上传背景.png');expect(asset.workspaceId).toBe('personal');
});

test('未适配组件不冒充气泡，HTML保留程序嵌入边界',async({page})=>{
 await openEditor(page);
 await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);saved.state.assets.push({id:'unknown-component',name:'未适配新组件',kind:'component',src:'/media/interactive.html',preview:'/media/industrial.svg',description:'',tags:[],author:'纪鸣',source:'generated',createdAt:new Date().toISOString(),workspaceId:'personal'});localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));});
 await reloadAndReopen(page);await page.getByRole('button',{name:'我的组件',exact:true}).click();await expect(page.getByText('未适配新组件',{exact:true})).toHaveCount(0);
 await page.locator('.component-panel-tabs').getByRole('button',{name:'素材',exact:true}).click();
 await expect(page.locator('.editor-material-sources').getByRole('button',{name:'内置',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'打开素材库 / 上传',exact:true}).click();
 const picker=page.getByRole('dialog');
 await picker.locator('.material-picker-card').filter({hasText:'数字星空浏览'}).click();
 await picker.getByRole('button',{name:'使用此素材',exact:true}).click();
 await expect(page.locator('.inspector-content')).toContainText('内部内容需在原程序中修改');
 await expect.poll(async()=>(await work(page)).pages[0].nodes.at(-1).type).toBe('html');
});
