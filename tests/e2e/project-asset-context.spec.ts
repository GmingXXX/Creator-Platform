import {expect,test,type Page} from '@playwright/test';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE0cAAAAASUVORK5CYII=','base64');
const data=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state);
async function openPicker(page:Page){
 await page.route('**/api/ai/**',route=>route.fulfill({json:{models:[],configured:{}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台',exact:true}).click();
 await expect(page.getByLabel('创作需求',{exact:true})).toBeVisible();
 await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),base=saved.state.works.find((work:any)=>work.id==='work-1');
  const work={...base,id:'project-context-work',workspaceId:'xintai',title:'项目素材边界验收',aiModel:'demo',creationPackage:undefined,pages:base.pages.map((page:any)=>({...page,backgroundAssetId:undefined,backgroundImage:undefined,nodes:[]}))};
  const make=(id:string,workspaceId:string,name:string)=>({id,workspaceId,name,kind:'image',src:'/media/industrial.svg',preview:'/media/industrial.svg',description:name,tags:[],author:'验收',source:'uploaded',public:false,createdAt:new Date().toISOString()});
  saved.state.works=[work,...saved.state.works];saved.state.assets=[make('explicit-personal-image','personal','个人参考原图'),make('other-project-image','dongguan','其他项目图片'),...saved.state.assets];
  saved.state.activeWorkspaceId='xintai';localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
 });
 await page.reload();await page.goto('/#/editor/project-context-work');await expect(page.locator('.scene-board')).toBeVisible();
 await page.getByRole('button',{name:'打开 Agent 助手',exact:true}).click();await page.getByRole('button',{name:'从素材库替换背景',exact:true}).click();
 return page.getByRole('dialog',{name:'选择页面背景',exact:true});
}
test('project picker requires explicit personal import and retains independent project asset',async({page})=>{
 const dialog=await openPicker(page);
 await expect(dialog.getByRole('tab',{name:'空间素材',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(dialog.getByRole('button',{name:'选择个人参考原图',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'选择其他项目图片',exact:true})).toHaveCount(0);
 await dialog.getByRole('tab',{name:'从个人空间带入',exact:true}).click();
 await dialog.getByRole('button',{name:'选择个人参考原图',exact:true}).click();
 await dialog.getByRole('button',{name:'带入空间并使用',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect.poll(async()=>(await data(page)).works.find((work:any)=>work.id==='project-context-work').pages[0].backgroundAssetId).toBeTruthy();
 const saved=await data(page),work=saved.works.find((work:any)=>work.id==='project-context-work');
 const asset=saved.assets.find((asset:any)=>asset.id===work.pages[0].backgroundAssetId);
 expect(asset.workspaceId).toBe('xintai');expect(asset.origin.assetId).toBe('explicit-personal-image');
 expect(saved.assets.find((asset:any)=>asset.id==='explicit-personal-image').workspaceId).toBe('personal');
});
test('uploading inside project picker records the project as the original owner',async({page})=>{
 const dialog=await openPicker(page);
 await dialog.getByLabel('上传可用素材',{exact:true}).setInputFiles({name:'当前项目上传.png',mimeType:'image/png',buffer:pixel});
 await expect(dialog.getByRole('button',{name:'选择当前项目上传.png',exact:true})).toBeVisible();
 const uploaded=(await data(page)).assets.filter((asset:any)=>asset.name==='当前项目上传.png');
 expect(uploaded).toHaveLength(1);expect(uploaded[0].workspaceId).toBe('xintai');
 await dialog.getByRole('button',{name:'使用此素材',exact:true}).click();await expect(dialog).toHaveCount(0);
});
