import {test,expect} from '@playwright/test';
test('当前项目选择预设、录制独立的位置关键帧并回到原始布局',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
 await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
 await page.locator('.node-hitbox').nth(1).click();await page.locator('.inspector-tabs').getByRole('button',{name:'动效',exact:true}).click();
 const motion=page.locator('.inspector-content .project-motion');
 await motion.locator('label').filter({hasText:/^效果/}).getByRole('button').click();
 const library=page.getByRole('dialog',{name:'选择动效'});await library.getByPlaceholder('搜索动效').fill('淡入');await library.getByRole('button',{name:'淡入',exact:true}).click();await library.getByRole('button',{name:'应用所选效果'}).click();
 await motion.getByRole('button',{name:'精调时间轴'}).click();const timeline=page.getByRole('dialog',{name:'精调动效时间轴'});
 await timeline.getByLabel('播放头 s').fill('0.8');await timeline.getByText('水平移动',{exact:true}).locator('..').getByRole('spinbutton').fill('50');
 await expect(timeline.getByRole('button',{name:'水平移动关键帧'})).toHaveText('◆');
 await timeline.getByRole('button',{name:'完成编辑'}).click();
 await motion.getByRole('button',{name:'交互预览',exact:true}).click();
 const overlay=page.locator('.runtime-overlay');await expect(overlay).toBeVisible();const target=overlay.locator('.scene-node').nth(1);await target.click({force:true});
 await expect.poll(()=>target.locator('.scene-node-inner').evaluate(el=>{const t=getComputedStyle(el).transform;return t==='none'?0:new DOMMatrix(t).m41})).toBeGreaterThan(3);
 await page.getByRole('button',{name:/返回编辑/}).click();await expect(page.locator('.scene-board .scene-node').nth(1).locator('.scene-node-inner')).toHaveCSS('transform','none');
});
test('交互规则的跳页转场在真实预览同时呈现两页并完成导航',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
 await page.evaluate(()=>{
  const store=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),w=store.state.works.find((x:{id:string})=>x.id==='work-1'),p=w.pages[0],base=p.nodes[0];
  const link={...base,id:'button-next',type:'button',name:'看下一站',content:'看下一站',interactions:[{id:'open',event:'click',action:'navigate',targetId:'second'}],motion:{preset:'无动效',duration:.6,delay:0,easing:'linear',hold:false,sequences:[{binding:'open',when:'before',hold:false,joins:[],clips:[{id:'cross',target:'second',track:0,start:0,duration:.9,preset:'交叉淡化',speed:'linear',keys:{opacity:[{t:0,v:0},{t:.9,v:1}]}}]}]}};
  w.pages=[{...p,nodes:[link]},{...p,id:'second',name:'第二站',nodes:[{...base,id:'arrived',type:'text',content:'已经到达第二站'}]}];localStorage.setItem('zhichuang-studio-v1',JSON.stringify(store));
 });
 await page.goto('/#/editor/work-1');await page.reload();await expect(page.locator('.scene-board')).toBeVisible();
 await page.locator('.editor-toolbar').getByRole('button',{name:/预览/}).first().click();const runtime=page.locator('.runtime-overlay');
 await runtime.getByRole('button',{name:'看下一站',exact:true}).first().click();
 await expect(runtime.locator('.motion-page-transition')).toBeVisible();await expect(runtime.locator('[data-incoming]')).toContainText('已经到达第二站');await expect(runtime.locator('.motion-page-transition')).toHaveCount(0);
 await expect(runtime).toContainText('已经到达第二站');
});
