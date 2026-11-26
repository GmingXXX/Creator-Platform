import {test,expect,type Page} from '@playwright/test';
async function editFirst(page:Page){
 await expect(page.locator('.react-flow__edge').first()).toBeVisible();
 const entry=page.getByRole('button',{name:'编辑节点画面',exact:true});
 await expect(async()=>{await page.locator('.react-flow__node').first().click();await expect(entry).toBeVisible({timeout:1000});}).toPass();
 await entry.click();
}
async function open(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page).toHaveURL(/#\/$/);
 await page.goto('/#/dream/work-6');await editFirst(page);
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'添加文本',exact:true})).toBeVisible();
 return dialog;
}
test('实画布编辑可扫码的二维码，锁定、隐藏、粘贴和刷新后保留',async({page})=>{
 const dialog=await open(page);
 await dialog.getByLabel('在画面显示标题与简介').uncheck();
 await expect(dialog.locator('.story-stage-caption')).toHaveCount(0);
 await dialog.getByRole('button',{name:'添加二维码',exact:true}).click();
 await dialog.getByLabel('扫码内容',{exact:true}).fill('https://example.org/taishan');
 await expect(dialog.getByRole('img',{name:'可扫描二维码'})).toBeVisible();
 await dialog.getByLabel('控件名称',{exact:true}).fill('扫码留影');
 await dialog.getByRole('button',{name:'图层',exact:true}).click();
 await dialog.getByRole('button',{name:'锁定扫码留影'}).click();
 await expect(dialog.getByLabel('扫码内容',{exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'解锁扫码留影'}).click();
 await dialog.getByRole('button',{name:'隐藏扫码留影'}).click();
 await expect(dialog.getByRole('img',{name:'可扫描二维码'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'显示扫码留影'}).click();
 await dialog.getByRole('button',{name:'复制控件',exact:true}).click();
 await dialog.getByRole('button',{name:'粘贴控件',exact:true}).click();
 await expect(dialog.getByLabel('控件名称',{exact:true})).toHaveValue('扫码留影 副本');
 await dialog.getByRole('button',{name:'完成并返回流程'}).click();
 await page.getByRole('button',{name:'保存',exact:true}).click();await page.reload();
 await editFirst(page);await expect(page.getByRole('img',{name:'可扫描二维码'})).toHaveCount(2);
});
test('素材与结果控件具有独立属性，支持拖入蒙版与网格定位',async({page})=>{
 const dialog=await open(page);
 await dialog.getByRole('button',{name:'网格吸附',exact:true}).click();
 await dialog.getByRole('button',{name:'添加蒙版',exact:true}).dragTo(dialog.getByLabel('节点画布'));
 await expect(dialog.getByLabel('填充颜色')).toBeVisible();await expect(dialog.getByLabel('不透明度')).toBeVisible();
 await dialog.getByRole('button',{name:'添加拍摄照片',exact:true}).click();
 await expect(dialog.getByLabel('结果来源')).toHaveValue('photo');
 await dialog.getByLabel('结果来源').selectOption('faceImage');
 await dialog.getByRole('button',{name:'事件',exact:false}).first().click();
 await expect(dialog.getByRole('button',{name:'添加事件'})).toBeVisible();
});
test('无素材节点在画布与试运行中使用同一作品底色和字体',async({page})=>{
 const dialog=await open(page);
 await page.evaluate(()=>{
  const key='zhichuang-studio-v1';const record=JSON.parse(localStorage.getItem(key)!);
  const w=record.state.works.find((item:{id:string})=>item.id==='work-6');
  const theme={...record.state.systems[0],id:'detail-theme',background:'#c5b18e',text:'#342a1d',font:'Georgia'};
  w.styleId=theme.id;w.storyNodes[0].media=undefined;w.storyNodes[0].mediaAssetId=undefined;
  record.state.systems.push(theme);localStorage.setItem(key,JSON.stringify(record));
 });await page.reload();await editFirst(page);
 const surface=dialog.getByLabel('节点画布');
 await expect(surface).toHaveCSS('background-color','rgb(197, 177, 142)');
 const font=await surface.evaluate(el=>getComputedStyle(el).fontFamily);
 await dialog.getByRole('button',{name:'预览本节点'}).click();
 await expect(page.locator('.story-preview-scene')).toHaveCSS('background-color','rgb(197, 177, 142)');
 await expect(page.locator('.story-preview-scene')).toHaveCSS('font-family',font);
});
test('已锁定的文字热点在试运行中可用键盘触发',async({page})=>{
 await open(page);
 await page.evaluate(()=>{
  const key='zhichuang-studio-v1',record=JSON.parse(localStorage.getItem(key)!);
  const w=record.state.works.find((item:{id:string})=>item.id==='work-6'),start=w.storyNodes.find((n:{type:string})=>n.type==='start'),end=w.storyNodes.find((n:{type:string})=>['end','ending'].includes(n.type));
  start.layers=[{id:'accessible-text',kind:'text',name:'进入结局',text:'进入结局',locked:true,x:5,y:5,width:22,height:12}];
  w.storyEdges=[{id:'text-branch',source:start.id,target:end.id,label:'继续',trigger:'layerClick',layerId:'accessible-text'}];
  localStorage.setItem(key,JSON.stringify(record));
 });await page.reload();await page.goto('/#/preview/work-6');
 const hot=page.getByRole('button',{name:'进入结局',exact:true});
 await expect(hot).toHaveAttribute('tabindex','0');await hot.focus();await page.keyboard.press('Space');
 await expect(page.getByRole('button',{name:'体验另一种结局',exact:true})).toBeVisible();
});

test('浏览长列表时仍能在组件、素材和图层之间切换',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 const dialog=await open(page);
 const panel=dialog.getByRole('complementary',{name:'节点创作资源'});
 await panel.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const tabs=panel.getByRole('button',{name:'图层',exact:true});
 const container=await panel.boundingBox(),button=await tabs.boundingBox();
 expect(button!.y).toBeGreaterThanOrEqual(container!.y);
 await tabs.click();
 await expect(panel.getByRole('heading',{name:'图层顺序'})).toBeVisible();
});
