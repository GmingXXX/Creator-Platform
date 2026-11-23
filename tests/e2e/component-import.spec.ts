import {test,expect,type Page} from '@playwright/test';
import JSZip from 'jszip';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reloadAndReopen} from './reload-helpers';
import type {StudioData} from '../../src/domain/types';

const studio=(page:Page):Promise<StudioData>=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const wizard=(page:Page)=>page.getByRole('dialog',{name:'导入组件',exact:true});
async function upload(page:Page,name:string,buffer:Buffer,mimeType='text/html'){
  await page.locator('.res-page > input[type=file]').setInputFiles({name,mimeType,buffer});
}
async function preview(page:Page){
  await wizard(page).getByRole('button',{name:'预览与试编辑',exact:true}).click();
  await expect(page.locator('iframe[title="组件运行预览"]')).toBeVisible();
}
async function editablePackage(options:{missing?:boolean;noBridge?:boolean}={}){
  const zip=new JSZip();
  zip.file('component.json',JSON.stringify({schemaVersion:1,name:'可编辑企业指标',description:'展示企业创新指标，支持调整标题、主题色与数值。',entry:'index.html',bridge:'zhichuang-component-v1',fields:[
    {key:'title',label:'标题',type:'text',default:'企业展示'},
    {key:'accent',label:'主题色',type:'color',default:'#2563eb'},
    {key:'count',label:'数值',type:'number',default:12,min:0,max:999},
  ]}));
  zip.file('index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><style>body{margin:0;padding:40px;color:#fff;background:#2563eb;font-family:system-ui}h1{font-size:30px}#metric{font-size:48px}</style>${options.missing?'<script src="missing-library.js"></script>':''}</head><body><h1>企业展示</h1><p id="metric">12</p>${options.noBridge?'':`<script>window.ZhichuangComponent.subscribe(function(props){document.querySelector('h1').textContent=props.title;document.body.style.backgroundColor=props.accent;document.querySelector('#metric').textContent=String(props.count);});</script>`}</body></html>`);
  return zip.generateAsync({type:'nodebuffer'});
}

test.beforeEach(async({page})=>{
  await page.goto('/#/login');
  await page.getByLabel('账号',{exact:true}).fill('jiming');
  await page.getByLabel('密码',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'进入工作台'}).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/library');
  await expect(page.getByRole('heading',{name:'我的素材库',exact:true})).toBeVisible();
});

test('普通 HTML 先检查与预览，取消不会保存，确认后保留原始内容',async({page})=>{
  const before=(await studio(page)).assets.length;
  await upload(page,'历史展项.html',Buffer.from('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><h1>原始展项内容</h1></body></html>'));
  await expect(wizard(page)).toBeVisible();
  expect((await studio(page)).assets).toHaveLength(before);
  await expect(wizard(page)).toContainText(/位置.*尺寸/);
  await wizard(page).getByRole('button',{name:'取消',exact:true}).click();
  expect((await studio(page)).assets).toHaveLength(before);

  await upload(page,'历史展项.html',Buffer.from('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><h1>原始展项内容</h1></body></html>'));
  await preview(page);
  await expect(page.frameLocator('iframe[title="组件运行预览"]').getByRole('heading',{name:'原始展项内容'})).toBeVisible();
  await expect(wizard(page)).toContainText(/位置.*尺寸/);
  await wizard(page).getByRole('button',{name:'保存到素材库',exact:true}).click();
  await expect(wizard(page)).toHaveCount(0);
  const asset=(await studio(page)).assets.find(item=>item.source==='uploaded'&&item.kind==='html');
  expect(asset).toBeTruthy();
  await reloadAndReopen(page);
  await page.getByRole('button',{name:`预览${asset!.name}`,exact:true}).click();
  await expect(page.frameLocator('.res-html-preview').getByRole('heading',{name:'原始展项内容'})).toBeVisible();
});

test('普通资料 ZIP 保持文档上传流程',async({page})=>{
  const zip=new JSZip();zip.file('说明.txt','这是普通资料，不是可运行组件。');
  await upload(page,'普通资料包.zip',await zip.generateAsync({type:'nodebuffer'}),'application/zip');
  await expect(page.getByText('已添加',{exact:true})).toBeVisible();
  await expect(wizard(page)).toHaveCount(0);
  const asset=(await studio(page)).assets.find(item=>item.name==='普通资料包.zip');
  expect(asset?.kind).toBe('document');
});

test('无清单的 HTML 资源 ZIP 可选择入口，保留脚本顺序与相对资源',async({page})=>{
  const zip=new JSZip();
  zip.file('展项/index.html','<h1>请选择另一个入口体验</h1>');
  zip.file('展项/pages/demo.html','<!doctype html><html><head><meta charset="utf-8"><title>普通资源包</title><link rel="stylesheet" href="../assets/style.css"><script defer src="../assets/app.js"></script></head><body><h1 id="title">加载中</h1><img src="../assets/dot.svg"></body></html>');
  zip.file('展项/assets/style.css','body{background:#14283f;color:white}h1{font-size:28px}');
  zip.file('展项/assets/app.js','document.getElementById("title").textContent="普通 ZIP 原始效果";');
  zip.file('展项/assets/dot.svg','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="red"/></svg>');
  zip.file('__MACOSX/._demo.html','metadata');
  await upload(page,'普通组件资源包.zip',await zip.generateAsync({type:'nodebuffer'}),'application/zip');
  await expect(wizard(page)).toBeVisible();
  await expect(wizard(page).getByRole('button',{name:'预览与试编辑',exact:true})).toBeDisabled();
  await wizard(page).getByLabel('HTML 入口',{exact:true}).selectOption('展项/pages/demo.html');
  await preview(page);
  const frame=page.frameLocator('iframe[title="组件运行预览"]');
  await expect(frame.getByRole('heading',{name:'普通 ZIP 原始效果'})).toBeVisible();
  await expect(frame.locator('body')).toHaveCSS('background-color','rgb(20, 40, 63)');
  await expect(frame.locator('img')).toHaveJSProperty('naturalWidth',40);
  await wizard(page).getByRole('button',{name:'保存到素材库',exact:true}).click();
  await expect(wizard(page)).toHaveCount(0);
  await page.getByRole('button',{name:'预览普通资源包',exact:true}).click();
  await expect(page.frameLocator('.res-html-preview').getByRole('heading',{name:'普通 ZIP 原始效果'})).toBeVisible();
});

test('标准组件包可以真实试编辑，保存重开、插入画布与离线导出保留参数',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const before=(await studio(page)).assets.length;
  await upload(page,'企业指标组件.zip',await editablePackage(),'application/zip');
  await expect(wizard(page)).toBeVisible();
  expect((await studio(page)).assets).toHaveLength(before);
  await preview(page);
  const frame=page.frameLocator('iframe[title="组件运行预览"]');
  await expect(frame.getByRole('heading',{name:'企业展示',exact:true})).toBeVisible();
  await wizard(page).getByLabel('标题',{exact:true}).fill('海洋科技成果');
  await expect(frame.getByRole('heading',{name:'海洋科技成果',exact:true})).toBeVisible();
  await wizard(page).getByLabel('主题色',{exact:true}).fill('#f97316');
  await expect(frame.locator('body')).toHaveCSS('background-color','rgb(249, 115, 22)');
  await wizard(page).getByLabel('数值',{exact:true}).fill('86');
  await expect(frame.locator('#metric')).toHaveText('86');
  await mkdir('output/验收截图',{recursive:true});
  await page.screenshot({path:'output/验收截图/component-import-trial.png',animations:'disabled'});
  await wizard(page).getByRole('button',{name:'保存到素材库',exact:true}).click();
  await expect(wizard(page)).toHaveCount(0);
  const imported=(await studio(page)).assets.find(item=>item.name==='可编辑企业指标');
  expect(imported?.kind).toBe('html');
  expect(imported?.src).toMatch(/^idb:/);

  await reloadAndReopen(page);
  await page.getByRole('button',{name:'预览可编辑企业指标',exact:true}).click();
  const savedFrame=page.frameLocator('.res-html-preview');
  await expect(savedFrame.getByRole('heading',{name:'海洋科技成果',exact:true})).toBeVisible();
  await expect(savedFrame.locator('#metric')).toHaveText('86');
  await expect(savedFrame.locator('body')).toHaveCSS('background-color','rgb(249, 115, 22)');
  await page.getByRole('dialog').getByRole('button',{name:'插入画布',exact:true}).click();
  await page.getByLabel('目标展项',{exact:true}).selectOption('work-1');
  await page.getByRole('button',{name:'添加并打开画布',exact:true}).click();
  await expect(page).toHaveURL(/#\/editor\/work-1$/);
  const canvasFrame=page.frameLocator('.scene-board iframe').last();
  await expect(canvasFrame.getByRole('heading',{name:'海洋科技成果',exact:true})).toBeVisible();
  await expect(canvasFrame.locator('#metric')).toHaveText('86');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出管理平台运行包',exact:true}).click();
  const download=await pending;
  const exported=await JSZip.loadAsync(await readFile((await download.path())!));
  const folder=await mkdtemp(join(tmpdir(),'zc-component-offline-'));
  for (const file of Object.values(exported.files)) {
    const target=resolve(folder,file.name);
    expect(target.startsWith(folder+sep)).toBe(true);
    if(file.dir) await mkdir(target,{recursive:true});
    else { await mkdir(dirname(target),{recursive:true});await writeFile(target,await file.async('nodebuffer')); }
  }
  const offline=await browser.newContext({offline:true});
  try {
    const player=await offline.newPage();
    await player.goto(pathToFileURL(join(folder,'index.html')).href);
    await expect(player.frameLocator('iframe').last().getByRole('heading',{name:'海洋科技成果',exact:true})).toBeVisible();
    await expect(player.frameLocator('iframe').last().locator('#metric')).toHaveText('86');
  } finally { await offline.close(); }
  expect(errors).toEqual([]);
});

test('缺少资源会阻止预览和入库，并允许重新上传',async({page})=>{
  const before=(await studio(page)).assets.length;
  await upload(page,'缺资源组件.zip',await editablePackage({missing:true}),'application/zip');
  await expect(wizard(page)).toBeVisible();
  await expect(wizard(page)).toContainText(/缺少|未找到/);
  await expect(wizard(page).getByRole('button',{name:'预览与试编辑',exact:true})).toBeDisabled();
  await expect(wizard(page).getByRole('button',{name:'重新上传',exact:true})).toBeVisible();
  expect((await studio(page)).assets).toHaveLength(before);
  await wizard(page).getByRole('button',{name:'取消',exact:true}).click();
  expect((await studio(page)).assets).toHaveLength(before);
});

test('1024 宽度下可检查、试编辑并取消，焦点与滚动不遮挡操作',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await upload(page,'窄屏组件.zip',await editablePackage(),'application/zip');
  await expect(wizard(page).getByRole('button',{name:'预览与试编辑',exact:true})).toBeInViewport();
  await preview(page);
  await expect(wizard(page).getByRole('button',{name:'保存到素材库',exact:true})).toBeInViewport();
  await expect(wizard(page).getByRole('button',{name:'取消',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await wizard(page).getByLabel('标题',{exact:true}).fill('窄屏试编辑');
  await expect(page.frameLocator('iframe[title="组件运行预览"]').getByRole('heading',{name:'窄屏试编辑'})).toBeVisible();
  await page.screenshot({path:'output/验收截图/component-import-1024.png',animations:'disabled'});
  await wizard(page).getByRole('button',{name:'取消',exact:true}).click();
  expect((await studio(page)).assets.some(item=>item.name==='可编辑企业指标')).toBe(false);
});

test('声明参数但没有连接编辑接口时，不显示可编辑成功或允许保存',async({page})=>{
  await upload(page,'无接口组件.zip',await editablePackage({noBridge:true}),'application/zip');
  await preview(page);
  await expect(wizard(page).getByLabel('标题',{exact:true})).toBeDisabled();
  await expect(wizard(page)).toContainText('未连接到编辑接口',{timeout:12000});
  await expect(wizard(page).getByRole('button',{name:'保存到素材库',exact:true})).toBeDisabled();
  await wizard(page).getByRole('button',{name:'取消',exact:true}).click();
});

test('批量上传中取消一个组件后，继续保存普通资料且错误仍可查看',async({page})=>{
  const before=(await studio(page)).assets.length;
  await page.locator('.res-page > input[type=file]').setInputFiles([
    {name:'待取消组件.html',mimeType:'text/html',buffer:Buffer.from('<h1>取消</h1>')},
    {name:'批量资料.txt',mimeType:'text/plain',buffer:Buffer.from('批量资料')},
    {name:'无效压缩包.zip',mimeType:'application/zip',buffer:Buffer.from('invalid')},
  ]);
  await wizard(page).getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'上传素材',exact:true})).toContainText('失败');
  await expect(page.getByRole('dialog',{name:'上传素材',exact:true})).toContainText('已取消');
  expect((await studio(page)).assets).toHaveLength(before+1);
  expect((await studio(page)).assets.some(asset=>asset.name==='批量资料.txt')).toBe(true);
});

test('从画布上传普通组件 ZIP 复用同一检查流程，保存后确认插入',async({page})=>{
  await page.goto('/#/editor/work-1');
  await page.locator('.component-tile').filter({hasText:'HTML 交互程序'}).click();
  const zip=new JSZip();zip.file('index.html','<html><head><title>画布入口包</title></head><body><h1>画布入口验证</h1></body></html>');
  await page.getByLabel('上传可用素材',{exact:true}).setInputFiles({name:'画布入口包.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await preview(page);
  await wizard(page).getByRole('button',{name:'保存并选择',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'使用此素材',exact:true}).click();
  await expect(page.frameLocator('.scene-board iframe').last().getByRole('heading',{name:'画布入口验证'})).toBeVisible();
});

test('提供可下载并重新导入的示例 ZIP，支持五种参数真实试编辑',async({page})=>{
  await page.getByRole('button',{name:'上传素材',exact:true}).first().click();
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载组件包示例',exact:true}).click();
  const download=await pending;
  await mkdir('output/组件上传示例',{recursive:true});
  const example='output/组件上传示例/企业成果展示卡.zip';
  await download.saveAs(example);
  await upload(page,'企业成果展示卡.zip',await readFile(example),'application/zip');
  await expect(wizard(page)).toContainText('声明了 5 个编辑参数');
  await page.screenshot({path:'output/验收截图/component-import-checks.png',animations:'disabled'});
  await preview(page);
  await wizard(page).getByLabel('标题',{exact:true}).fill('智创，让创意成为作品');
  await wizard(page).getByLabel('显示成果数据',{exact:true}).uncheck();
  const frame=page.frameLocator('iframe[title="组件运行预览"]');
  await expect(frame.locator('#metric')).toBeHidden();
  await expect(frame.getByRole('heading',{name:'智创，让创意成为作品'})).toBeVisible();
  await wizard(page).getByRole('button',{name:'窄屏预览',exact:true}).click();
  await expect(frame.getByRole('heading',{name:'智创，让创意成为作品'})).toBeVisible();
  await wizard(page).getByRole('button',{name:'横屏预览',exact:true}).click();
  await wizard(page).getByRole('button',{name:'恢复默认参数',exact:true}).click();
  await expect(frame.getByRole('heading',{name:'让创新，成为看得见的成果'})).toBeVisible();
  await expect(frame.locator('#metric')).toBeVisible();
  await page.screenshot({path:'output/验收截图/component-import-example.png',animations:'disabled'});
});
