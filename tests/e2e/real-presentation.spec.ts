import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';

test('上传资料真实进入大纲，正文和讲稿生成，PPTX保留内容，语音及问答调用实际正文',async({page})=>{
 const requests:string[]=[],speech:string[]=[];
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}}));
 await page.route('**/api/ai/chat',async route=>{
  const payload=route.request().postDataJSON(),input=JSON.stringify(payload);requests.push(input);
  const content=input.includes('sourcePages')?JSON.stringify({answer:'资料显示，绿色产线能耗降低 12%。',sourcePages:[2]}):JSON.stringify({title:'星澜智造接待演示',sections:[{title:'星澜智造',bullets:['成立于2012年','面向制造业提供数字化服务'],narration:'欢迎来到星澜智造。我们成立于2012年。',layout:'title'},{title:'绿色产线升级',bullets:['2024年完成升级','能耗降低12%'],narration:'2024年，公司完成绿色产线升级，能耗降低百分之十二。',layout:'bullets'}]});
  await route.fulfill({json:{model:'deepseek-flash',content}});
 });
 await page.route('**/api/ai/speech',async route=>{speech.push(route.request().postDataJSON().text);await route.fulfill({json:{url:'/api/ai/speech/test.wav'}});});
 await page.route('**/api/ai/speech/test.wav',route=>route.fulfill({path:'public/media/narration.wav',contentType:'audio/wav'}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();
 await page.getByLabel('你想讲述什么？',{exact:true}).fill('根据上传大纲生成企业接待演示');
 await page.getByRole('dialog').locator('input[type=file]').first().setInputFiles({name:'企业大纲.txt',mimeType:'text/plain',buffer:Buffer.from('星澜智造成立于2012年。2024年绿色产线升级，能耗降低12%。以上均为模拟数据。')});
 await expect(page.locator('.creation-source-file')).toContainText('已解析');
 await page.getByRole('button',{name:'生成大纲',exact:true}).click();await expect(page.getByLabel('第2页正文要点',{exact:true})).toHaveValue('2024年完成升级\n能耗降低12%');expect(requests[0]).toContain('以上均为模拟数据');
 await page.getByLabel('第2页正文要点',{exact:true}).fill('2024年完成升级\n能耗降低12%\n根据确认大纲编排');
 await page.getByRole('button',{name:'创建并进入编辑器',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);
 await page.getByRole('button',{name:'导出',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PowerPoint（PPTX）',exact:true}).click();const result=await download,zip=await JSZip.loadAsync(await readFile((await result.path())!));expect(await zip.file('ppt/slides/slide2.xml')!.async('string')).toContain('根据确认大纲编排');expect(await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string')).toContain('百分之十二');
 await page.getByRole('tab',{name:'互动问答',exact:true}).click();await page.getByLabel('允许使用本作品上传的参考资料',{exact:true}).check();
 await page.getByRole('button',{name:'开始演示',exact:true}).click();await page.getByRole('button',{name:'开始讲解',exact:true}).click();await expect.poll(()=>speech.length).toBe(1);expect(speech[0]).toBe('欢迎来到星澜智造。');await expect(page.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible();await page.getByRole('button',{name:'暂停讲解',exact:true}).click();
 await page.getByRole('button',{name:'提问',exact:true}).click();await page.getByLabel('演示追问',{exact:true}).fill('绿色产线能耗降低多少？');await page.getByRole('button',{name:'发送问题',exact:true}).click();await expect(page.locator('.player-answer')).toContainText('能耗降低 12%');expect(requests.at(-1)).toContain('以上均为模拟数据');expect(requests.at(-1)).toContain('根据确认大纲编排');
 await page.screenshot({path:'output/验收截图/real-presentation-qa.png'});
 await page.locator('.player-question-panel').getByRole('button',{name:'继续讲解',exact:true}).click();await expect(page.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible();expect(speech).toHaveLength(1);
 let release!:()=>void;const delayed=new Promise<void>(resolve=>{release=resolve;});let requested!:()=>void;const arrived=new Promise<void>(resolve=>{requested=resolve;});
 await page.route('**/api/ai/chat',async route=>{requested();await delayed;await route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({answer:'旧页面延迟回答不得覆盖新页',sourcePages:[1]})}}).catch(()=>{});});
 await page.getByRole('button',{name:'提问',exact:true}).click();await page.getByLabel('演示追问',{exact:true}).fill('延迟问题');await page.getByRole('button',{name:'发送问题',exact:true}).click();await arrived;
 await page.getByRole('button',{name:'下一页',exact:true}).click();release();await expect(page.locator('.player-slide')).toContainText('绿色产线升级');await expect(page.locator('.player-answer')).toHaveCount(0);await expect(page.getByRole('button',{name:'发送问题',exact:true})).toBeEnabled();
});

test('Agent 智能演示离开再继续任务保留编辑且不重复调用模型',async({page})=>{
 let calls=0;
 let release!:()=>void,arrived!:()=>void;const responseGate=new Promise<void>(resolve=>{release=resolve;});const requestStarted=new Promise<void>(resolve=>{arrived=resolve;});
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/ai/config')return route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}});
  if(path==='/api/ai/chat'){
   calls++;arrived();await responseGate;
   return route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({title:'待确认的演示',sections:[{title:'企业概况',bullets:['成立于2012年'],narration:'这是一份模拟企业资料。',layout:'title'}]})}});
  }
  return route.fulfill({status:503,json:{error:'测试阻止未配置的 AI 请求'}});
 });
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await page.getByRole('textbox',{name:'创作需求'}).fill('根据模拟企业资料生成智能演示，自动讲解企业概况');
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 await requestStarted;await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'正在整理内容…'})).toBeDisabled();release();
 await expect(page.getByLabel('演示名称',{exact:true})).toHaveValue('待确认的演示');
 await page.getByLabel('演示名称',{exact:true}).fill('已人工确认的名称');
 await page.getByLabel('第1页正文要点',{exact:true}).fill('成立于2012年\n保留本次人工编辑');
 const runUrl=page.url();await page.getByRole('link',{name:'首页',exact:true}).click();await page.goto(runUrl);await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByLabel('演示名称',{exact:true})).toHaveValue('已人工确认的名称');
 await expect(page.getByLabel('第1页正文要点',{exact:true})).toHaveValue('成立于2012年\n保留本次人工编辑');
 expect(calls).toBe(1);
});
