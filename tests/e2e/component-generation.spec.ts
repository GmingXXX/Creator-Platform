import {test,expect} from '@playwright/test';
import {buildComponentPackage} from '../../src/domain/component-generation';
import JSZip from 'jszip';
const plan={name:'星澜成果卡片',title:'创新成果，看得见',intro:'星澜智造模拟演示数据',accent:'#63cdda',background:'#102331',columns:3,tilt:7,cards:[{title:'智慧产线',value:'3条',body:'模拟资料中已投产的智慧产线'},{title:'研发平台',value:'2个',body:'材料与数字制造平台'},{title:'服务网络',value:'12城',body:'覆盖十二个城市'}]};
test('生成组件包真实运行、详情交互及六项参数试编辑',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);await page.goto('/#/library');
 const file=await buildComponentPackage(plan,{prompt:'成果卡片',model:'deepseek-flash'});
 await page.locator('.res-page > input[type=file]').setInputFiles({name:file.name,mimeType:'application/zip',buffer:Buffer.from(await file.arrayBuffer())});
 const dialog=page.getByRole('dialog',{name:'导入组件',exact:true});await dialog.getByRole('button',{name:'预览与试编辑',exact:true}).click();
 const frame=page.frameLocator('iframe[title="组件运行预览"]');await expect(frame.getByRole('heading',{name:'创新成果，看得见',exact:true})).toBeVisible();await expect(frame.locator('.card')).toHaveCount(3);
 await frame.getByRole('button',{name:'查看成果：智慧产线',exact:true}).click();await expect(frame.getByRole('dialog')).toBeVisible();await expect(frame.getByRole('dialog')).toContainText('3条');await frame.getByLabel('关闭详情',{exact:true}).click();
 await dialog.getByLabel('主标题',{exact:true}).fill('修改后的成果');await expect(frame.getByRole('heading',{name:'修改后的成果',exact:true})).toBeVisible();
 await dialog.getByLabel('成果卡片 · 每行：标题｜数值｜说明',{exact:true}).fill('新的研发成果｜5项｜来自修改后的模拟资料\n绿色制造｜｜持续推进绿色生产');
 await expect(frame.locator('.card')).toHaveCount(2);await expect(frame.getByRole('heading',{name:'新的研发成果'})).toBeVisible();
 await dialog.getByLabel('桌面列数',{exact:true}).fill('2');await dialog.getByLabel('悬浮强度',{exact:true}).fill('0');await expect(dialog.getByRole('button',{name:'保存到素材库',exact:true})).toBeEnabled();
 await page.screenshot({path:'output/验收截图/generated-component-trial.png'});
 await dialog.getByRole('button',{name:'保存到素材库',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'预览星澜成果卡片',exact:true}).click();await expect(page.frameLocator('.res-html-preview').getByRole('heading',{name:'修改后的成果'})).toBeVisible();
});
test('带默认值的生成ZIP解压后无需平台SDK也可运行',async({page})=>{
 const file=await buildComponentPackage(plan,{prompt:'成果卡片',model:'deepseek-flash'}),zip=await JSZip.loadAsync(await file.arrayBuffer());
 const html=(await zip.file('index.html')!.async('string')).replace('<link rel="stylesheet" href="cards.css">',`<style>${await zip.file('cards.css')!.async('string')}</style>`).replace('<script src="cards.js"></script>',`<script>${await zip.file('cards.js')!.async('string')}</script>`);
 await page.route('**/*',route=>route.abort());await page.setContent(html);await expect(page.locator('.card')).toHaveCount(3);await expect(page.getByRole('heading',{name:'创新成果，看得见'})).toBeVisible();await page.getByRole('button',{name:'查看成果：服务网络'}).click();await expect(page.getByRole('dialog')).toContainText('12城');
});

test('Agent 组件生成关闭重开不重复调用，保存后成果页显示实际试编辑内容',async({page})=>{
 let calls=0,release:()=>void=()=>{};
 const released=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/ai/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/ai/config')return route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:false}}});
  if(path==='/api/ai/chat'){calls++;await released;return route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify(plan)}});}
  return route.fulfill({status:503,json:{error:'此测试不允许调用其他服务'}});
 });
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.getByRole('textbox',{name:'创作需求',exact:true}).fill('生成星澜智造企业成果悬浮卡片组组件，展示智慧产线、研发平台与服务网络，支持点击查看详情。');
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 const initial=page.getByRole('dialog',{name:'生成企业成果组件',exact:true});await expect(initial).toBeVisible();
 await initial.getByRole('button',{name:'关闭对话框',exact:true}).click();await expect(initial).toHaveCount(0);expect(calls).toBe(0);
 await page.getByRole('button',{name:'继续确认方案',exact:true}).click();await initial.getByRole('button',{name:'生成组件包',exact:true}).click();await expect.poll(()=>calls).toBe(1);
 await initial.getByRole('button',{name:'收起生成',exact:true}).click();await expect(initial).toHaveCount(0);
 const response=page.waitForResponse('**/api/ai/chat');release();await response;
 await page.getByRole('button',{name:'继续确认方案',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'检查生成组件',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'预览与试编辑',exact:true}).click();
 const trial=page.frameLocator('iframe[title="组件运行预览"]');await expect(trial.getByRole('heading',{name:plan.title,exact:true})).toBeVisible();
 await dialog.getByLabel('主标题',{exact:true}).fill('已确认的星澜成果');await expect(trial.getByRole('heading',{name:'已确认的星澜成果',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'关闭对话框',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'继续确认方案',exact:true}).click();await expect(dialog.getByLabel('主标题',{exact:true})).toHaveValue('已确认的星澜成果');await expect(trial.getByRole('heading',{name:'已确认的星澜成果',exact:true})).toBeVisible();expect(calls).toBe(1);
 await dialog.getByRole('button',{name:'保存到素材库',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByText('创作完成',{exact:true})).toBeVisible();
 const artifact=page.frameLocator('.artifact-preview .res-html-preview');await expect(artifact.getByRole('heading',{name:'已确认的星澜成果',exact:true})).toBeVisible();await expect(artifact.locator('.card')).toHaveCount(3);
 await artifact.getByRole('button',{name:'查看成果：研发平台',exact:true}).click();await expect(artifact.getByRole('dialog')).toContainText('2个');await artifact.getByLabel('关闭详情',{exact:true}).click();
 await page.screenshot({path:'output/验收截图/generated-component-agent-result.png',animations:'disabled'});
 await page.getByRole('button',{name:'前往素材库',exact:true}).click();
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'下载组件包',exact:true}).click();
 const download=await downloaded;const {readFile}=await import('node:fs/promises');const bytes=await readFile((await download.path())!);const zip=await JSZip.loadAsync(bytes);const manifest=JSON.parse(await zip.file('component.json')!.async('string'));
 expect(manifest.fields.find((field:{key:string})=>field.key==='title').default).toBe('已确认的星澜成果');expect(calls).toBe(1);
});
