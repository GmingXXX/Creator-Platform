import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  const skill=(id:string,name:string,instructions:string,publicValue=false)=>({id,name,description:name,input:'策划资料',steps:['核对来源后编排'],category:'展项编排',styleId:'',previewType:'text',author:'测试',version:'1.0',workspaceId:'personal',personal:!publicValue,public:publicValue,source:'uploaded',sourcePackage:{filename:'技能.zip',entry:'SKILL.md',instructions,files:[],hasScripts:false}});
  data.state.skills=[skill('auto-slides','企业智能演示编排','完整演示规则'.repeat(1000)+'演示正文末尾标记'),skill('auto-story','互动故事节点编排','保留不同结局，故事正文末尾标记'),skill('not-added','互动故事节点编排','社区未添加技能不得自动调用',true),skill('unrelated','诗词格律检查','无关技能不得调用')];
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));
 });
 await page.reload();
});

test('新建智能演示自动匹配技能，正文完整进入实际请求并写入项目',async({page})=>{
 let payload='';await page.route('**/api/ai/chat',route=>{payload=JSON.stringify(route.request().postDataJSON());return route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({title:'自动匹配演示',sections:[{title:'企业概况',bullets:['模拟企业资料'],narration:'欢迎了解模拟企业。',layout:'title'}]})}});});
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'智能演示',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('你想讲述什么？',{exact:true}).fill('基于企业资料制作智能演示');
 await expect(dialog.getByLabel('指定技能',{exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'选择模板',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'生成大纲',exact:true}).click();await expect(dialog.getByLabel('第1页正文要点',{exact:true})).toHaveValue('模拟企业资料');
 expect(payload).toContain('演示正文末尾标记');expect(payload).not.toContain('社区未添加技能不得自动调用');expect(payload).not.toContain('无关技能不得调用');
 await expect(dialog.getByText('本次参考技能：企业智能演示编排',{exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'创建并进入编辑器',exact:true}).click();await expect(page).toHaveURL(/#\/presentations\//);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0].creationPackage.skillIds)).toEqual(['auto-slides']);
});

test('新建互动影片只调用已添加故事技能并保存匹配记录',async({page})=>{
 let payload='';await page.route('**/api/ai/chat',route=>{payload=JSON.stringify(route.request().postDataJSON());return route.fulfill({json:{model:'deepseek-flash',content:JSON.stringify({title:'故事匹配',nodes:[{id:'s',type:'start',title:'山门',text:'开始探索'},{id:'e',type:'end',title:'抵达',text:'体验结束'}],edges:[{source:'s',target:'e',label:'出发'}]})}});});
 await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'互动影片',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('体验流程',{exact:false}).fill('进入山门，沿山路抵达山顶，结束体验');
 await dialog.getByRole('button',{name:'生成节点草稿',exact:true}).click();await expect(dialog.locator('.creation-node')).toHaveCount(2);
 expect(payload).toContain('故事正文末尾标记');expect(payload).not.toContain('社区未添加技能不得自动调用');expect(payload).not.toContain('演示正文末尾标记');
 await expect(dialog.getByText('本次参考技能：互动故事节点编排',{exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'创建并进入节点画布',exact:true}).click();await expect(page).toHaveURL(/#\/dream\//);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0].creationPackage.skillIds)).toEqual(['auto-story']);
});
