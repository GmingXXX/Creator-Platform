import {expect,test,type Page} from '@playwright/test';
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
test('Agent 重排实际更新整页布局，保留内容并可撤销，无须调用模型',async({page})=>{
 let chats=0;
 await page.route('**/api/ai/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/chat'))chats++;
  return route.fulfill({contentType:'application/json',body:JSON.stringify(path.endsWith('/config')?{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}:{error:'本地重排不应调用模型'}),status:path.endsWith('/config')?200:503});
 });
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();await page.goto('/#/editor/work-1');await expect(page.locator('.scene-board')).toBeVisible();
 const before=(await state(page)).works.find((w:any)=>w.id==='work-1');
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();await page.getByLabel('修改范围',{exact:true}).selectOption(`page:${before.pages[0].id}`);
 await page.getByLabel('修改当前作品',{exact:true}).fill('重新排版整个页面');await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect(page.getByLabel('作品修改记录')).toContainText('已按本地规则重新排版');
 const after=(await state(page)).works.find((w:any)=>w.id==='work-1');expect(after.pages[0].nodes).not.toEqual(before.pages[0].nodes);
 expect(after.pages[0].nodes.map((n:any)=>[n.id,n.content,n.src,n.items,n.interactions])).toEqual(before.pages[0].nodes.map((n:any)=>[n.id,n.content,n.src,n.items,n.interactions]));
 expect(after.pages[0].nodes.filter((n:any,i:number)=>JSON.stringify(n)!==JSON.stringify(before.pages[0].nodes[i])).length).toBeGreaterThan(1);expect(chats).toBe(0);
 await page.screenshot({path:'/tmp/zc-agent-relayout-applied.png'});
 await page.getByRole('button',{name:'撤销本次修改',exact:true}).click();await expect(page.getByLabel('作品修改记录')).toContainText('已撤销');
 expect((await state(page)).works.find((w:any)=>w.id==='work-1').pages[0].nodes).toEqual(before.pages[0].nodes);
});
