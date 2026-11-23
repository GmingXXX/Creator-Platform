import {expect,test,type Page,type Route} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {reloadAndReopen} from './reload-helpers';

const output='output/多方参考与经验整理_20261117';
const currentId='creative-current';
const sourceA='creative-source-interaction';
const sourceB='creative-source-ui';
const assetId='creative-associated-image';
const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const current=(page:Page)=>state(page).then(data=>data.works.find((work:any)=>work.id===currentId));

async function setup(page:Page,chat?:(route:Route)=>Promise<unknown>){
 await page.route('**/api/ai/**',route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:false}});
  if(pathname.endsWith('/chat')&&chat)return chat(route);
  return json(route,{error:'验收阻止未预期的模型或媒体请求'},503);
 });
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
 await page.evaluate(({currentId,sourceA,sourceB,assetId})=>{
  const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  const base=data.state.works.find((work:any)=>work.id==='work-1');
  const makeWork=(id:string,title:string,background:string)=>({...structuredClone(base),id,projectId:id,
   workspaceId:'personal',title,styleId:'',aiModel:'demo',revision:1,creationPackage:undefined,
   references:[],experience:undefined,deletedAt:undefined,
   pages:base.pages.map((page:any,index:number)=>({...page,id:`${id}-page-${index}`,background,backgroundImage:undefined,backgroundAssetId:undefined,
    nodes:page.nodes.map((node:any,nodeIndex:number)=>({...node,id:`${id}-node-${nodeIndex}`,assetId:undefined,src:undefined,
     content:node.type==='text'?`${title}原文客户专属${nodeIndex}`:node.content,
     color:'#f5f5f5',background:node.type==='shape'?'#2680a0':node.background,
     items:node.items?.map((item:any)=>({...item,image:undefined,assetId:undefined})),
    })),
   })),
  });
  const target=makeWork(currentId,'当前客户展项','#163044');
  const a=makeWork(sourceA,'交互参考 A','#102030');
  const b=makeWork(sourceB,'视觉参考 B','#334455');
  data.state.works=[target,a,b,...data.state.works];
  data.state.assets=[{id:assetId,workspaceId:'personal',name:'关联成果素材',kind:'image',src:'/media/industrial.svg',preview:'/media/industrial.svg',
   description:'当前客户展项的普通图片素材',tags:['验收'],author:'验收',createdAt:new Date().toISOString(),source:'generated',public:false,
   package:{id:'creative-image-package',version:'1.0',prompt:'素材验收',files:[],skillIds:[],params:{experienceWorkId:currentId},complete:true}},...data.state.assets];
  data.state.activeWorkspaceId='personal';
  const draft=data.state.drafts.find((draft:any)=>draft.workspaceId==='personal');
  data.state.activeDraftId=draft.id;draft.text='';draft.references=[];draft.model='deepseek-flash';
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));
 },{currentId,sourceA,sourceB,assetId});
 await page.reload();
 await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
 await mkdir(output,{recursive:true});
}

async function addReference(page:Page,id:string,dimension:'interaction'|'ui',note:string){
 await page.getByRole('button',{name:'创作参考',exact:true}).click();
 const manager=page.getByRole('dialog',{name:'创作参考',exact:true});
 if(await manager.isVisible())await manager.getByRole('button',{name:'添加参考展项',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'添加参考展项',exact:true});
 await dialog.locator(`[data-reference-source="work:${id}"] .reference-source-select`).click();
 if(dimension==='ui'){await dialog.getByRole('checkbox',{name:'交互方式',exact:true}).uncheck();await dialog.getByRole('checkbox',{name:'UI 风格',exact:true}).check();}
 await dialog.getByLabel('参考补充说明',{exact:true}).fill(note);
 await dialog.getByRole('button',{name:'加入参考',exact:true}).click();
 await expect(dialog).toHaveCount(0);
}

async function openAgent(page:Page){
 await page.goto(`/#/editor/${currentId}`);
 await expect(page.locator('.scene-board')).toBeVisible();
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
 await page.getByLabel('修改模型',{exact:true}).selectOption('demo');
}

test('首页组合交互与UI参考，范围修改保留草稿，参考实际进入生成请求和工程',async({page})=>{
 const chatBodies:any[]=[];
 await setup(page,async route=>{
  chatBodies.push(route.request().postDataJSON());
  return json(route,{model:'deepseek-flash',content:JSON.stringify({mode:'create',answer:'交互参考 A，UI 参考 B；客户事实采用本次资料。',title:'多方参考生成验收',type:'时间演进型',sections:[
   {title:'客户创立',body:'当前客户提供的创立事件',year:'2001'},
   {title:'客户转型',body:'当前客户提供的转型事件',year:'2012'},
   {title:'客户创新',body:'当前客户提供的创新事件',year:'2026'},
  ]})});
 });
 const prompt='制作当前客户的企业发展历程展项。2001 创立，2012 转型，2026 创新；交互参考 A，UI 参考 B。';
 await page.getByLabel('创作需求',{exact:true}).fill(prompt);
 await addReference(page,sourceA,'interaction','保留点击展开和返回总览');
 await addReference(page,sourceB,'ui','参考卡片外观，不沿用原客户文字');
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(2);
 await page.getByRole('button',{name:'创作参考',exact:true}).click();
 await page.getByRole('button',{name:'编辑参考 视觉参考 B UI 风格',exact:true}).click();
 const edit=page.getByRole('dialog',{name:'编辑参考范围',exact:true});
 await edit.getByLabel('参考范围',{exact:true}).selectOption(`page:${sourceB}-page-0`);
 await edit.getByLabel('参考补充说明',{exact:true}).fill('只借鉴第一页排版，不采用旧客户事实');
 await edit.getByRole('button',{name:'保存参考',exact:true}).click();
 await expect(page.getByLabel('创作需求',{exact:true})).toHaveValue(prompt);
 await page.getByRole('button',{name:'创作参考',exact:true}).click();
 await page.getByRole('button',{name:'移除参考 交互参考 A 交互方式',exact:true}).click();
 await page.getByRole('button',{name:'完成',exact:true}).click();
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(1);
 await addReference(page,sourceA,'interaction','保留点击展开和返回总览');
 await page.screenshot({path:`${output}/01-首页多方参考.png`,fullPage:true});
 await page.getByRole('button',{name:'发送创作需求',exact:true}).click();
 await expect(page.getByRole('heading',{name:'确认内容与配图',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'确认内容，继续生成',exact:true}).click();
 await expect.poll(async()=>{
  const data=await state(page);return data.runs.find((run:any)=>run.prompt===prompt)?.status;
 },{timeout:20000}).toBe('complete');
 expect(chatBodies).toHaveLength(1);
 const request=JSON.stringify(chatBodies[0]);
 expect(request).toContain('交互参考 A');expect(request).toContain('视觉参考 B');
 expect(request).toContain('交互方式');expect(request).toContain('UI 风格');
 expect(request).not.toContain('原文客户专属');
 const data=await state(page),run=data.runs.find((item:any)=>item.prompt===prompt),work=data.works.find((item:any)=>item.id===run.workId);
 expect(work.references).toHaveLength(2);
 expect(work.references.find((ref:any)=>ref.dimension==='ui').scope).toBe(`page:${sourceB}-page-0`);
 expect(work.references.every((ref:any)=>Number.isInteger(ref.sourceRevision))).toBe(true);
 await expect(page.getByRole('button',{name:'整理制作经验',exact:true})).toBeVisible();
 await page.screenshot({path:`${output}/02-多方参考生成结果.png`,fullPage:true});
});

test('已有作品手动编辑后整理经验，修正刷新保留，再次整理不覆盖，提炼为未启用Skill草稿',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await setup(page);await openAgent(page);
 await addReference(page,sourceA,'interaction','分类浏览和展开详情');
 await addReference(page,sourceB,'ui','卡片视觉参考');
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(2);
 await page.getByRole('button',{name:'关闭 Agent 助手',exact:true}).click();
 await page.locator('.node-hitbox').nth(1).click();
 await page.getByRole('textbox',{name:'文本内容',exact:true}).fill('手动编辑后的企业创新历程');
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
 const before=await current(page);
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 await page.getByRole('dialog',{name:'选择经验整理范围',exact:true}).getByRole('button',{name:'开始整理',exact:true}).click();
 const summary=page.getByRole('region',{name:'制作经验摘要',exact:true});
 await expect(summary).toBeVisible();
 await expect(summary).toContainText('交互参考 A');await expect(summary).toContainText('视觉参考 B');
 await expect(summary).toContainText('未验证');
 const organized=await current(page);
 expect(organized.pages[0].nodes[1].content).toBe('手动编辑后的企业创新历程');
 expect(organized.experience.workRevision).toBe(organized.revision);
 expect(organized.experience.target.scope).toBe('work');
 expect(organized.references).toHaveLength(2);
 expect(organized.id).toBe(before.id);
 await page.getByRole('button',{name:'修改整理结果',exact:true}).click();
 const correction='用户确认：按业务转型划分阶段；此方法尚未经过现场观众验证。';
 await page.getByLabel('可复用做法',{exact:true}).fill(correction);
 await page.getByRole('button',{name:'保存整理结果',exact:true}).click();
 await expect(summary).toContainText(correction);
 const edited=await current(page),experienceId=edited.experience.id;
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 await page.getByRole('dialog',{name:'选择经验整理范围',exact:true}).getByRole('button',{name:'开始整理',exact:true}).click();
 await expect.poll(async()=>(await current(page)).experience.version).toBeGreaterThan(edited.experience.version);
 expect((await current(page)).experience.id).toBe(experienceId);
 expect((await current(page)).experience.sections.lessons).toBe(correction);
 await reloadAndReopen(page);
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
 await expect(page.getByRole('region',{name:'制作经验摘要',exact:true})).toContainText(correction);
 await page.screenshot({path:`${output}/03-Agent制作经验.png`,fullPage:true});
 await page.setViewportSize({width:1024,height:768});
 await expect(page.getByLabel('修改当前作品',{exact:true})).toBeInViewport();
 await expect(page.getByRole('button',{name:'发送修改',exact:true})).toBeInViewport();
 await page.screenshot({path:`${output}/05-小屏Agent输入常驻.png`,fullPage:true});
 await page.setViewportSize({width:1440,height:960});
 const skillsBefore=(await state(page)).skills.length;
 await page.getByRole('button',{name:'提炼为 Skill',exact:true}).click();
 const skill=page.getByRole('dialog',{name:'提炼为 Skill',exact:true});
 await skill.getByLabel('方法名称',{exact:true}).fill('业务转型阶段组织方法');
 await skill.getByLabel('方法说明',{exact:true}).fill(correction);
 await skill.getByLabel('所需资料',{exact:true}).fill('已确认的企业事件和阶段划分依据');
 await skill.getByLabel('制作步骤',{exact:true}).fill('核对事件来源\n依据业务变化划分阶段\n检查展项文字和交互');
 await skill.getByRole('button',{name:'保存 Skill 草稿',exact:true}).click();
 await expect(skill).toHaveCount(0);
 const after=await state(page),created=after.skills.find((item:any)=>item.name==='业务转型阶段组织方法');
 expect(after.skills).toHaveLength(skillsBefore+1);
 expect(created).toMatchObject({personal:true,public:false,enabled:false,workspaceId:'personal'});
 expect(after.submissions.some((item:any)=>item.skill?.id===created.id)).toBe(false);
 await page.getByLabel('修改当前作品',{exact:true}).fill('字号改为 60');
 await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect(page.locator('.conversation-turn.applied').last()).toBeInViewport();
 expect(errors).toEqual([]);
});

test('经验只通过Agent整理并在关联素材已有资料入口查阅，不增设项目或模板资料入口',async({page})=>{
 await setup(page);await openAgent(page);
 const assetCount=(await state(page)).assets.length;
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 await page.getByRole('dialog',{name:'选择经验整理范围',exact:true}).getByRole('button',{name:'开始整理',exact:true}).click();
 await expect(page.getByRole('region',{name:'制作经验摘要',exact:true})).toBeVisible();
 expect((await state(page)).assets).toHaveLength(assetCount);
 await page.goto('/#/projects');
 await expect(page.getByRole('button',{name:'创作资料',exact:true})).toHaveCount(0);
 await page.goto('/#/community?template=template-1-1');
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('tab',{name:'创作资料',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'关闭对话框',exact:true}).click();
 await page.goto(`/#/library?asset=${assetId}`);
 const asset=page.getByRole('dialog',{name:'关联成果素材',exact:true});
 await expect(asset).toBeVisible();
 await asset.getByRole('tab',{name:/创作资料/}).click();
 await expect(asset).toContainText('当前客户展项');
 await expect(asset).toContainText('未验证');
 await expect(asset.getByRole('button',{name:'整理制作经验',exact:true})).toHaveCount(0);
 await page.screenshot({path:`${output}/04-素材卡片创作资料.png`,fullPage:true});
});


test('经验整理统一选择范围，页面与组件结果明确标记并保留历史',async({page})=>{
 await setup(page);await openAgent(page);
 const work=await current(page),selectedPage=work.pages[0],node=selectedPage.nodes[0];
 await page.getByLabel('修改范围',{exact:true}).selectOption(`node:${selectedPage.id}:${node.id}`);
 await expect(page.getByRole('button',{name:'整理当前范围',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'选择经验整理范围',exact:true});
 await expect(dialog.getByRole('radio')).toHaveCount(3);
 await dialog.getByRole('radio',{name:`当前页面 · ${selectedPage.name}`,exact:true}).check();
 await dialog.getByRole('button',{name:'取消',exact:true}).click();
 expect((await current(page)).experience).toBeUndefined();
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 await dialog.getByRole('radio',{name:`选中组件 · ${node.name}`,exact:true}).check();
 await dialog.getByRole('button',{name:'开始整理',exact:true}).click();
 const summary=page.getByRole('region',{name:'制作经验摘要',exact:true});
 await expect(summary).toContainText(`整理范围：组件 · ${node.name}`);
 expect((await current(page)).experience.target).toEqual({scope:'node',pageId:selectedPage.id,nodeId:node.id});
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 await dialog.getByRole('radio',{name:`当前页面 · ${selectedPage.name}`,exact:true}).check();
 await dialog.getByRole('button',{name:'开始整理',exact:true}).click();
 await expect(summary).toContainText(`整理范围：页面 · ${selectedPage.name}`);
 await summary.getByText('整理历史 · 1 个版本',{exact:true}).click();
 await expect(summary.locator('.experience-history')).toContainText(`组件 · ${node.name}`);
 const after=await current(page);
 expect(after.pages).toEqual(work.pages);
 expect(after.experience.history[0].target.nodeId).toBe(node.id);
});
