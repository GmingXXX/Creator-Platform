import {test,expect,type Page} from '@playwright/test';
import JSZip from 'jszip';
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const input=(page:Page)=>page.locator('.res-page > input[type=file]');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="navy"/></svg>';
test.beforeEach(async({page})=>{await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();await page.goto('/#/library');});
test('六种分类同步按钮、弹窗、文件筛选和保存位置',async({page})=>{
 for(const [category,label,extension] of [['all','上传素材','.zip'],['image','上传图片','.png'],['video','上传视频','.mp4'],['audio','上传音频','.wav'],['document','上传文档','.pdf'],['component','上传组件包','.zip']]){
  await page.goto(`/#/library?type=${category}`);await page.getByRole('button',{name:label,exact:true}).first().click();const dialog=page.getByRole('dialog',{name:label,exact:true});await expect(dialog).toBeVisible();await expect(dialog).toContainText('保存到：我的素材库');await expect(input(page)).toHaveAttribute('accept',new RegExp(extension.replace('.','\\.')));
  if(category==='component')await expect(dialog).toContainText('包含 HTML');
  await dialog.getByRole('button',{name:'完成',exact:true}).click();
 }
});
test('图片页错类型不入库，正确上传清除旧筛选并刷新保留',async({page})=>{
 await page.goto('/#/library?type=image');const before=(await state(page)).assets.length;
 await input(page).setInputFiles({name:'不属于图片.txt',mimeType:'text/plain',buffer:Buffer.from('说明')});await expect(page.getByRole('dialog')).toContainText('此文件属于文档资料');expect((await state(page)).assets.length).toBe(before);await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.getByPlaceholder('搜索素材名称、说明或标签').fill('不会匹配的新素材');await page.getByLabel('素材来源').selectOption('generated');
 await input(page).setInputFiles({name:'分类上传测试.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await expect(page.getByText('已添加',{exact:true})).toBeVisible();await page.getByRole('button',{name:'完成',exact:true}).click();await expect(page.getByRole('button',{name:'预览分类上传测试.svg',exact:true})).toBeVisible();await expect(page.getByPlaceholder('搜索素材名称、说明或标签')).toHaveValue('');await expect(page.getByLabel('素材来源')).toHaveValue('all');
 await page.reload();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();await page.goto('/#/library?type=image');await expect(page.getByRole('button',{name:'预览分类上传测试.svg',exact:true})).toBeVisible();
});
test('全部素材混合上传自动分类；上传弹窗拖入只处理一次',async({page})=>{
 await page.getByRole('button',{name:'上传素材',exact:true}).first().click();const transfer=await page.evaluateHandle(svg=>{const d=new DataTransfer();d.items.add(new File([svg],'混合图片.svg',{type:'image/svg+xml'}));d.items.add(new File(['业务说明'],'混合资料.txt',{type:'text/plain'}));return d;},svg);
 await page.getByRole('dialog').locator('.res-upload-zone').dispatchEvent('drop',{dataTransfer:transfer});await expect(page.getByText('已添加',{exact:true})).toHaveCount(2);const assets=(await state(page)).assets.filter((a:any)=>a.name.startsWith('混合'));expect(assets.map((a:any)=>a.kind).sort()).toEqual(['document','image']);await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.getByRole('button',{name:'预览混合图片.svg',exact:true}).click();await expect(page.getByRole('dialog',{name:'混合图片.svg',exact:true})).toBeVisible();const blocked=await page.evaluateHandle(()=>{const d=new DataTransfer();d.items.add(new File(['不可误传'],'遮罩误传.txt',{type:'text/plain'}));return d;});await page.locator('.res-page').dispatchEvent('drop',{dataTransfer:blocked});expect((await state(page)).assets.some((a:any)=>a.name==='遮罩误传.txt')).toBe(false);
});
test('ZIP按检查结果区分文档与组件，组件保留预览保存流程',async({page})=>{
 const plain=new JSZip();plain.file('说明.txt','普通资料');const component=new JSZip();component.file('index.html','<h1>分类组件验收</h1>');
 await page.goto('/#/library?type=component');await input(page).setInputFiles({name:'普通资料.zip',mimeType:'application/zip',buffer:await plain.generateAsync({type:'nodebuffer'})});await expect(page.getByRole('dialog')).toContainText('没有 HTML 入口');await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.goto('/#/library?type=document');await input(page).setInputFiles({name:'不应作为文档.zip',mimeType:'application/zip',buffer:await component.generateAsync({type:'nodebuffer'})});await expect(page.getByRole('dialog')).toContainText('此文件属于组件');expect((await state(page)).assets.some((a:any)=>a.name==='不应作为文档.zip')).toBe(false);await page.getByRole('button',{name:'完成',exact:true}).click();
 await page.goto('/#/library?type=component');await input(page).setInputFiles({name:'分类组件.zip',mimeType:'application/zip',buffer:await component.generateAsync({type:'nodebuffer'})});const wizard=page.getByRole('dialog',{name:'导入组件',exact:true});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'预览与试编辑',exact:true}).click();await expect(page.frameLocator('iframe[title="组件运行预览"]').getByRole('heading',{name:'分类组件验收'})).toBeVisible();await wizard.getByRole('button',{name:'保存到素材库',exact:true}).click();await expect(wizard).toHaveCount(0);expect((await state(page)).assets.some((a:any)=>a.name==='分类组件'&&a.kind==='html')).toBe(true);
});
test('空间共享上传显示并保存到明确项目',async({page})=>{
 await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'信泰企业展厅'}).click();await page.goto('/#/library?type=document&scope=shared');await page.getByRole('button',{name:'上传文档',exact:true}).first().click();await expect(page.getByRole('dialog')).toContainText('信泰企业展厅 · 空间共享素材');await input(page).setInputFiles({name:'项目说明.txt',mimeType:'text/plain',buffer:Buffer.from('项目资料')});await expect(page.getByText('已添加',{exact:true})).toBeVisible();expect((await state(page)).assets.find((a:any)=>a.name==='项目说明.txt').workspaceId).toBe('xintai');
});
