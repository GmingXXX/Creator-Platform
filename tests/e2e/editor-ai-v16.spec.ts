import {reloadAndReopen} from './reload-helpers';
import {expect,test,type Page,type Route} from '@playwright/test';
const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function open(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
}
test('空白页面真实 AI 新增组件，失败保留输入，成功可撤销',async({page})=>{
 let calls=0,fail=true;
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}});
  if(path.endsWith('/chat')){calls++;const body=route.request().postDataJSON(),ctx=JSON.parse(body.messages.at(-1).content);expect(body.model).toBe('deepseek-flash');expect(ctx.target.scope).toBe('page');
   return fail?json(route,{error:'模型暂时不可用，稍后再试'},503):json(route,{model:'deepseek-flash',content:JSON.stringify({summary:'已添加原生文本组件',patches:[{kind:'add-node',pageId:ctx.target.pageId,changes:{type:'text',name:'企业标题',content:'创新创造未来',fontSize:56,x:80,y:100,w:1000,h:100}}]})});}
  return json(route,{error:'测试阻止未预期请求'},503);
 });
 await open(page);
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);data.state.works=data.state.works.map((w:any)=>w.id==='work-1'?{...w,aiModel:undefined,pages:w.pages.map((p:any)=>({...p,nodes:[]}))}:w);localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));});
 await reloadAndReopen(page);await expect(page.locator('.scene-board')).toBeVisible();await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
 await expect(page.getByLabel('修改模型',{exact:true})).toHaveValue('deepseek-flash');const input=page.getByLabel('修改当前作品',{exact:true});await input.fill('添加标题，内容为创新创造未来');await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('模型暂时不可用');await expect(input).toHaveValue('添加标题，内容为创新创造未来');expect((await state(page)).works.find((w:any)=>w.id==='work-1').pages[0].nodes).toHaveLength(0);
 fail=false;await page.getByRole('button',{name:'发送修改',exact:true}).click();await expect(page.locator('.scene-board')).toContainText('创新创造未来');expect(calls).toBe(2);
 await page.getByRole('button',{name:'撤销本次修改',exact:true}).click();await expect(page.locator('.scene-board .scene-node-text')).toHaveCount(0);
});
test('画布生图先预览再应用背景，查询不重复提交，前景组件保持不变',async({page})=>{
 const id='b'.repeat(32);let posts=0,queries=0;
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}});
  if(path==='/api/ai/images'){posts++;return json(route,{id,status:'pending'});}
  if(path===`/api/ai/images/${id}`){queries++;return json(route,{id,status:'succeeded',url:`/api/ai/media/${id}.png`});}
  if(path===`/api/ai/media/${id}.png`)return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=','base64')});
  return json(route,{error:'测试阻止未预期请求'},503);
 });
 await open(page);const before=(await state(page)).works.find((w:any)=>w.id==='work-1');
 await page.getByRole('button',{name:'生成新背景',exact:true}).click();await page.getByLabel('图片生成描述',{exact:true}).fill('工业蓝展厅背景，没有文字');await page.getByRole('button',{name:'生成候选图片',exact:true}).click();
 await expect(page.getByRole('button',{name:'应用到当前背景',exact:true})).toBeVisible();expect(posts).toBe(1);expect(queries).toBeGreaterThan(0);await expect(page.getByAltText('生成的候选图片')).toBeVisible();await page.screenshot({path:'/tmp/zc-ai-v16-candidate.png'});
 const pending=(await state(page)).works.find((w:any)=>w.id==='work-1');expect(pending.pages).toEqual(before.pages);
 await page.getByRole('button',{name:'应用到当前背景',exact:true}).click();await expect.poll(async()=>(await state(page)).works.find((w:any)=>w.id==='work-1').pages[0].backgroundImage).toBe(`/api/ai/media/${id}.png`);
 const after=(await state(page)).works.find((w:any)=>w.id==='work-1');expect(after.pages[0].nodes).toEqual(before.pages[0].nodes);
 expect((await state(page)).assets.some((a:any)=>a.id===`asset-editor-image-${id}`)).toBe(true);
});

test('生图任务刷新后继续查询原任务，不重复生成',async({page})=>{
 const id='c'.repeat(32);let posts=0,done=false;
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}});
  if(path==='/api/ai/images'){posts++;return json(route,{id,status:'pending'});}
  if(path===`/api/ai/images/${id}`)return json(route,done?{id,status:'succeeded',url:`/api/ai/media/${id}.png`}:{id,status:'running'});
  if(path===`/api/ai/media/${id}.png`)return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=','base64')});
  return json(route,{error:'测试阻止未预期请求'},503);
 });
 await open(page);await page.getByRole('button',{name:'生成新背景',exact:true}).click();await page.getByLabel('图片生成描述',{exact:true}).fill('未来工厂背景');await page.getByRole('button',{name:'生成候选图片',exact:true}).click();
 await expect(page.getByRole('button',{name:'暂停查询',exact:true})).toBeVisible();
 await expect.poll(async()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('zc-editor-image:')).some(key=>JSON.parse(localStorage.getItem(key)!).taskId==='c'.repeat(32)))).toBe(true);
 await reloadAndReopen(page);await expect(page.locator('.scene-board')).toBeVisible();await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();done=true;
 await page.getByRole('button',{name:'查询生成任务',exact:true}).click();await expect(page.getByRole('button',{name:'应用到当前背景',exact:true})).toBeVisible();expect(posts).toBe(1);
});

test('排队与可恢复失败继续原任务，不重新生成付费任务',async({page})=>{
 const id='d'.repeat(32),bodies:unknown[]=[];let polls=0,resumed=false;
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}});
  if(path==='/api/ai/images'){bodies.push(route.request().postDataJSON());resumed=bodies.length>1;return json(route,{id,status:resumed?'running':'queued'});}
  if(path===`/api/ai/images/${id}`){polls++;return json(route,resumed?{id,status:'succeeded',url:`/api/ai/media/${id}.png`}:polls===1?{id,status:'queued'}:{id,status:'failed',retryable:true,error:'任务查询暂时失败，可恢复原任务'});}
  if(path===`/api/ai/media/${id}.png`)return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=','base64')});
  return json(route,{error:'测试阻止未预期请求'},503);
 });
 await open(page);await page.getByRole('button',{name:'生成新背景',exact:true}).click();await page.getByLabel('图片生成描述',{exact:true}).fill('工业展厅背景');await page.getByRole('button',{name:'生成候选图片',exact:true}).click();
 await expect(page.getByRole('button',{name:'继续查询原任务',exact:true})).toBeVisible();await expect(page.getByText('任务状态无效，请稍后重新查询。',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'继续查询原任务',exact:true}).click();await expect(page.getByRole('button',{name:'应用到当前背景',exact:true})).toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
});

test('明确拒绝创建图片任务后允许修改描述重试',async({page})=>{
 const id='e'.repeat(32);let posts=0;
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}});
  if(path==='/api/ai/images'){posts++;return posts===1?json(route,{error:'图片参数不正确，任务未创建'},400):json(route,{id,status:'queued'});}
  if(path===`/api/ai/images/${id}`)return json(route,{id,status:'succeeded',url:`/api/ai/media/${id}.png`});
  if(path===`/api/ai/media/${id}.png`)return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=','base64')});
  return json(route,{error:'测试阻止未预期请求'},503);
 });
 await open(page);await page.getByRole('button',{name:'生成新背景',exact:true}).click();const input=page.getByLabel('图片生成描述',{exact:true});await input.fill('工业展厅背景');await page.getByRole('button',{name:'生成候选图片',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('任务未创建');await expect(input).toBeEnabled();await input.fill('科技蓝展厅背景');await page.getByRole('button',{name:'重新生成候选',exact:true}).click();await expect(page.getByRole('button',{name:'应用到当前背景',exact:true})).toBeVisible();expect(posts).toBe(2);
});
