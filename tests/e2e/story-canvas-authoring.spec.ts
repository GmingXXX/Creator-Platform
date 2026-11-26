import {test,expect} from '@playwright/test';
test('拍照分支、节点编辑图层和导航图在预览及重开作品时保留',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(()=>{
  const storage=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  const work=storage.state.works.find((w:{id:string})=>w.id==='work-6');
  work.storyNodes=['start','photo','end'].map((type,i)=>({id:String(i),type,title:['序幕','留真','归来'][i],text:'现场体验',x:280*i,y:80}));
  work.storyEdges=[{id:'a',source:'0',target:'1',label:'去拍照'},{id:'b',source:'1',target:'2',label:'确认',trigger:'photoConfirm'}];localStorage.setItem('zhichuang-studio-v1',JSON.stringify(storage));
 });await page.reload();await page.goto('/#/dream/work-6');
 const edge=page.locator('.react-flow__edge').first();await expect(edge).toBeVisible();
 const knob=edge.locator('.react-flow__edgeupdater-target');await expect(knob).toHaveCount(1);
 const k=(await knob.boundingBox())!,pane=(await page.locator('.react-flow__pane').boundingBox())!;
 await page.mouse.move(k.x+k.width/2,k.y+k.height/2);await page.mouse.down();await page.mouse.move(pane.x+pane.width*.4,pane.y+pane.height*.7,{steps:12});await page.mouse.up();
 await expect(page.locator('.react-flow__edge')).toHaveCount(1);await page.getByRole('button',{name:'撤销断开'}).click();await expect(page.locator('.react-flow__edge')).toHaveCount(2);
 const map=page.locator('.react-flow__minimap');await expect(map).toHaveCount(0);
 await page.getByRole('button',{name:'导航图',exact:true}).click();await expect(map).toBeVisible();
 await page.getByRole('button',{name:'收起属性',exact:true}).click();await expect(page.locator('.studio-inspector')).toHaveCount(0);
 await page.locator('.react-flow__node').filter({hasText:'留真'}).dblclick();
 const detail=page.getByRole('dialog');await detail.getByRole('button',{name:'添加文本',exact:true}).click();await detail.getByLabel('控件名称',{exact:true}).fill('提示文字');
 await detail.getByLabel('内容',{exact:true}).fill('抬头微笑');await detail.getByRole('button',{name:'完成并返回流程'}).click();
 await page.getByRole('button',{name:'预览',exact:true}).click();await page.getByRole('button',{name:'去拍照',exact:true}).click();await expect(page.getByText('抬头微笑',{exact:true})).toBeVisible();await page.getByRole('button',{name:'拍摄样片'}).click();await page.getByRole('button',{name:'重拍'}).click();await page.getByRole('button',{name:'拍摄样片'}).click();await page.getByRole('button',{name:'确认照片'}).click();await expect(page.locator('.story-preview-body h2')).toHaveText('归来');
 await page.reload();await page.locator('.react-flow__node').filter({hasText:'留真'}).dblclick();await page.getByRole('button',{name:'图层',exact:true}).click();await expect(page.getByRole('button',{name:'提示文字',exact:true})).toBeVisible();
});
