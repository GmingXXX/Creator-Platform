import {test,expect} from '@playwright/test';
test('空选区生成独立素材，插入与项目适配可撤销',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
 await page.getByRole('button',{name:'打开 Agent 助手'}).click();await page.getByRole('button',{name:'生成独立素材'}).click();
 await page.getByLabel('素材需求',{exact:true}).fill('展项的新封面');await page.getByLabel('生成方式').selectOption('sample');
 const count=await page.locator('.scene-board .scene-node').count();
 await page.getByRole('button',{name:'生成素材',exact:true}).click();await expect(page.getByText('已保存至当前空间的素材库')).toBeVisible();
 expect(await page.locator('.scene-board .scene-node').count()).toBe(count);
 await page.getByRole('button',{name:'插入所选位置'}).click();
 await expect(page.locator('.scene-board .scene-node')).toHaveCount(count+1);
 await page.getByRole('button',{name:'关闭 Agent 助手'}).click();
 await page.getByRole('button',{name:'画面尺寸',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'画面尺寸与适配预览'});await dialog.getByRole('button',{name:'竖屏',exact:true}).click();
 await dialog.getByRole('button',{name:'应用画面尺寸'}).click();
 await expect(page.locator('.editor-context-resolution')).toHaveText('1080 × 1920');
 await page.getByTitle('撤销（⌘Z）').click();await expect(page.locator('.editor-context-resolution')).not.toHaveText('1080 × 1920');
});
for(const [route,label] of [['/presentations/work-4','演示'],['/dream/work-6','影片']]){
 test(label+'编辑器支持尺寸预览、应用及撤销，作品预览保持可达',async({page})=>{
  await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
  await page.goto('/#'+route);
  const size=page.getByRole('button',{name:'画面尺寸',exact:true});await size.click();
  let dialog=page.getByRole('dialog',{name:'画面尺寸与适配预览'});
  await dialog.getByRole('button',{name:'方屏'}).click();await dialog.getByRole('button',{name:'应用画面尺寸'}).click();
  await expect(size).toContainText('1080 × 1080');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(size).not.toContainText('1080 × 1080');
  await expect(page.getByRole('button',{name:'查看作品',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'设计风格',exact:true}).click();dialog=page.getByRole('dialog',{name:'项目设计风格'});
  await dialog.getByRole('button',{name:/人文典藏/}).click();await dialog.getByRole('button',{name:'应用项目风格'}).click();
  await expect(page.getByRole('button',{name:'设计风格',exact:true})).toContainText('人文典藏');
  await expect(page.getByRole('button',{name:'预览',exact:true}).first()).toBeVisible();
 });
}
test('编辑器 Agent 收到明确的素材需求后生成独立结果，保留作品',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await page.goto('/#/editor/work-1');await page.getByRole('button',{name:'打开 Agent 助手'}).click();
 await page.getByLabel('修改模型',{exact:true}).selectOption('demo');await page.getByLabel('修改当前作品',{exact:true}).fill('请生成一张用于科技展的封面图片');
 await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect(page.getByText('已保存至当前空间的素材库')).toBeVisible();
 await expect(page.getByLabel('素材类型',{exact:true})).toHaveValue('image');await expect(page.getByRole('button',{name:'插入所选位置'})).toBeVisible();
});
test('编辑器 Agent 为当前页创作背景，采用后保留原有组件',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await page.goto('/#/editor/work-1');await page.getByRole('button',{name:'打开 Agent 助手'}).click();
 const board=page.locator('.scene-board');
 const originalCount=await board.locator('.scene-node').count();
 await page.getByLabel('修改模型',{exact:true}).selectOption('demo');await page.getByLabel('修改当前作品',{exact:true}).fill('生成一张背景素材');
 await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect(page.getByText('已保存至当前空间的素材库')).toBeVisible();
 await page.getByRole('button',{name:/采用为「.+」的背景/}).click();
 await expect(board.locator('.scene-renderer')).toHaveCSS('background-image',/data:image\/svg/);
 await expect(board.locator('.scene-node')).toHaveCount(originalCount);
 const first=await board.locator('.scene-renderer').evaluate(el=>getComputedStyle(el).backgroundImage);
 await page.getByRole('button',{name:'编辑作品',exact:true}).click();await page.getByLabel('修改当前作品',{exact:true}).fill('再暗一点');
 await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await page.getByRole('button',{name:/采用为「.+」的背景/}).click();
 await expect(board.locator('.scene-renderer')).not.toHaveCSS('background-image',first);
 await expect(board.locator('.scene-node')).toHaveCount(originalCount);
});
test('编辑器 Agent 向图片服务提交当前作品、时间轴布局和画幅',async({page})=>{
 const taskId='a'.repeat(32);
 let sent:{prompt:string;size:string}|undefined;
 await page.route('**/api/ai/images',async route=>{
  sent=route.request().postDataJSON();await route.fulfill({json:{id:taskId,status:'queued'}});
 });
 await page.route('**/api/ai/images/'+taskId,route=>route.fulfill({json:{id:taskId,status:'succeeded',url:'/api/ai/media/'+taskId+'.png'}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await page.goto('/#/editor/work-1');const title=await page.getByRole('textbox',{name:'展项名称'}).inputValue();
 const size=await page.locator('.scene-board').evaluate(el=>[el.clientWidth,el.clientHeight].join('*'));
 await page.getByRole('button',{name:'打开 Agent 助手'}).click();await page.getByRole('button',{name:'生成独立素材'}).click();
 await page.getByLabel('素材需求',{exact:true}).fill('依据时间轴生成一张暖金背景图');
 await page.getByLabel('生成方式').selectOption('provider');await page.getByRole('button',{name:'生成素材',exact:true}).click();
 await expect(page.getByRole('button',{name:/采用为「.+」的背景/})).toBeVisible();
 expect(sent?.prompt).toContain(title);expect(sent?.prompt).toContain('1988');expect(sent?.prompt).toContain('暖金');
 expect(sent?.size).toBe(size);
});
