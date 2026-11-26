import {test,expect,type Page} from '@playwright/test';
async function login(page:Page){
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
}
test('互动影片完成后可以按节点继续修改并撤销',async({page})=>{
 await login(page);
 const original=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);const work=data.state.works.find((w:any)=>w.id==='work-6');work.aiModel='deepseek-flash';data.state.runs.unshift({id:'story-followup',workspaceId:work.workspaceId||'personal',prompt:'制作互动影片',model:'deepseek-flash',styleId:'technology',skillIds:[],attachmentIds:[],status:'complete',step:6,outputKind:'story',workId:work.id,createdAt:new Date().toISOString()});localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));return work.storyNodes;});
 let request:any;
 await page.route('**/api/ai/chat',route=>{request=JSON.parse(route.request().postDataJSON().messages.find((m:any)=>m.role==='user').content);return route.fulfill({json:{content:JSON.stringify({summary:'已更新开场剧情',patches:[{kind:'story-node',nodeId:original[0].id,changes:{text:'新的开场剧情'}}]})}});});
 await page.reload();await page.goto('/#/create/story-followup');
 await expect(page.getByLabel('修改当前作品')).toBeVisible();
 await page.getByLabel('修改范围').selectOption(`node:@story:${original[0].id}`);
 await page.getByLabel('修改当前作品').fill('将开场剧情修改为新的开场剧情');await page.getByLabel('发送修改').click();
 await expect(page.getByRole('button',{name:'撤销本次修改'})).toBeVisible();
 expect(request.target).toMatchObject({scope:'node',pageId:'@story',nodeId:original[0].id});
 const nodes=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w:any)=>w.id==='work-6').storyNodes);
 expect(nodes[0].text).toBe('新的开场剧情');expect(nodes.slice(1)).toEqual(original.slice(1));
 await page.getByRole('button',{name:'撤销本次修改'}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((w:any)=>w.id==='work-6').storyNodes)).toEqual(original);
});
for(const kind of ['presentation','story'] as const)test(`${kind}编辑器投稿包含未单独保存的修改`,async({page})=>{
 await login(page);const id=kind==='presentation'?'work-4':'work-6';await page.goto(`/#/${kind==='presentation'?'presentations':'dream'}/${id}`);
 const title='最新投稿内容';await page.getByLabel(kind==='presentation'?'演示名称':'作品名称',{exact:true}).fill(title);
 await page.getByRole('button',{name:'分享投稿',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'提交到共创社区'});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('投稿标题')).toHaveValue(title);
 const purpose=dialog.getByRole('group',{name:'展示内容'}).getByRole('button').first();if(await purpose.getAttribute('aria-pressed')!=='true')await purpose.click();
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'提交审核',exact:true}).click();await expect(dialog).toBeHidden();
 const snapshot=await page.evaluate(id=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.submissions.find((s:any)=>s.work?.id===id&&s.status==='pending')?.work,id);
 expect(snapshot?.title).toBe(title);expect(snapshot?.kind).toBe(kind);
 if(kind==='story')expect(snapshot.storyNodes.length).toBeGreaterThan(0);else expect(snapshot.pages.length).toBeGreaterThan(0);
});
for(const route of ['presentations/work-4','dream/work-6'])test(`${route}交付检查随当前修改保存，制作阶段无需切换`,async({page})=>{
 await login(page);await page.setViewportSize({width:1280,height:800});await page.goto('/#/'+route);
 const story=route.startsWith('dream');
 const title=page.getByLabel(story?'作品名称':'演示名称',{exact:true});
 await title.fill('本次交付检查');await expect(page.getByLabel('制作阶段',{exact:true})).toHaveCount(0);
 if(story)await page.getByRole('button',{name:'导出',exact:true}).click();
 await page.getByRole('button',{name:'交付检查',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'交付检查',exact:true});await dialog.getByRole('checkbox').first().check();await dialog.getByRole('button',{name:'保存检查记录'}).click();
 if(story)await page.getByRole('dialog',{name:'导出互动影片'}).getByRole('button',{name:'关闭对话框'}).click();
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect.poll(()=>page.evaluate(id=>{const w=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((v:any)=>v.id===id);return [w.title,w.deliveryReview?.checks,w.deliveryReview?.revision===w.revision]},route.split('/')[1])).toEqual(['本次交付检查',['facts'],true]);
 const bounds=await page.locator('.studio-top-actions').boundingBox();expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(1280);
});
