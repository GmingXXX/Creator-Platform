import {test,expect} from '@playwright/test';
test('真实剧情条件与延时分支在预览生效，复制节点保留规则',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(()=>{
  const key='zhichuang-studio-v1',saved=JSON.parse(localStorage.getItem(key)!);
  const work=saved.state.works.find((w:{id:string})=>w.id==='work-6');
  work.storyNodes=['入口','观云','留真'].map((title,i)=>({id:'s'+i,type:['start','scene','end'][i],title,text:'',x:270*i,y:100}));
  work.storyEdges=[{id:'z0',source:'s0',target:'s1',label:'登高'},{id:'z1',source:'s1',target:'s2',label:'走向结局'}];
  localStorage.setItem(key,JSON.stringify(saved));
 });await page.reload();await page.goto('/#/dream/work-6');
 await page.locator('.react-flow__node[data-id="s1"]').click();
 await page.getByRole('button',{name:/点击「走向结局」/}).click();
 await page.getByLabel('触发时机').selectOption('delay');await page.getByLabel('停留秒数').fill('1');
 await page.locator('.story-event-fields summary').filter({hasText:'生效条件'}).click();
 await page.getByLabel('生效条件',{exact:true}).selectOption('visited');await page.getByLabel('判断哪一幕').selectOption('s0');
 await page.getByRole('button',{name:'保存',exact:true}).click();await page.reload();
 await page.getByRole('button',{name:'预览',exact:true}).click();
 await page.getByRole('button',{name:'登高',exact:true}).click();
 await expect(page.locator('.story-preview-body h2')).toHaveText('留真');
 await page.getByRole('button',{name:'关闭对话框'}).click();await page.locator('.react-flow__node[data-id="s1"]').click();
 await page.getByRole('button',{name:'复制节点',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).click();
 const copy=await page.evaluate(()=>{const w=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((v:{id:string})=>v.id==='work-6');const n=w.storyNodes.find((v:{title:string})=>v.title==='观云 副本');return w.storyEdges.find((e:{source:string})=>e.source===n.id);});
 expect(copy).toMatchObject({trigger:'delay',delaySeconds:1,target:'s2',label:'走向结局\n[条件] visited:s0'});
});

test('视频背景换为图片后，检查流程阻止无法触发的旧出线，修改触发时机即可预览',async({page})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(()=>{
  const key='zhichuang-studio-v1',saved=JSON.parse(localStorage.getItem(key)!);
  const work=saved.state.works.find((w:{id:string})=>w.id==='work-6');
  work.storyNodes=[{id:'begin',type:'start',title:'序幕',text:'',x:20,y:100,media:'/media/culture.svg'},{id:'finish',type:'end',title:'谢幕',text:'',x:360,y:100}];
  work.storyEdges=[{id:'obsolete',source:'begin',target:'finish',trigger:'videoEnd',label:'下一幕'}];localStorage.setItem(key,JSON.stringify(saved));
 });await page.reload();await page.goto('/#/dream/work-6');
 await page.getByRole('button',{name:'预览',exact:true}).click();
 await expect(page.locator('.story-validation-panel')).toContainText('主素材不是视频');await expect(page.locator('.story-experience')).toHaveCount(0);
 await page.locator('.react-flow__node[data-id="begin"]').click();await page.getByRole('button',{name:/主素材 · 视频播放完毕/}).click();
 await page.getByLabel('触发时机').selectOption('click');await page.getByRole('button',{name:'预览',exact:true}).click();
 await page.getByRole('button',{name:'下一幕',exact:true}).click();await expect(page.locator('.story-preview-body h2')).toHaveText('谢幕');
});
