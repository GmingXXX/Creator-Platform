import {reloadAndReopen} from './reload-helpers';
import {test,expect,type Page} from '@playwright/test';

const readState=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
test.beforeEach(async({page})=>{
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
});

test('素材库只展示素材类型，工程移出且真实视频和嵌入组件仍可用',async({page})=>{
 await page.goto('/#/library');
 await expect(page.getByRole('tab')).toHaveText(['全部素材','图片','视频','音频','组件','文档资料']);
 await expect(page.getByRole('heading',{name:'企业创新成果讲解',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'面向未来 · 品牌短片',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'视频',exact:true}).click();
 await expect(page.getByRole('button',{name:'预览未来工厂光影 · 我的版本',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'组件',exact:true}).click();
 await expect(page.getByRole('button',{name:'预览数字星空浏览',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预览数字星空浏览',exact:true}).click();
 await expect(page.locator('.asset-capability-note')).toContainText('内部元素不会自动拆分');
 await expect(page.locator('iframe')).toHaveAttribute('sandbox','allow-scripts');
});

test('独立讲解预览保持页面切换与正确编辑入口',async({page})=>{
 await page.goto('/#/preview/work-4');
 await expect(page.getByTestId('presentation-material-preview')).toBeVisible();
 const initial=await readState(page),work=initial.works.find((item:{id:string})=>item.id==='work-4');
 await page.locator('.res-page-strip button').nth(1).click();
 await expect(page.locator('.res-page-strip button').nth(1)).toHaveClass(/active/);
 await page.getByRole('button',{name:'编辑讲解演示',exact:true}).click();
 await expect(page).toHaveURL(/#\/presentations\/work-4$/);
 expect((await readState(page)).works.filter((item:{id:string})=>item.id===work.id)).toHaveLength(1);
});

test('旧素材工程链接定位原空间和原项目，不复制工程',async({page})=>{
 await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  const work=saved.state.works.find((item:{id:string})=>item.id==='work-5');
  work.workspaceId='xintai';
  saved.state.assets.push({id:'legacy-video-link',sourceWorkId:work.id,name:work.title,kind:'video',src:'',preview:'/media/finance.svg',description:'旧工程入口',tags:[],author:'纪鸣',createdAt:work.createdAt,source:'generated',public:false,workspaceId:'xintai'});
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
 });
 await page.goto('/#/library?asset=legacy-video-link');
 await reloadAndReopen(page);
 await expect(page).toHaveURL(/#\/video\/work-5$/);
 const after=await readState(page);
 expect(after.activeWorkspaceId).toBe('xintai');
 expect(after.works.filter((work:{id:string})=>work.id==='work-5')).toHaveLength(1);
 await page.getByRole('button',{name:'查看作品',exact:true}).click();
 await expect(page).toHaveURL(/#\/projects/);
 await expect(page.getByRole('button',{name:'切换创作空间'})).toContainText('信泰企业展厅');
});

test('画布投稿确认的分类不随画布撤销和重做回退',async({page})=>{
 await page.goto('/#/editor/work-1');await page.locator('.node-hitbox').nth(1).click();
 const x=page.getByRole('spinbutton',{name:'X',exact:true}),oldX=await x.inputValue();
 await x.fill(String(Number(oldX)+32));await x.blur();
 await page.getByRole('button',{name:'分享投稿',exact:true}).click();
 await page.getByRole('group',{name:'展示内容',exact:true}).getByRole('button',{name:'产业链与合作生态',exact:true}).click();
 await page.getByLabel('展示形式',{exact:true}).selectOption('流程架构型');
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'提交审核',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByTitle('撤销（⌘Z）').click();await expect(x).toHaveValue(oldX);
 await page.getByRole('button',{name:'保存',exact:true}).click();
 const undone=(await readState(page)).works.find((work:{id:string})=>work.id==='work-1');
 expect(undone.contentPurposes).toContain('ecosystem');expect(undone.type).toBe('流程架构型');expect(undone.displayForm).toBe('流程架构型');
 await page.getByTitle('重做（⌘⇧Z）').click();await page.getByRole('button',{name:'保存',exact:true}).click();
 const redone=(await readState(page)).works.find((work:{id:string})=>work.id==='work-1');
 expect(redone.contentPurposes).toContain('ecosystem');expect(redone.type).toBe('流程架构型');expect(redone.displayForm).toBe('流程架构型');
});

test('旧公开工程别名跳转已经存在的同源模板',async({page})=>{
 await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),template=saved.state.templates.find((t:{work:{kind:string}})=>t.work.kind==='presentation');
  saved.state.assets.push({id:'old-public-alias',name:template.title,kind:'presentation',src:'',preview:'/media/finance.svg',description:'旧公开入口',tags:[],author:'纪鸣',createdAt:template.work.createdAt,source:'generated',public:true,workSnapshot:structuredClone(template.work)});
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
 });
 await page.goto('/#/library?asset=old-public-alias');await reloadAndReopen(page);
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByTestId('presentation-material-preview')).toBeVisible();
 expect(page.url()).not.toContain('template=old-public-alias');
});

test('任务页切换空间后重新创作仍使用原任务空间',async({page})=>{
 await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  saved.state.runs.push({id:'space-restart',workspaceId:'personal',prompt:'原空间的企业历史',model:'GPT',styleId:'',skillIds:[],attachmentIds:['personal-asset-1'],status:'complete',step:5,outputKind:'exhibit',workId:'work-1',createdAt:new Date().toISOString()});
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
 });
 await page.goto('/#/create/space-restart');await reloadAndReopen(page);
 await page.getByRole('button',{name:'切换创作空间'}).click();await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();
 await page.goto('/#/create/space-restart');
 await page.getByRole('button',{name:'任务更多操作'}).click();await page.getByRole('menuitem',{name:'用此需求重新创作'}).click();
 await expect(page).toHaveURL(/#\/$/);
 const state=await readState(page),draft=state.drafts.find((item:{id:string})=>item.id===state.activeDraftId);
 expect(state.activeWorkspaceId).toBe('personal');expect(draft.workspaceId).toBe('personal');expect(draft.attachmentIds).toContain('personal-asset-1');
});
