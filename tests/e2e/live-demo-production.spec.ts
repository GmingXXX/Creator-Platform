import {test,expect,type Page} from '@playwright/test';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const root=path.resolve('output/智创真实演示资料_20261116'),out=path.resolve('output/真实演示验收');
test.skip(process.env.ZC_LIVE_AI!=='1','显式启用真实接口验收');
test.setTimeout(300000);
test.use({actionTimeout:15000});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){await writeFile(path.join(out,'失败现场-'+info.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g,'')+'.json'),JSON.stringify(await state(page),null,2)).catch(()=>{});}});
async function state(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);}
async function prepare(page:Page,folder:string,document:string){
 await mkdir(out,{recursive:true});
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.goto('/#/skills');await page.getByRole('button',{name:'上传技能',exact:true}).click();
 const dir=path.join(root,folder),files=await readdir(dir),skillFile=files.find(f=>f.endsWith('.zip'))!;
 await page.getByLabel('上传 ZIP 技能包').setInputFiles(path.join(dir,skillFile));await expect(page.getByText('格式检查通过')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'添加技能',exact:true}).click();
 const skill=(await state(page)).skills.find((s:any)=>s.sourcePackage?.filename===skillFile)|| (await state(page)).skills.find((s:any)=>s.name===skillFile.replace('.zip',''));
 expect(skill).toBeTruthy();
 console.log('skill imported',skill.name);await page.goto('/#/');await page.getByRole('button',{name:'选择大模型',exact:true}).click();await page.getByRole('button',{name:/DeepSeek Flash/}).click();
 await page.getByRole('button',{name:'设计风格',exact:true}).click();await page.locator('.design-picker-grid').getByRole('button',{name:/科技风/}).click();
 // Uploaded skills are enabled and selected automatically by the task matcher.
 const assets=await readdir(path.join(dir,'素材')).catch(()=>[]);
 await page.locator('.composer input[aria-label="添加文件"]').setInputFiles([path.join(dir,document),...assets.map(f=>path.join(dir,'素材',f))]);
 await expect(page.getByRole('button',{name:'上传文件',exact:true})).toBeEnabled();
 console.log('files uploaded',folder);await page.getByLabel('创作需求',{exact:true}).fill(await readFile(path.join(dir,'演示提示词.txt'),'utf8'));await page.getByRole('button',{name:'发送创作需求',exact:true}).click();console.log('sent',folder);
}
async function save(page:Page,name:string,extra:object={}){const data=await state(page),run=data.runs[0];await writeFile(path.join(out,name+'.json'),JSON.stringify({run,work:data.works.find((w:any)=>w.id===run.workId),asset:data.assets.find((a:any)=>a.id===run.assetId),...extra},null,2));await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
test('live 企业资料到鱼骨时间轴',async({page})=>{
 await prepare(page,'01_企业大事件','星澜智造_企业大事件.docx');
 await expect(page.getByRole('heading',{name:'确认内容与配图',exact:true})).toBeVisible({timeout:180000});
 await expect(page.locator('.creation-review-list article')).toHaveCount(10);await expect(page.getByLabel('事件1年份',{exact:true})).toHaveValue('2012');
 await expect(page.locator('.creation-review-list .asset-review-cover')).toHaveCount(10);
 await page.getByRole('button',{name:'确认内容，继续生成',exact:true}).click();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible({timeout:30000});
 const data=await state(page),run=data.runs[0],work=data.works.find((w:any)=>w.id===run.workId),timeline=work.pages[0].nodes.find((n:any)=>n.type==='timeline');expect(timeline.timelineLayout).toBe('fishbone');expect(timeline.items).toHaveLength(10);expect(timeline.items.every((i:any)=>i.assetId)).toBe(true);
 await page.getByRole('button',{name:'运行预览',exact:true}).click();await expect(page.locator('.fishbone')).toBeVisible();await save(page,'企业鱼骨时间轴');
});
test('live PPT大纲到智能演示和语音问答',async({page})=>{
 await prepare(page,'02_智能演示','星澜智造_智能演示大纲.pptx');
 await expect(page.getByLabel('第8页正文要点',{exact:true})).toBeVisible({timeout:180000});await page.getByRole('button',{name:'按此方案生成作品',exact:true}).click();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible({timeout:300000});await expect(page).toHaveURL(/#\/create\//);await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);
 await page.getByRole('button',{name:'导出',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PowerPoint（PPTX）',exact:true}).click();const file=await download;await file.saveAs(path.join(out,'星澜智造_真实生成.pptx'));const zip=await JSZip.loadAsync(await readFile((await file.path())!));expect(Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(8);
 await page.getByRole('button',{name:'开始演示',exact:true}).click();await page.getByRole('button',{name:'开始讲解',exact:true}).click();await expect(page.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible({timeout:180000});await page.getByRole('button',{name:'暂停讲解',exact:true}).click();
 await page.getByRole('button',{name:'提问',exact:true}).click();await page.getByLabel('演示追问',{exact:true}).fill('绿色产线单位产品能耗降低了多少？比较的是哪两年？');await page.getByRole('button',{name:'发送问题',exact:true}).click();await expect(page.locator('.player-answer')).toContainText('12%',{timeout:180000});const answer=await page.locator('.player-answer').innerText();expect(answer).toContain('2020');await save(page,'智能演示',{answer});
 await page.getByLabel('演示追问',{exact:true}).fill('公司2025年营业收入具体是多少？');await page.getByRole('button',{name:'发送问题',exact:true}).click();await expect(page.locator('.player-answer')).toContainText(/未|没有|无法/,{timeout:180000});await writeFile(path.join(out,'资料外问答.txt'),await page.locator('.player-answer').innerText());
});
test('live 策划脚本到互动影片',async({page})=>{
 await prepare(page,'03_互动影片','泰山寻碑_互动故事策划脚本.docx');await expect(page.locator('.creation-node')).toHaveCount(10,{timeout:180000});await page.getByRole('button',{name:'按此方案生成作品',exact:true}).click();await expect(page.getByRole('button',{name:'继续编辑节点',exact:true})).toBeVisible({timeout:300000});await expect(page).toHaveURL(/#\/create\//);await page.getByRole('button',{name:'继续编辑节点',exact:true}).click();await expect(page).toHaveURL(/#\/dream\//);
 const data=await state(page),run=data.runs[0],work=data.works.find((w:any)=>w.id===run.workId);expect(work.title.length).toBeLessThanOrEqual(30);expect(work.storyNodes.filter((n:any)=>n.type==='end')).toHaveLength(3);expect(work.storyNodes.some((n:any)=>n.mediaAssetId&&data.assets.find((a:any)=>a.id===n.mediaAssetId)?.kind==='html')).toBeTruthy();
 await page.getByRole('button',{name:'试运行',exact:true}).click();
 const start=work.storyNodes.find((n:any)=>n.type==='start'),endings=work.storyNodes.filter((n:any)=>n.type==='end');
 function routeTo(target:string,current=start.id,seen:string[]=[]):any[]{if(current===target)return [];for(const edge of work.storyEdges.filter((e:any)=>e.source===current&&!seen.includes(e.target))){const rest=routeTo(target,edge.target,[...seen,current]);if(rest)return [edge,...rest];}return null as any;}
 await expect.poll(()=>page.locator('.story-preview-scene video').evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);for(let i=0;i<3;i++){if(i)await page.getByRole('button',{name:'体验另一种结局',exact:true}).click();for(const edge of routeTo(endings[i].id)){const n=work.storyNodes.find((n:any)=>n.id===edge.source),a=data.assets.find((a:any)=>a.id===n.mediaAssetId);if(a?.kind==='html'){const frame=page.frameLocator(`iframe[title="${n.title}"]`);await frame.getByRole('button',{name:'留印 · 向山而行',exact:true}).click();await expect(frame.locator('#quote')).toHaveText('向山而行，亦向心而行。');}await page.locator('.story-experience').getByRole('button',{name:edge.label||'继续',exact:true}).click();}await expect(page.locator('.story-preview-body h2')).toHaveText(endings[i].title);}
 await save(page,'互动影片');
});
test('live 需求到可试编辑组件包',async({page})=>{
 await prepare(page,'04_组件生成','组件制作需求.md');await page.getByRole('button',{name:'生成组件包',exact:true}).click();await expect(page.getByRole('dialog',{name:'检查生成组件',exact:true})).toBeVisible({timeout:180000});await page.getByRole('button',{name:'预览与试编辑',exact:true}).click();const frame=page.frameLocator('iframe[title="组件运行预览"]');await expect(frame.locator('.card')).toHaveCount(3);await page.getByLabel('主标题',{exact:true}).fill('看见创新的力量 · 已试编辑');await expect(frame.getByRole('heading',{name:'看见创新的力量 · 已试编辑'})).toBeVisible();await page.getByRole('button',{name:'保存到素材库',exact:true}).click();await expect(page.getByRole('button',{name:'前往素材库',exact:true})).toBeVisible();await save(page,'真实生成组件');await page.getByRole('button',{name:'前往素材库',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载组件包',exact:true}).click();await (await download).saveAs(path.join(out,'星澜成果组件_已试编辑.zip'));
});
