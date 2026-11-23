import {expect,test,type Page,type Route} from '@playwright/test';
import type {StudioData} from '../../src/domain/types';

const plan={mode:'create',answer:'根据已提供的示例资料，使用时间轴编排三个阶段。',title:'真实模型链路测试 · 企业历程',type:'时间演进型',sections:[{title:'创业启航',body:'1988 年创立，为演示编写的示例事实。',year:'1988'},{title:'技术突破',body:'2008 年完成技术升级，为演示编写的示例事实。',year:'2008'},{title:'绿色发展',body:'2024 年进入绿色发展阶段，为演示编写的示例事实。',year:'2024'}],imagePrompt:'深蓝工业展厅背景，无文字'};
const readState=(page:Page):Promise<StudioData>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
type AIRequest={path:string;method:string;body:Record<string,unknown>|undefined};

async function mockAI(page:Page,chat:(route:Route)=>Promise<void>,images?:(route:Route)=>Promise<void>){
 const requests:AIRequest[]=[];
 // All AI endpoints are intercepted, including unexpected paths: no paid call can escape this fixture.
 await page.route('**/api/ai/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  requests.push({path,method:request.method(),body:request.postData()?request.postDataJSON():undefined});
  if(path==='/api/ai/config')return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'},{id:'deepseek-v4-pro',label:'DeepSeek Pro'}],configured:{deepseek:true,image:true}});
  if(path==='/api/ai/chat')return chat(route);
  if(path.startsWith('/api/ai/images')&&images)return images(route);
  return json(route,{error:`测试阻止了未配置的 AI 请求：${path}`},503);
 });
 return requests;
}
async function login(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await expect(page.locator('.model-control')).toContainText('DeepSeek Flash');
}
async function sendCreation(page:Page,prompt='请制作钢铁企业发展历程交互展项，横向时间轴展示三个阶段。'){
 await page.getByRole('textbox',{name:'创作需求'}).fill(prompt);await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
}
async function useExistingBackground(page:Page){
 await expect(page.locator('.ai-plan-answer')).toContainText(plan.answer);
 await expect(page.getByLabel('确认作品标题',{exact:true})).toHaveValue(plan.title);
 await page.getByRole('button',{name:'确认内容，继续生成',exact:true}).click();
 await page.getByRole('button',{name:'从素材库选择',exact:true}).click();
 await page.getByTestId('material-picker').getByRole('tab',{name:'我的素材',exact:true}).click();
 await page.locator('.material-picker-card').first().click();await page.getByRole('button',{name:'使用此素材',exact:true}).click();
 await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible();
}

test('默认 DeepSeek 经结构方案与已有背景生成完整原生画布，内容可编辑',async({page})=>{
 const requests=await mockAI(page,route=>json(route,{content:JSON.stringify(plan),model:'deepseek-flash'}));
 await login(page);const before=await readState(page);await sendCreation(page);await useExistingBackground(page);
 const state=await readState(page),run=state.runs[0],work=state.works.find(w=>w.id===run.workId)!;
 expect(run.model).toBe('deepseek-flash');expect(run.resourceStrategy).toBe('reuse');expect(run.status).toBe('complete');
 expect(work.aiModel).toBe('deepseek-flash');expect(work.pages[0].backgroundAssetId).toBe(run.backgroundAssetId);expect(work.pages[0].nodes.length).toBeGreaterThan(2);
 expect(work.pages[0].nodes.find(node=>node.type==='timeline')?.items?.map(item=>item.title)).toEqual(plan.sections.map(section=>section.title));
 expect(state.works).toHaveLength(before.works.length+1);expect(requests.filter(request=>request.path==='/api/ai/chat')).toHaveLength(1);expect(requests.some(request=>request.path.startsWith('/api/ai/images'))).toBe(false);
 expect(requests.find(request=>request.path==='/api/ai/chat')?.body).toMatchObject({model:'deepseek-flash',responseFormat:'json'});
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page).toHaveURL(/editor\//);await expect(page.locator('.scene-node-timeline')).toBeVisible();
 await page.getByRole('button',{name:'图层',exact:false}).first().click();await page.locator('.layer-select').filter({hasText:'主标题'}).click();
 await page.getByRole('textbox',{name:'文本内容',exact:true}).fill('可直接修改的企业历程');await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect.poll(async()=>{const saved=await readState(page);return saved.works.find(w=>w.id===work.id)?.pages[0].nodes.find(node=>node.name==='主标题')?.content;}).toBe('可直接修改的企业历程');
});

test('真实模型多轮修改失败保留输入与作品，重试成功后可撤销',async({page})=>{
 let mode:'create'|'fail'|'revise'='create';
 const requests=await mockAI(page,route=>mode==='fail'?json(route,{error:'模型暂时繁忙，请重试。'},503):json(route,{content:JSON.stringify(mode==='create'?plan:{summary:'已更新作品名称。',patches:[{kind:'work',changes:{title:'多轮修改后的企业历程'}}]}),model:'deepseek-flash'}));
 await login(page);await sendCreation(page);await useExistingBackground(page);
 const before=await readState(page),work=before.works.find(w=>w.id===before.runs[0].workId)!;
 mode='fail';const input=page.getByRole('textbox',{name:'修改当前作品',exact:true});await input.fill('将作品名称改为多轮修改后的企业历程');await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect(page.getByText('模型暂时繁忙，请重试。',{exact:true})).toBeVisible();await expect(input).toBeEnabled();await expect(input).toHaveValue('将作品名称改为多轮修改后的企业历程');expect((await readState(page)).works.find(w=>w.id===work.id)).toEqual(work);
 mode='revise';await page.getByRole('button',{name:'发送修改',exact:true}).click();await expect(page.locator('.conversation-turn')).toContainText('已应用');await expect(input).toHaveValue('');
 expect((await readState(page)).works.find(w=>w.id===work.id)?.title).toBe('多轮修改后的企业历程');
 const revisionRequest=requests.filter(request=>request.path==='/api/ai/chat').at(-1)!;
 const messages=revisionRequest.body!.messages as {role:string;content:string}[];expect(JSON.parse(messages.at(-1)!.content)).toMatchObject({target:{scope:'work'},request:'将作品名称改为多轮修改后的企业历程'});
 await page.getByRole('button',{name:'撤销本次修改',exact:true}).click();await expect(page.locator('.conversation-turn')).toContainText('已撤销');
 const restored=(await readState(page)).works.find(w=>w.id===work.id)!;expect(restored.title).toBe(work.title);expect(restored.pages).toEqual(work.pages);
});

test('万相图片任务失败展示错误，不生成占位成果或重复提交远端任务',async({page})=>{
 const requests=await mockAI(page,route=>json(route,{content:JSON.stringify(plan),model:'deepseek-flash'}),route=>json(route,route.request().method()==='POST'?{id:'image-task-test',status:'pending'}:{id:'image-task-test',status:'failed',error:'图片生成任务失败：请调整描述后重试。'}));
 await login(page);const before=await readState(page);await sendCreation(page,'生成一张珠宝展厅科技感背景图片，无文字');
 await expect(page.locator('.run-error')).toContainText('图片生成任务失败：请调整描述后重试。');
 const after=await readState(page);expect(after.runs[0]).toMatchObject({status:'failed',outputKind:'image',aiImageTaskId:'image-task-test'});expect(after.runs[0].assetId).toBeUndefined();expect(after.assets).toHaveLength(before.assets.length);expect(after.works).toHaveLength(before.works.length);await expect(page.locator('.artifact-result')).toHaveCount(0);
 expect(requests.filter(request=>request.path==='/api/ai/images'&&request.method==='POST')).toHaveLength(1);
 expect(requests.some(request=>request.path==='/api/ai/images/image-task-test'&&request.method==='GET')).toBe(true);
});

test('咨询模式先展示可选方案，选择后才进入实际创作并保留原任务',async({page})=>{
 let calls=0;
 await mockAI(page,route=>json(route,{content:JSON.stringify(++calls===1?{mode:'discuss',answer:'可以采用时间轴或荣誉墙。以下内容为演示方案。',options:[{title:'企业历程时间轴',description:'适合展示企业历史，横屏滑动浏览。',prompt:'制作钢铁企业发展历程交互展项，采用时间轴。'}]}:plan),model:'deepseek-flash'}));
 await login(page);const before=await readState(page);await sendCreation(page,'企业历史有哪些呈现方式？请先给我几个方案。');
 await expect(page.getByRole('button',{name:'按此方案创建',exact:true})).toBeVisible();const discussion=await readState(page);expect(discussion.runs[0].status).toBe('waiting');expect(discussion.runs[0].aiPlan?.mode).toBe('discuss');expect(discussion.works).toHaveLength(before.works.length);
 await expect(page.getByRole('button',{name:'生成并继续',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'按此方案创建',exact:true}).click();await useExistingBackground(page);
 const result=await readState(page);expect(calls).toBe(2);expect(result.runs).toHaveLength(discussion.runs.length);expect(result.runs[0].id).toBe(discussion.runs[0].id);expect(result.runs[0].status).toBe('complete');expect(result.works).toHaveLength(before.works.length+1);
});
