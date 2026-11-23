import {test,expect,type Page,type Route} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const output='output/空间归属与Skills_20261117';
const workId='v17-personal-work',sourceId='v17-reference',assetId='v17-personal-asset';
const read=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
async function selectSpace(page:Page,name:string){
 await page.getByRole('button',{name:'切换创作空间',exact:true}).click();
 await page.getByRole('menuitem',{name,exact:true}).click();
}
async function setup(page:Page,chat?:(route:Route)=>Promise<unknown>){
 await page.route('**/api/ai/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/config'))return json(route,{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:false}});
  if(path.endsWith('/chat')&&chat)return chat(route);
  return json(route,{error:'验收阻止真实模型和媒体请求'},503);
 });
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
 await page.evaluate(({workId,sourceId,assetId})=>{
  const stored=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  const base=stored.state.works.find((item:any)=>item.id==='work-1');
  const make=(id:string,title:string,workspaceId:string)=>({...structuredClone(base),id,projectId:id,title,workspaceId,aiModel:'demo',references:[],experience:undefined,creationPackage:undefined,deletedAt:undefined,
   pages:base.pages.map((page:any,index:number)=>({...page,id:`${id}-page-${index}`,backgroundAssetId:undefined,backgroundImage:undefined,nodes:page.nodes.map((node:any,n:number)=>({...node,id:`${id}-node-${n}`,assetId:undefined,src:undefined,content:node.type==='text'?`${title}专属事实${n}`:node.content,items:node.items?.map((item:any)=>({...item,assetId:undefined,image:undefined}))}))}))});
  const work=make(workId,'待归属项目展项','personal');
  work.pages[0].backgroundAssetId=assetId;work.pages[0].backgroundImage='/media/industrial.svg';
  const asset={id:assetId,name:'随迁个人背景',workspaceId:'personal',kind:'image',src:'/media/industrial.svg',preview:'/media/industrial.svg',description:'作品真实依赖的背景',tags:[],author:'纪鸣',createdAt:new Date().toISOString(),source:'uploaded',public:false};
  stored.state.works=[work,make(sourceId,'多选参考展项','xintai'),...stored.state.works];
  stored.state.assets=[asset,...stored.state.assets];
  stored.state.runs=[{id:'v17-related-run',workId,workspaceId:'personal',prompt:'需要保留的个人制作任务',model:'demo',styleId:'',skillIds:[],attachmentIds:[assetId],status:'complete',step:6,outputKind:'exhibit',createdAt:new Date().toISOString()},...stored.state.runs];
  stored.state.conversationTurns=[{id:'v17-related-turn',workId,prompt:'随作品迁移的调整要求',target:{scope:'work'},status:'applied',summary:'保留页面布局',createdAt:new Date().toISOString(),before:structuredClone(work),afterRevision:work.revision,attachmentIds:[assetId]},...stored.state.conversationTurns];
  stored.state.activeWorkspaceId='personal';
  stored.state.activeDraftId=stored.state.drafts.find((draft:any)=>draft.workspaceId==='personal').id;
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(stored));
 },{workId,sourceId,assetId});
 await page.reload();await mkdir(output,{recursive:true});
}
async function addAllReferences(page:Page){
 await page.getByRole('button',{name:'创作参考',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'添加参考展项',exact:true});
 await picker.locator(`[data-reference-source="work:${sourceId}"] .reference-source-select`).click();
 await picker.getByRole('checkbox',{name:'全部参考维度',exact:true}).check();
 return picker;
}

test('首页刷新保留当前项目及独立草稿、附件和创作参考',async({page})=>{
 await setup(page);
 await page.getByLabel('创作需求',{exact:true}).fill('个人空间尚未完成的想法');
 await selectSpace(page,'信泰企业展厅');
 await page.getByLabel('创作需求',{exact:true}).fill('信泰项目独立的创作草稿');
 await page.getByLabel('添加文件',{exact:true}).setInputFiles({name:'项目资料.txt',mimeType:'text/plain',buffer:Buffer.from('本项目已确认资料')});
 await expect(page.getByRole('button',{name:'移除 项目资料.txt',exact:true})).toBeVisible();
 const picker=await addAllReferences(page);
 await picker.getByRole('button',{name:'加入参考',exact:true}).click();
 const before=await read(page),draft=before.drafts.find((item:any)=>item.id===before.activeDraftId);
 await page.reload();
 await expect(page.getByLabel('创作需求',{exact:true})).toHaveValue('信泰项目独立的创作草稿');
 await expect(page.getByRole('button',{name:'移除 项目资料.txt',exact:true})).toBeVisible();
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(1);
 const after=await read(page);expect(after.activeWorkspaceId).toBe('xintai');
 expect(after.drafts.find((item:any)=>item.id===after.activeDraftId)).toMatchObject({id:draft.id,workspaceId:'xintai',attachmentIds:draft.attachmentIds,references:draft.references});
 await selectSpace(page,'个人空间');
 await expect(page.getByLabel('创作需求',{exact:true})).toHaveValue('个人空间尚未完成的想法');
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(0);
 await selectSpace(page,'信泰企业展厅');
 await page.screenshot({path:`output/空间归属与Skills_20261117/01-项目草稿恢复.png`,fullPage:true});
});

test('底部创作参考支持全部与半选，按来源合并展示并逐维度保存',async({page})=>{
 await setup(page);await selectSpace(page,'信泰企业展厅');
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(0);
 const button=page.getByRole('button',{name:'创作参考',exact:true});
 expect(await button.evaluate(node=>Boolean(node.closest('.composer-toolbar')))).toBe(true);
 const picker=await addAllReferences(page);
 for(const name of ['交互方式','UI 风格','内容组织','局部效果'])await expect(picker.getByRole('checkbox',{name,exact:true})).toBeChecked();
 await picker.getByRole('checkbox',{name:'内容组织',exact:true}).uncheck();
 await expect(picker.getByRole('checkbox',{name:'全部参考维度',exact:true})).toHaveJSProperty('indeterminate',true);
 await picker.getByLabel('参考范围',{exact:true}).selectOption(`page:${sourceId}-page-0`);
 await picker.getByRole('button',{name:'加入参考',exact:true}).click();
 await expect(page.getByTestId('exhibit-reference-summary')).toHaveCount(1);
 await expect(page.getByTestId('exhibit-reference-summary')).toContainText('交互方式、UI 风格、局部效果');
 const data=await read(page),refs=data.drafts.find((draft:any)=>draft.id===data.activeDraftId).references;
 expect(refs.map((ref:any)=>ref.dimension).sort()).toEqual(['effect','interaction','ui']);
 expect(refs.every((ref:any)=>ref.scope===`page:${sourceId}-page-0`&&ref.status==='reference')).toBe(true);
 expect(JSON.stringify(refs)).not.toContain('专属事实');
 await button.click();
 const manager=page.getByRole('dialog',{name:'创作参考',exact:true});
 await expect(manager.getByTestId('exhibit-reference-card')).toHaveCount(1);
 await manager.getByRole('button',{name:'编辑参考 多选参考展项 交互方式、UI 风格、局部效果',exact:true}).click();
 await page.getByRole('checkbox',{name:'全部参考维度',exact:true}).check();
 await page.getByRole('button',{name:'保存参考',exact:true}).click();
 await expect(page.getByTestId('exhibit-reference-summary')).toContainText('内容组织');
 await page.screenshot({path:`${output}/02-底部创作参考.png`,fullPage:true});
});

test('个人作品移动保留身份、任务和对话，复制素材依赖后在目标空间继续编辑',async({page})=>{
 const calls:any[]=[];
 await setup(page,async route=>{calls.push(route.request().postDataJSON());return json(route,{model:'deepseek-flash',content:JSON.stringify({summary:'已按目标项目调整名称',patches:[{kind:'work',changes:{title:'项目内继续制作的展项'}}]})});});
 const initial=await read(page),originalAsset=initial.assets.find((item:any)=>item.id===assetId);
 await page.goto('/#/projects');
 await page.getByRole('button',{name:'待归属项目展项更多操作',exact:true}).click();
 await page.getByRole('menuitem',{name:'移动到项目空间',exact:true}).click();
 const move=page.getByRole('dialog',{name:'移动到项目空间',exact:true});
 await move.getByLabel('目标项目空间',{exact:true}).selectOption('xintai');
 await expect(move.getByRole('region',{name:'随迁内容',exact:true})).toContainText('1 项关联任务、1 条修改记录');
 await expect(move).toContainText('需复制 1 项依赖素材');
 await page.screenshot({path:`${output}/03-移动依赖确认.png`,fullPage:true});
 await move.getByRole('button',{name:'确认移动',exact:true}).click();
 await expect(move).toHaveCount(0);
 const moved=await read(page),work=moved.works.find((item:any)=>item.id===workId),copiedId=work.pages[0].backgroundAssetId;
 expect(moved.activeWorkspaceId).toBe('xintai');expect(work.workspaceId).toBe('xintai');expect(copiedId).not.toBe(assetId);
 expect(moved.assets.find((item:any)=>item.id===assetId)).toEqual(originalAsset);
 expect(moved.assets.find((item:any)=>item.id===copiedId)).toMatchObject({workspaceId:'xintai',origin:{assetId}});
 expect(moved.runs.find((item:any)=>item.id==='v17-related-run')).toMatchObject({workId,workspaceId:'xintai',attachmentIds:[copiedId]});
 expect(moved.conversationTurns.find((item:any)=>item.id==='v17-related-turn')).toMatchObject({workId,attachmentIds:[copiedId],before:{workspaceId:'xintai'}});
 await selectSpace(page,'个人空间');
 await expect(page.getByRole('button',{name:'打开待归属项目展项',exact:true})).toHaveCount(0);
 await page.goto(`/#/editor/${workId}`);
 await expect(page.locator('.scene-board')).toBeVisible();
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
 await page.getByLabel('修改模型',{exact:true}).selectOption('deepseek-flash');
 await page.getByLabel('修改范围',{exact:true}).selectOption('work');
 await page.getByLabel('修改当前作品',{exact:true}).fill('按照当前项目上下文调整展项名称');
 await page.getByRole('button',{name:'发送修改',exact:true}).click();
 await expect.poll(async()=>(await read(page)).works.find((item:any)=>item.id===workId).title).toBe('项目内继续制作的展项');
 expect(calls).toHaveLength(1);expect(JSON.stringify(calls[0])).toContain('随作品迁移的调整要求');
 expect((await read(page)).activeWorkspaceId).toBe('xintai');
 await page.reload();await expect(page.locator('.scene-board')).toBeVisible();
 expect((await read(page)).activeWorkspaceId).toBe('xintai');
 await page.screenshot({path:`${output}/04-移动后继续编辑.png`,fullPage:true});
});

test('Agent经验提炼完整Skill元信息，私有未启用草稿跨项目统一管理并可修订',async({page})=>{
 await setup(page);await page.goto(`/#/editor/${workId}`);
 await expect(page.locator('.scene-board')).toBeVisible();
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();
 await page.getByLabel('修改模型',{exact:true}).selectOption('demo');
 await page.getByRole('button',{name:'整理制作经验',exact:true}).click();
 await page.getByRole('dialog',{name:'选择经验整理范围',exact:true}).getByRole('button',{name:'开始整理',exact:true}).click();
 await expect(page.getByRole('region',{name:'制作经验摘要',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'提炼为 Skill',exact:true}).click();
 const form=page.getByRole('dialog',{name:'提炼为 Skill',exact:true});
 await form.getByLabel('方法名称',{exact:true}).fill('跨项目复用的组织方法');
 await form.getByLabel('方法说明',{exact:true}).fill('根据确认事实组织阶段，不包含客户专属内容。');
 await form.getByLabel('所需资料',{exact:true}).fill('确认过的事实条目');
 await form.getByLabel('制作步骤',{exact:true}).fill('核对事实来源\n按主题组织阶段\n检查阅读路径');
 await expect(form.getByLabel('唯一标识',{exact:true})).toHaveAttribute('readonly','');
 await form.getByLabel('适用场景',{exact:true}).fill('企业历程与馆藏演进展项');
 await form.getByLabel('预期输出',{exact:true}).fill('可检查的阶段结构与来源列表');
 await form.getByText('依赖与权限',{exact:true}).click();
 await form.getByLabel('访问的数据或资源',{exact:true}).fill('当前项目明确选择的事实条目');
 await form.getByLabel('读写操作',{exact:true}).selectOption('read');
 await form.getByLabel('用户授权要求',{exact:true}).selectOption('required');
 await page.screenshot({path:`${output}/05-经验提炼元信息.png`,fullPage:true});
 await form.getByRole('button',{name:'保存 Skill 草稿',exact:true}).click();
 await expect(form).toHaveCount(0);
 const created=(await read(page)).skills.find((item:any)=>item.name==='跨项目复用的组织方法');
 expect(created).toMatchObject({workspaceId:'personal',public:false,enabled:false,metadata:{visibility:'private',scenarios:'企业历程与馆藏演进展项',permissions:{operations:'read',authorization:'required'},provenance:{workId}}});
 await page.goto('/#/skills');await selectSpace(page,'信泰企业展厅');
 await page.goto(`/#/skills?skill=${created.id}`);
 const details=page.getByRole('dialog',{name:'跨项目复用的组织方法',exact:true});
 await expect(details).toBeVisible();
 await expect(page.getByRole('tab',{name:'我的技能',exact:true})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'空间共享',exact:true})).toHaveCount(0);
 await details.getByRole('button',{name:'编辑技能信息',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'编辑技能信息',exact:true});
 await editor.getByLabel('预期输出',{exact:true}).fill('阶段结构、事实来源与审核清单');
 await editor.getByRole('button',{name:'保存修改',exact:true}).click();
 await page.reload();
 const data=await read(page);expect(data.skills.filter((item:any)=>item.id===created.id)).toHaveLength(1);
 expect(data.skills.find((item:any)=>item.id===created.id).metadata.output).toBe('阶段结构、事实来源与审核清单');
 expect(data.activeWorkspaceId).toBe('xintai');
 await expect(page.getByRole('dialog',{name:'跨项目复用的组织方法',exact:true})).toContainText('阶段结构、事实来源与审核清单');
 await page.screenshot({path:`${output}/06-统一技能详情.png`,fullPage:true});
});
