import {test,expect} from '@playwright/test';
import {reloadAndReopen} from './reload-helpers';
test.beforeEach(async({page})=>{
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await page.getByRole('textbox',{name:'创作需求',exact:true}).waitFor();
});
test('新建只选择设计风格，缩略选择和大预览不横向溢出',async({page})=>{
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();
 await expect(page.getByText('选择模板',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'选择设计风格',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'选择设计风格'});await expect(modal).toBeVisible();await modal.locator('.presentation-style-choices>button').nth(2).click();
 const name=await modal.locator('.presentation-style-choices>button[aria-pressed=true] strong').innerText();await expect(modal.locator('.presentation-style-preview>strong')).toHaveText(name);
 expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect(modal.locator('.slide-surface')).toBeVisible();await page.setViewportSize({width:600,height:850});expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'output/presentation-style-narrow.png'});await modal.getByRole('button',{name:'使用此风格'}).click();await expect(page.getByRole('button',{name:'选择设计风格',exact:true})).toContainText(name);
});
test('文字属性直接修改、拖动缩放并保存后保留',async({page})=>{
 await page.goto('/#/presentations/work-4');await page.getByRole('button',{name:'文字',exact:true}).click();
 const node=page.locator('.slide-edit-stage').getByRole('button',{name:'选择元素 新增文字',exact:true});await expect(node).toBeVisible();
 await page.getByLabel('字体',{exact:true}).selectOption('serif');await page.getByLabel('字号',{exact:true}).fill('64');await page.getByLabel('字重',{exact:true}).selectOption('700');await page.getByLabel('对齐',{exact:true}).selectOption('center');await page.getByLabel('行距',{exact:true}).fill('1.8');
 await expect(node).toHaveCSS('font-family','serif');await expect(node).toHaveCSS('font-size','64px');await expect(node).toHaveCSS('font-weight','700');await expect(node).toHaveCSS('text-align','center');
 const oldX=Number(await page.getByLabel('X 坐标',{exact:true}).inputValue());const bounds=(await node.boundingBox())!;await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+40,bounds.y+bounds.height/2+20,{steps:4});await page.mouse.up();expect(Number(await page.getByLabel('X 坐标',{exact:true}).inputValue())).toBeGreaterThan(oldX);
 const width=Number(await page.getByLabel('宽度',{exact:true}).inputValue());const handle=page.getByRole('button',{name:'缩放 新增文字 se',exact:true}),h=(await handle.boundingBox())!;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+40,h.y+30,{steps:4});await page.mouse.up();expect(Number(await page.getByLabel('宽度',{exact:true}).inputValue())).toBeGreaterThan(width);
 await page.getByRole('button',{name:'保存',exact:true}).click();await reloadAndReopen(page);await page.locator('.slide-edit-stage').getByRole('button',{name:'选择元素 新增文字',exact:true}).click();await expect(page.getByLabel('字体',{exact:true})).toHaveValue('serif');await expect(page.getByLabel('字号',{exact:true})).toHaveValue('64');
 await page.screenshot({path:'output/presentation-editing-text.png',fullPage:true});
});

test('添加图片支持移动和等比缩放，重开保留布局',async({page})=>{
 await page.goto('/#/presentations/work-4');await page.getByRole('button',{name:'图片 / 视频',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'从素材库选择图片或视频'});await picker.locator('input[type=file]').setInputFiles('public/demo-inputs/v3/presentation/01-enterprise.png');await picker.getByRole('button',{name:'使用此素材',exact:true}).click();
 const selected=page.locator('.slide-edit-stage .slide-element.selected');await expect(selected).toHaveClass(/slide-image/);const label=await selected.getAttribute('aria-label');
 const oldX=Number(await page.getByLabel('X 坐标',{exact:true}).inputValue()),width=Number(await page.getByLabel('宽度',{exact:true}).inputValue()),height=Number(await page.getByLabel('高度',{exact:true}).inputValue());const bounds=(await selected.boundingBox())!;await page.mouse.move(bounds.x+30,bounds.y+30);await page.mouse.down();await page.mouse.move(bounds.x+65,bounds.y+45,{steps:4});await page.mouse.up();expect(Number(await page.getByLabel('X 坐标',{exact:true}).inputValue())).toBeGreaterThan(oldX);
 const handle=selected.locator('.slide-resize-handle').last(),h=(await handle.boundingBox())!;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+45,h.y+20,{steps:4});await page.mouse.up();const nextWidth=Number(await page.getByLabel('宽度',{exact:true}).inputValue()),nextHeight=Number(await page.getByLabel('高度',{exact:true}).inputValue());expect(nextWidth).toBeGreaterThan(width);expect(nextWidth/nextHeight).toBeCloseTo(width/height,2);
 await page.getByRole('button',{name:'保存',exact:true}).click();await reloadAndReopen(page);await page.locator('.slide-edit-stage').getByRole('button',{name:label!,exact:true}).click();await expect(page.getByLabel('宽度',{exact:true})).toHaveValue(String(nextWidth));await expect(page.getByLabel('高度',{exact:true})).toHaveValue(String(nextHeight));
});
test('复合组件标题与正文可分别设置字体',async({page})=>{
 await page.goto('/#/presentations/work-4');const component=page.locator('.slide-edit-stage .slide-element').filter({has:page.locator('.slide-data-grid')}).first();await component.click();
 await page.getByLabel('文字范围',{exact:true}).selectOption('titleStyle');await page.getByLabel('字体',{exact:true}).selectOption('serif');await page.getByLabel('字号',{exact:true}).fill('52');await expect(component.locator('.slide-data-grid b').first()).toHaveCSS('font-family','serif');await expect(component.locator('.slide-data-grid b').first()).toHaveCSS('font-size','52px');
 await page.getByLabel('文字范围',{exact:true}).selectOption('bodyStyle');await page.getByLabel('字体',{exact:true}).selectOption('monospace');await page.getByLabel('字号',{exact:true}).fill('26');await expect(component.locator('.slide-data-grid small').first()).toHaveCSS('font-family','monospace');await expect(component.locator('.slide-data-grid small').first()).toHaveCSS('font-size','26px');await expect(component.locator('.slide-data-grid b').first()).toHaveCSS('font-family','serif');
});
test('自定义风格预览和实际新建成果使用相同配色与字体',async({page})=>{
 await page.evaluate(()=>{const key='zhichuang-studio-v1',data=JSON.parse(localStorage.getItem(key)!);data.state.systems=[...data.state.systems,{...data.state.systems[0],id:'custom-verification',name:'自定义验收风格',background:'#123456',text:'#eeeeee',accent:'#abcdef',font:'宋体与现代黑体'}];localStorage.setItem(key,JSON.stringify(data));});await page.reload();
 await page.route('**/api/ai/chat',route=>route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({title:'自定义风格作品',sections:[{title:'自定义风格验证',bullets:['验证实际字体与配色'],narration:'这是一份演示讲稿。',layout:'bullets'}]})}}));
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();await page.getByLabel('你想讲述什么？',{exact:true}).fill('自定义风格作品');
 await page.getByRole('button',{name:'选择设计风格',exact:true}).click();const dialog=page.getByRole('dialog',{name:'选择设计风格'});await dialog.locator('.presentation-style-choices>button').filter({hasText:'自定义验收风格'}).click();await dialog.getByRole('button',{name:'使用此风格'}).click();
 await page.getByRole('button',{name:'生成大纲',exact:true}).click();await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);
 const title=page.locator('.slide-edit-stage').getByRole('button',{name:'选择元素 主标题',exact:true});await expect(title).toHaveCSS('font-family','"Songti SC", SimSun, serif');await expect(title).toHaveCSS('color','rgb(238, 238, 238)');await expect(page.locator('.slide-edit-stage .slide-surface')).toHaveCSS('background-color','rgb(18, 52, 86)');
});
