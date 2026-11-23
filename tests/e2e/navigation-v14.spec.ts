import {test,expect,type Page} from '@playwright/test';

async function login(page:Page){
 await page.goto('/#/login');
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.getByRole('textbox',{name:'创作需求',exact:true})).toBeVisible();
}
test.beforeEach(async({page})=>login(page));

test('统一新建入口直接打开创建弹窗并保留首页',async({page})=>{
 const sidebar=page.locator('.sidebar');
 await expect(sidebar.locator('nav a')).toHaveText(['首页','项目','素材库','Skills','共创社区']);
 await sidebar.getByRole('button',{name:'新建作品',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('heading',{name:'新建作品',exact:true})).toBeVisible();
 await page.screenshot({path:'output/验收截图/v14-new-project.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'交互页面',exact:true}).click();
 await expect(dialog.getByRole('button',{name:/从空白画布新建/})).toBeVisible();
 await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();
 await dialog.getByRole('button',{name:'智能演示',exact:true}).click();
 await expect(page).toHaveURL(/#\/$/);
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'新建作品',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'互动影片',exact:true}).click();
 await expect(page).toHaveURL(/#\/$/);
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'新建作品',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'交互页面',exact:true}).click();
 await dialog.getByRole('button',{name:/从模板新建/}).click();
 await expect(page).toHaveURL(/community\?tab=templates&category=interactive/);
});

test('新建交互页面使用同一弹窗且不要求填写展示内容',async({page})=>{
 await page.getByRole('button',{name:'新建作品',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'交互页面',exact:true}).click();
 await page.getByRole('button',{name:/从空白画布新建/}).click();
 await expect(page.getByRole('dialog')).toHaveCount(1);
 await page.getByLabel('作品名称',{exact:true}).fill('无预设用途的空白项目');
 await page.getByLabel('展示形式',{exact:true}).selectOption('卡片浏览型');
 await page.getByLabel('屏幕分辨率').selectOption('1080×1920');
 await page.getByRole('button',{name:'创建作品',exact:true}).click();
 await expect(page).toHaveURL(/editor\//);
 const work=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0]);
 expect(work).toMatchObject({title:'无预设用途的空白项目',kind:'exhibit',type:'卡片浏览型',width:1080,height:1920});
 expect(work.contentPurposes||[]).toEqual([]);
});

test('项目三大类与展示内容独立筛选，四种工程可继续编辑',async({page})=>{
 await page.getByRole('link',{name:'作品',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(6);
 const kinds=page.getByTestId('project-category-filter');
 await kinds.getByRole('button',{name:'智能演示',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(2);
 await expect(page.getByLabel('展示形式',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'打开企业创新成果讲解',exact:true}).click();
 await expect(page).toHaveURL(/presentations\/work-4/);
 await page.goto('/#/projects?category=presentation-video');
 await page.getByRole('button',{name:'打开面向未来 · 品牌短片',exact:true}).click();
 await expect(page).toHaveURL(/video\/work-5/);
 await page.goto('/#/projects');
 await kinds.getByRole('button',{name:'互动影片',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(1);
 await page.getByRole('button',{name:'打开未来工厂探索之旅',exact:true}).click();
 await expect(page).toHaveURL(/dream\/work-6/);
 await page.goto('/#/projects');
 await kinds.getByRole('button',{name:'交互页面',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(3);
 await expect(page.getByLabel('展示形式',{exact:true})).toBeVisible();
 await page.getByLabel('展示内容',{exact:true}).selectOption('history');
 await expect(page.locator('.res-project-card')).toHaveCount(1);
 await page.getByLabel('展示形式',{exact:true}).selectOption('关系图谱型');
 await expect(page.getByText('没有找到相关作品',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'清除筛选',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(6);
 await expect(page.getByLabel('展示内容',{exact:true}).getByRole('option',{name:'文博与知识科普',exact:true})).toHaveCount(1);
 await page.setViewportSize({width:1024,height:768});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'output/验收截图/v14-projects-1024.png',animations:'disabled'});
});

test('演示项目复制、删除与恢复保留工程，互动影片沿用项目操作',async({page})=>{
 await page.goto('/#/projects?category=presentation-video');
 const source=page.locator('.res-project-card').filter({has:page.getByRole('heading',{name:'企业创新成果讲解',exact:true})});
 await source.getByRole('button',{name:'企业创新成果讲解更多操作',exact:true}).click();
 await page.getByRole('menuitem',{name:'复制作品',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(3);
 const copy=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0]);
 expect(copy.kind).toBe('presentation');
 expect(copy.id).not.toBe('work-4');
 const copiedCard=page.locator('.res-project-card').filter({has:page.getByRole('heading',{name:copy.title,exact:true})});
 await copiedCard.getByRole('button',{name:`${copy.title}更多操作`,exact:true}).click();
 await page.getByRole('menuitem',{name:'删除作品',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'移入回收站',exact:true}).click();
 await expect(copiedCard).toHaveCount(0);
 await page.getByRole('button',{name:/回收站/}).click();
 await expect(copiedCard).toBeVisible();
 await copiedCard.getByRole('button',{name:'恢复作品',exact:true}).click();
 await page.getByRole('button',{name:/全部作品/}).click();
 await copiedCard.getByRole('button',{name:`打开${copy.title}`,exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`presentations/${copy.id}`));
 await page.goto('/#/projects?category=interactive-film');
 await page.getByRole('button',{name:'未来工厂探索之旅更多操作',exact:true}).click();
 await page.getByRole('menuitem',{name:'复制作品',exact:true}).click();
 await expect(page.locator('.res-project-card')).toHaveCount(2);
 const film=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works[0]);
 expect(film.kind).toBe('story');
 expect(film.storyNodes.length).toBeGreaterThan(0);
 await page.getByRole('button',{name:`打开${film.title}`,exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`dream/${film.id}`));
});
