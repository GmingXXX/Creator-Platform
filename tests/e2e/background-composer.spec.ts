import {test,expect,type Page} from '@playwright/test';
import {useDemoModel} from './home-helpers';
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function create(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await page.getByRole('textbox',{name:'创作需求'}).fill('制作企业大事记时间轴交互页面');await useDemoModel(page);await page.getByRole('button',{name:'发送创作需求'}).click();
 await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible({timeout:20000});
}
test('默认完成完整页面，背景可编辑描述、预览、采用并保留版本',async({page})=>{
 const submissions:any[]=[];let ready=false;
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/ai/media/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#24344b"/></svg>'});
  let value:any={models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}};
  if(path==='/api/ai/images'){submissions.push(route.request().postDataJSON());value={id:`bg-${submissions.length}`,status:'queued'};}
  if(path.startsWith('/api/ai/images/'))value={id:`bg-${submissions.length}`,status:ready?'succeeded':'running',url:ready?`/api/ai/media/bg-${submissions.length}.png`:undefined};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
 });
 await create(page);await expect(page.getByRole('button',{name:'生成并继续',exact:true})).toHaveCount(0);
 const before=await state(page),id=before.runs[0].workId,original=before.works.find((w:any)=>w.id===id);
 await page.getByRole('button',{name:'生成背景',exact:true}).click();const dialog=page.getByRole('dialog',{name:'生成与调整背景'});
 await expect(dialog.getByLabel('画面描述')).not.toBeEmpty();await dialog.getByLabel('画面描述').fill('深蓝背景，右侧几何光影，左侧充分留白，无文字');await dialog.getByRole('button',{name:'生成预览',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'正在生成',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'稍后再看'}).click();ready=true;
 await expect.poll(async()=> (await state(page)).runs[0].backgroundDraft.status).toBe('ready');
 expect((await state(page)).works.find((w:any)=>w.id===id)).toEqual(original);expect(submissions).toHaveLength(1);expect(submissions[0].prompt).toContain('充分留白');
 await page.getByRole('button',{name:'生成背景',exact:true}).click();await expect(dialog.getByLabel('完整展项预览')).toContainText('企业');
 await page.screenshot({path:'output/background-composer-preview.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'采用这张背景'}).click();const adopted=(await state(page)).works.find((w:any)=>w.id===id);
 expect(adopted.pages[0].nodes).toEqual(original.pages[0].nodes);expect(adopted.pages[0].backgroundImage).toBe('/api/ai/media/bg-1.png');
 await page.getByRole('button',{name:'生成背景',exact:true}).click();await dialog.getByLabel('画面描述').fill('保留深蓝构图，让背景更暗、减少装饰');await dialog.getByRole('button',{name:'生成新版本'}).click();await expect(dialog.getByRole('button',{name:'版本 2',exact:true})).toBeVisible();
 expect((await state(page)).works.find((w:any)=>w.id===id).pages[0].backgroundImage).toBe('/api/ai/media/bg-1.png');
 expect(submissions[1].idempotencyKey).not.toBe(submissions[0].idempotencyKey);await dialog.getByRole('button',{name:'版本 1 · 已采用'}).click();await expect(dialog.getByLabel('画面描述')).toHaveValue('深蓝背景，右侧几何光影，左侧充分留白，无文字');
});

for(const [width,height] of [[1080,1920],[3840,960]])test(`完整背景预览适应 ${width}×${height}`,async({page})=>{
 await page.route('**/api/ai/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({models:[],configured:{deepseek:false,image:false}})}));
 await create(page);const url=page.url();
 await page.evaluate(({width,height})=>{const record=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);const id=record.state.runs[0].workId;record.state.works=record.state.works.map((w:any)=>w.id===id?{...w,width,height}:w);localStorage.setItem('zhichuang-studio-v1',JSON.stringify(record));},{width,height});
 await page.reload();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();await page.goto(url);await page.getByRole('button',{name:'生成背景',exact:true}).click();
 const outer=page.getByLabel('完整页面背景预览'),inner=outer.locator('.current-work-preview');
 await expect.poll(async()=>{const a=await outer.boundingBox(),b=await inner.boundingBox();return a&&b?Math.abs(a.height-b.height):999;}).toBeLessThan(4);
 const box=await outer.boundingBox();expect(box!.width/box!.height).toBeCloseTo(width/height,1);await page.screenshot({path:`output/background-preview-${width}.png`,animations:'disabled'});
});
