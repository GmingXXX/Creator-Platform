import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page){
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page.getByRole('heading',{name:'您想创建什么？'})).toBeVisible();
 await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!),state=saved.state;
  const skill={id:'shortcut-skill',name:'快捷验收技能',description:'快捷测试制作方法',input:'资料',steps:['整理内容'],category:'制作',styleId:'',previewType:'text',author:'纪鸣',version:'1.0',personal:true,enabled:true,metadata:{ownerAccount:'jiming',visibility:'private'}};
  const asset={id:'shortcut-asset',name:'快捷参考资料.txt',kind:'document',src:'/media/industrial.svg',preview:'',description:'测试参考内容',tags:[],author:'纪鸣',createdAt:new Date().toISOString(),source:'uploaded',workspaceId:'personal'};
  state.skills=[skill,{...skill,id:'shortcut-disabled',name:'快捷停用技能',enabled:false},{...skill,id:'shortcut-foreign',name:'快捷私有技能',metadata:{ownerAccount:'other',visibility:'private'}},...state.skills];
  state.assets=[asset,{...asset,id:'shortcut-foreign-asset',name:'快捷其他空间.txt',workspaceId:'other'},...state.assets];
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(saved));
 });await page.reload();
}
test('Slash chooses a skill without sending; chips remove; Escape and IME remain safe',async({page})=>{
 await setup(page);const input=page.getByRole('textbox',{name:'创作需求'});
 await input.fill('/快捷');const list=page.getByRole('listbox',{name:'选择 Skill'});await expect(list).toBeVisible();await expect(list).not.toContainText('快捷私有技能');await expect(list.getByRole('option',{name:/快捷停用技能/})).toHaveAttribute('aria-disabled','true');
 await input.press('ArrowDown');await input.press('Enter');await expect(page.locator('.skill-chip')).toContainText('快捷验收技能');await expect(input).toHaveValue('');await expect(page).toHaveURL(/#\/$/);
 await page.getByRole('button',{name:'移除技能 快捷验收技能'}).click();await expect(page.locator('.skill-chip')).toHaveCount(0);
 await input.fill('/没有这项技能');await input.press('Enter');await expect(list).toContainText('没有匹配');await expect(page).toHaveURL(/#\/$/);
 await input.press('Escape');await expect(list).toHaveCount(0);await expect(input).toHaveValue('/没有这项技能');
 await input.fill('/快捷');await input.dispatchEvent('keydown',{key:'Enter',isComposing:true});await expect(page.locator('.skill-chip')).toHaveCount(0);await expect(page).toHaveURL(/#\/$/);
});
test('At selects authorized material and opens visual work references separately',async({page})=>{
 await setup(page);const input=page.getByRole('textbox',{name:'创作需求'});await input.fill('请参考 @快捷');
 const list=page.getByRole('listbox',{name:'选择参考素材'});await expect(list).toBeVisible();await expect(list).not.toContainText('快捷其他空间.txt');await list.getByRole('option',{name:/快捷参考资料.txt/}).click();
 await expect(page.locator('.attachment-chip')).toContainText('快捷参考资料.txt');await expect(input).toHaveValue('请参考 ');await expect(page).toHaveURL(/#\/$/);
 await input.fill('@');await list.getByRole('option',{name:/浏览作品与模板/}).click();await expect(page.getByRole('dialog',{name:'添加参考展项'})).toBeVisible();await expect(page.locator('.reference-source-card').first()).toBeVisible();
});
test('Model is beside voice, toolbars fit narrow widths, voice input hides the prompt',async({page})=>{
 await page.addInitScript(()=>{class Recognition{onend?:()=>void;start(){}stop(){this.onend?.();}abort(){this.onend?.();}}Object.assign(window,{SpeechRecognition:Recognition});});
 await setup(page);await expect(page.locator('.composer-send-tools .model-control')).toBeVisible();
 const order=await page.locator('.composer-send-tools').evaluate(root=>{const model=root.querySelector('.model-control')!,voice=root.querySelector('.composer-microphone')!;return Boolean(model.compareDocumentPosition(voice)&Node.DOCUMENT_POSITION_FOLLOWING);});expect(order).toBe(true);
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:1440,height:960});await page.getByRole('textbox',{name:'创作需求'}).fill('/快捷');await expect(page.getByRole('listbox')).toHaveCSS('opacity','1');await page.screenshot({path:'/tmp/composer-shortcuts-light.png'});
 await page.getByRole('textbox',{name:'创作需求'}).press('Escape');await page.getByRole('button',{name:'语音输入',exact:true}).click();await expect(page.getByRole('region',{name:'语音录入'})).toBeVisible();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeHidden();await page.getByRole('button',{name:'取消录音'}).click();await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
 await page.locator('.appearance-toggle').click();await page.getByRole('textbox',{name:'创作需求'}).fill('/快捷验收');await expect(page.getByRole('listbox')).toHaveCSS('opacity','1');await expect(page.getByRole('listbox')).toHaveCSS('background-color','rgb(20, 20, 20)');await page.screenshot({path:'/tmp/composer-shortcuts-dark.png'});
});
