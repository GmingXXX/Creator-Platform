import {test,expect,type Page,type Route} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';

type Saved=Record<string,any>;
const snapshot=(page:Page):Promise<Saved>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const presetLabels={timeline:'企业鱼骨时间轴',presentation:'企业智能演示',story:'互动故事',component:'成果卡片组件'};
type Case=keyof typeof presetLabels;
const counts={timeline:11,presentation:7,story:6,component:1};
const componentPlan={name:'星澜成果卡片',title:'看见创新的力量',intro:'虚构演示数据',accent:'#63cdda',background:'#102331',columns:3,tilt:7,cards:[{title:'设备感知',value:'X-Link',body:'边缘采集'},{title:'绿色运营',value:'12%',body:'2021年相对2020年单位产品能耗下降'},{title:'数字孪生',value:'',body:'可视化与维修培训'}]};
async function xmlParagraphs(path:string){const zip=await JSZip.loadAsync(await readFile(path));return (await zip.file('word/document.xml')!.async('string')).split(/<\/w:p>/).map(p=>[...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join('')).filter(Boolean);}
function context(body:Saved){for(const message of body.messages||[]){try{const value=JSON.parse(message.content);if(value.attachments||value.assets||value.images)return value;}catch{}}return {};}
async function reply(route:Route,caseId:Case){
 const body=route.request().postDataJSON(),meta=context(body);
 let plan:unknown=componentPlan;
 if(caseId==='timeline'){
  const text=await xmlParagraphs('public/demo-inputs/v1/timeline/星澜智造_企业大事件.docx');
  plan={mode:'create',answer:'按知识本地场资料组织十个企业事件。',title:'星澜智造鱼骨时间轴',type:'时间演进型',sections:text.flatMap((line,i)=>/^\d{4}｜/.test(line)?[{year:line.slice(0,4),title:line.slice(5),body:text[i+1],imageAssetId:meta.attachments?.find((a:Saved)=>a.name===text[i+2].replace('对应图片：',''))?.id}]:[])};
 }else if(caseId==='presentation'){
  const titles=['从感知到协同','企业发展历程','三项核心能力','示范产线实践','绿色运营实践','业务与服务布局','储能监测案例','下一阶段的方向'];
  plan={title:'星澜智造企业能力',sections:titles.map((title,i)=>({title,bullets:[i===4?'2021年单位产品能耗较2020年下降12%':'星澜智造虚构演示资料','基于知识本地场提供的大纲'],narration:`第${i+1}页：${title}。这是基于大纲生成的模拟讲稿。`,layout:'bullets'}))};
 }else if(caseId==='story'){
  const text=await xmlParagraphs('public/demo-inputs/v1/story/泰山寻碑_互动故事策划脚本.docx'),nodes:Saved[]=[],edges:Saved[]=[];
  text.forEach((line,i)=>{const match=line.match(/^节点ID：([^；]+)；类型：([^；]+)；名称：(.+)$/);if(!match)return;const id=match[1],file=text[i+2].replace('素材文件：','');nodes.push({id,type:match[2],title:match[3],text:text[i+1].replace('画面与旁白：',''),mediaAssetId:meta.assets?.find((a:Saved)=>a.name.endsWith(file))?.id});const destinations=text[i+3]?.replace('后续节点与按钮：','');if(destinations&&destinations!=='无')for(const part of destinations.split('；')){const m=part.match(/^([^:：]+)[:：](.+)$/);if(m)edges.push({source:id,target:m[1],label:m[2]});}});
  plan={title:'泰山寻碑',nodes,edges};
 }
 await route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify(plan)}});
}
async function newBoundSpace(page:Page){
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();await page.getByRole('menuitem',{name:'新建项目空间',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'新建项目空间',exact:true});await dialog.getByLabel('空间名称',{exact:true}).fill('无上传知识演示');await dialog.getByRole('button',{name:'创建并进入',exact:true}).click();await page.getByRole('button',{name:'先开始创作',exact:true}).click();
 const before=await snapshot(page);expect(before.works.filter((w:Saved)=>w.workspaceId===before.activeWorkspaceId)).toHaveLength(0);expect(before.assets.filter((a:Saved)=>a.workspaceId===before.activeWorkspaceId)).toHaveLength(0);
 await page.getByRole('button',{name:'查看知识本地场绑定',exact:true}).click();
 const manage=page.getByRole('dialog',{name:'管理项目空间',exact:true});await manage.getByRole('button',{name:'使用演示知识本地场',exact:true}).click();await expect(manage.getByLabel('知识本地场id',{exact:true})).not.toHaveValue('');await manage.getByRole('button',{name:'保存绑定配置',exact:true}).click();await page.screenshot({path:'output/demo-knowledge-binding.png',animations:'disabled'});await manage.getByRole('button',{name:'完成',exact:true}).click();
 const bound=await snapshot(page);expect(bound.workspaceKnowledge[bound.activeWorkspaceId].demoCatalogId).toBe('zhichuang-20261116');return bound.activeWorkspaceId as string;
}
test.beforeEach(async({page})=>{
 await page.route('**/api/ai/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/ai/config')return route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,speech:true}}});
  if(path==='/api/ai/speech')return route.fulfill({json:{url:'/api/ai/speech/test.wav'}});
  if(path==='/api/ai/speech/test.wav')return route.fulfill({path:'public/media/narration.wav',contentType:'audio/wav'});
  return route.fulfill({status:503,json:{error:'测试禁止未模拟的外部模型调用'}});
 });
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台',exact:true}).click();await expect(page.getByLabel('创作需求',{exact:true})).toBeVisible();
});
for(const caseId of Object.keys(presetLabels) as Case[])test(`模拟知识本地场无上传生成：${presetLabels[caseId]}`,async({page})=>{
 const imagePrompts:string[]=[];
 if(caseId==='presentation'){
  await page.route('**/api/ai/images',route=>{imagePrompts.push(route.request().postDataJSON().prompt);return route.fulfill({json:{id:String(imagePrompts.length).padStart(32,'0'),status:'pending'}});});
  await page.route('**/api/ai/images/*',route=>{const id=new URL(route.request().url()).pathname.split('/').at(-1)!;return route.fulfill({json:{id,status:'succeeded',url:`/api/ai/media/${id}.png`}});});
  await page.route('**/api/ai/media/*.png',route=>route.fulfill({path:'public/demo-inputs/v3/presentation/01-enterprise.png',contentType:'image/png'}));
 }
 const requests:string[]=[];await page.route('**/api/ai/chat',async route=>{requests.push(JSON.stringify(route.request().postDataJSON()));await reply(route,caseId);});
 const workspaceId=await newBoundSpace(page);await page.getByRole('button',{name:presetLabels[caseId],exact:true}).click();
 const prompt=await page.getByLabel('创作需求',{exact:true}).inputValue();expect(prompt).toContain('知识本地场');expect(prompt).not.toContain('上传的');
 const draftState=await snapshot(page);expect(draftState.drafts.find((d:Saved)=>d.id===draftState.activeDraftId).attachmentIds).toHaveLength(0);
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();await expect(page).toHaveURL(/#\/create\//);
 if(caseId==='component')await page.getByRole('button',{name:'生成组件包',exact:true}).click();
 await expect.poll(()=>requests.length).toBeGreaterThan(0);
 const state=await snapshot(page),run=state.runs[0],assets=state.assets.filter((a:Saved)=>run.attachmentIds.includes(a.id));expect(run.workspaceId).toBe(workspaceId);expect(run.outputKind).toBe({timeline:'exhibit',presentation:'presentation',story:'story',component:'component'}[caseId]);expect(assets).toHaveLength(counts[caseId]);expect(assets.every((a:Saved)=>a.workspaceId===workspaceId&&a.package?.params.knowledgeCase===caseId&&a.package?.params.knowledgeCatalogId==='zhichuang-20261116'&&a.package?.params.knowledgeFieldId===state.workspaceKnowledge[workspaceId].fieldId&&a.tags.includes('模拟知识引用'))).toBe(true);
 await expect(page.locator('.knowledge-source-summary')).toContainText(`模拟知识本地场 · ${counts[caseId]} 份资料`);
 expect(requests.join('\n')).toContain({timeline:'初始团队18人',presentation:'同一示范工厂',story:'无字碑',component:'12%'}[caseId]);
 if(caseId==='timeline'){
  await expect(page.getByRole('heading',{name:'确认内容与配图',exact:true})).toBeVisible();await expect(page.locator('.creation-review-list article')).toHaveCount(10);await page.getByRole('button',{name:'确认内容，继续生成',exact:true}).click();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible();
  const data=await snapshot(page),work=data.works.find((w:Saved)=>w.id===data.runs[0].workId),timeline=work.pages[0].nodes.find((n:Saved)=>n.type==='timeline');expect(timeline.timelineLayout).toBe('fishbone');expect(timeline.items).toHaveLength(10);expect(timeline.items.every((i:Saved)=>i.assetId)).toBe(true);
 }else if(caseId==='presentation'){
  await page.getByRole('button',{name:'展开全部',exact:true}).click();await expect(page.getByLabel('第8页正文要点',{exact:true})).toBeVisible();await expect(page.locator('.creation-outline-item .asset-review-cover img')).toHaveCount(6);await expect(page.getByLabel('为缺少配图的页面自动生成素材',{exact:false})).toBeChecked();await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeVisible();const data=await snapshot(page),work=data.works.find((w:Saved)=>w.id===data.runs[0].workId);expect(work.pages).toHaveLength(8);expect(imagePrompts).toHaveLength(2);expect(imagePrompts[0]).toContain('储能监测案例');expect(imagePrompts[1]).toContain('下一阶段的方向');expect(work.pages.every((p:Saved)=>p.nodes.some((n:Saved)=>n.type==='image'))).toBe(true);const studio=JSON.parse(work.creationPackage.params.presentationStudio);expect(Object.values(studio.pages).every((p:any)=>p.sentences.length>0&&p.sentences.every((s:any)=>s.audioUrl==='/api/ai/speech/test.wav'))).toBe(true);
 }else if(caseId==='story'){
  await expect(page.locator('.creation-node')).toHaveCount(10);await page.getByLabel('自动生成缺失节点素材',{exact:false}).uncheck();await page.getByRole('button',{name:'按此方案生成作品',exact:true}).click();await expect(page.getByRole('button',{name:'继续编辑节点',exact:true})).toBeVisible();const data=await snapshot(page),work=data.works.find((w:Saved)=>w.id===data.runs[0].workId);expect(work.storyNodes.filter((n:Saved)=>n.type==='end')).toHaveLength(3);expect(work.storyNodes.every((n:Saved)=>n.mediaAssetId)).toBe(true);
 }else{
  const dialog=page.getByRole('dialog',{name:'检查生成组件',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'预览与试编辑',exact:true}).click();await expect(page.frameLocator('iframe[title="组件运行预览"]').locator('.card')).toHaveCount(3);await dialog.getByRole('button',{name:'保存到素材库',exact:true}).click();await expect(page.getByRole('button',{name:'前往素材库',exact:true})).toBeVisible();
 }
 if(caseId!=='component'){
  const before=await snapshot(page),workId=before.runs[0].workId,work=before.works.find((w:Saved)=>w.id===workId),url=page.url();
  const save=page.getByRole('button',{name:'确认并保存',exact:true});await expect(save).toBeVisible();
  await expect(page.getByRole('button',{name:'前往作品库',exact:true})).toBeVisible();
  await save.click();await expect(page.locator('.toast').filter({hasText:'已保存至「无上传知识演示」的作品库'})).toBeVisible();
  let saved=await snapshot(page);expect(page.url()).toBe(url);expect(saved.works).toHaveLength(before.works.length);expect(saved.works.find((w:Saved)=>w.id===workId).revision).toBe(work.revision+1);
  expect(saved.works.find((w:Saved)=>w.id===workId).pages).toEqual(work.pages);expect(saved.works.find((w:Saved)=>w.id===workId).storyNodes).toEqual(work.storyNodes);
  await save.click();saved=await snapshot(page);expect(saved.works.filter((w:Saved)=>w.id===workId)).toHaveLength(1);expect(saved.works.find((w:Saved)=>w.id===workId).revision).toBe(work.revision+2);
 }
 await page.screenshot({path:`output/demo-knowledge-${caseId}.png`,animations:'disabled'});
});
test('模拟绑定改为普通ACP后不再自动引用旧知识资料',async({page})=>{
 await page.route('**/api/ai/chat',route=>reply(route,'timeline'));
 const workspaceId=await newBoundSpace(page);await page.getByRole('button',{name:'企业鱼骨时间轴',exact:true}).click();await page.getByRole('button',{name:'发送创作需求',exact:true}).click();await expect(page.getByRole('heading',{name:'确认内容与配图',exact:true})).toBeVisible();
 await expect(page.locator('.knowledge-source-summary')).toContainText('模拟知识本地场');const previous=(await snapshot(page)).runs[0].attachmentIds;expect(previous).toHaveLength(11);
 await page.goto('/#/');await page.getByRole('button',{name:'查看知识本地场绑定',exact:true}).click();const dialog=page.getByRole('dialog',{name:'管理项目空间',exact:true});await dialog.getByRole('button',{name:'改用 ACP 配置',exact:true}).click();await dialog.getByLabel('知识本地场名称',{exact:true}).fill('真实客户知识场');await dialog.getByLabel('知识本地场id',{exact:true}).fill('ordinary-field');await dialog.getByRole('button',{name:'保存绑定配置',exact:true}).click();await dialog.getByRole('button',{name:'完成',exact:true}).click();
 await page.getByLabel('创作需求',{exact:true}).fill('请制作一个鱼骨时间轴，先确认资料缺失。');await page.getByRole('button',{name:'发送创作需求',exact:true}).click();await expect(page).toHaveURL(/#\/create\//);const state=await snapshot(page);expect(state.workspaceKnowledge[workspaceId].demoCatalogId).toBeUndefined();expect(state.runs[0].attachmentIds).toHaveLength(0);expect(state.runs[1].attachmentIds).toEqual(previous);await expect(page.locator('.knowledge-source-summary')).toHaveCount(0);
});
