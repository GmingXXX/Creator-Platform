import {test,expect,type Page} from '@playwright/test';
async function prepare(page:Page){
 await page.route('**/api/ai/config',route=>route.fulfill({json:{models:[{id:'deepseek-flash',label:'DeepSeek Flash'}],configured:{deepseek:true,image:true}}}));
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);
  const asset={id:'ready-picture',name:'已备配图.png',kind:'image',src:'/media/industrial.svg',preview:'/media/industrial.svg',description:'现成配图',tags:[],author:'',createdAt:new Date().toISOString(),source:'upload',workspaceId:'personal'};
  data.state.assets.unshift(asset);data.state.runs.unshift({id:'audio-recovery',workspaceId:'personal',prompt:'制作企业演示',model:'deepseek-flash',styleId:'technology',skillIds:[],attachmentIds:[],status:'waiting',step:2,outputKind:'presentation',studioReview:true,createdAt:new Date().toISOString()});
  localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));
  localStorage.setItem('zc-creation-plan:personal:audio-recovery',JSON.stringify({kind:'presentation',title:'配音恢复验收',step:1,topic:'制作企业演示',model:'deepseek-flash',generateMissing:true,sections:[{title:'第一页',narration:'第一句。第二句。第三句。',bullets:['一页内容'],layout:'split',imageAssetId:asset.id},{title:'第二页',narration:'第四句。第五句。第六句。',bullets:['二页内容'],layout:'split',imageAssetId:asset.id}]}));
 });
 await page.reload();await page.goto('/#/create/audio-recovery');await expect(page.getByLabel('第1页标题')).toBeVisible();
}
async function saved(page:Page){return page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;return state.works.find((work:any)=>work.id===state.runs.find((run:any)=>run.id==='audio-recovery').workId);});}
function silence(){const samples=8000,buffer=Buffer.alloc(44+samples*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);return buffer;}
test('zero pending images skips image service and narration preparation is bounded with an explicit pending notice',async({page})=>{
 let images=0,speech=0;await page.route('**/api/ai/images',route=>{images++;return route.fulfill({status:500});});await page.route('**/api/ai/speech',route=>{speech++;return route.fulfill({json:{url:'/api/ai/audio/ready.wav'}});});
 await prepare(page);const checkbox=page.locator('.generation-delivery-status input');await expect(checkbox).toBeDisabled();await expect(checkbox).not.toBeChecked();await page.getByRole('button',{name:'开始生成',exact:true}).click();
 await expect(page.locator('.artifact-result-info h2')).toHaveText('配音恢复验收');await expect(page.locator('.toast-host')).toContainText('剩余 2 句将在演示时按需生成');expect(images).toBe(0);expect(speech).toBe(4);
 const result=await saved(page),config=JSON.parse(result.creationPackage.params.presentationStudio);expect(result.pages).toHaveLength(2);expect(Object.values(config.pages).flatMap((p:any)=>p.sentences).filter((s:any)=>s.audioUrl)).toHaveLength(4);
});
test('rate limited narration keeps complete work and successes; playback retries missing audio and reuses its cache',async({page})=>{
 let speech=0;await page.addInitScript(()=>{HTMLMediaElement.prototype.play=async()=>{};});
 await page.route('**/api/ai/audio/*.wav',route=>route.fulfill({contentType:'audio/wav',body:silence()}));
 await page.route('**/api/ai/speech',route=>{speech++;return speech===2||speech===3?route.fulfill({status:429,json:{error:'操作过于频繁，请稍后重试'}}):route.fulfill({json:{url:'/api/ai/audio/ready.wav'}});});
 await prepare(page);await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('配音恢复验收');await expect(page.locator('.toast-host')).toContainText('5 句讲解音频暂未生成');
 const result=await saved(page);expect(result.pages).toHaveLength(2);expect(JSON.parse(result.creationPackage.params.presentationStudio).pages[result.pages[0].id].sentences[0].audioUrl).toBe('/api/ai/audio/ready.wav');expect(speech).toBe(2);
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();await page.getByRole('button',{name:'预览',exact:true}).click();const player=page.getByRole('dialog',{name:'演示播放'});
 await player.getByRole('button',{name:'开始讲解',exact:true}).click();await expect(player.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible();expect(speech).toBe(2);
 await player.getByRole('button',{name:'下一页',exact:true}).click();await player.getByRole('button',{name:'开始讲解',exact:true}).click();await expect(player.getByRole('alert')).toContainText('操作过于频繁');expect(speech).toBe(3);
 await player.getByRole('button',{name:'重试',exact:true}).click();await expect(player.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible();expect(speech).toBe(4);
 await player.getByRole('button',{name:'上一页',exact:true}).click();await player.getByRole('button',{name:'下一页',exact:true}).click();await player.getByRole('button',{name:'开始讲解',exact:true}).click();await expect(player.getByRole('button',{name:'暂停讲解',exact:true})).toBeVisible();expect(speech).toBe(4);
});
for(const editPlan of [false,true])test(`refresh during narration ${editPlan?'invalidates edited plan recovery without deleting its saved work':'resumes the same saved work and audio'}`,async({page})=>{
 let resumed=false;const spoken:string[]=[];
 await page.route('**/api/ai/speech',async route=>{
  spoken.push(route.request().postDataJSON().text);
  if(!resumed&&spoken.length===2)return; // Deliberately leave the in-flight request unresolved until reload.
  return route.fulfill({json:{url:'/api/ai/audio/ready.wav'}});
 });
 await prepare(page);await page.getByRole('button',{name:'开始生成',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>{
  const checkpoint=JSON.parse(localStorage.getItem('zc-creation-plan:personal:audio-recovery')||'null');
  const state=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state;
  const work=state.works.find((w:any)=>w.id===checkpoint?.draftWorkId);
  if(!work)return false;
  const studio=JSON.parse(work.creationPackage.params.presentationStudio||'{}');
  return Boolean(studio.pages?.[work.pages[0].id]?.sentences[0]?.audioUrl);
 })).toBe(true);
 const originalId=await page.evaluate(()=>JSON.parse(localStorage.getItem('zc-creation-plan:personal:audio-recovery')!).draftWorkId);
 resumed=true;await page.reload();await page.goto('/#/create/audio-recovery');await expect(page.getByLabel('第1页标题')).toBeVisible();
 if(editPlan){
  await page.getByLabel('第1页标题').fill('重新确认后的标题');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zc-creation-plan:personal:audio-recovery')!).draftWorkId)).toBeUndefined();
 }
 await page.getByRole('button',{name:'开始生成',exact:true}).click();await expect(page.locator('.artifact-result-info h2')).toHaveText('配音恢复验收');
 const result=await saved(page);
 const works=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.filter((w:any)=>w.title==='配音恢复验收'));
 expect(works).toHaveLength(editPlan?2:1);expect(works.some((w:any)=>w.id===originalId)).toBe(true);
 if(editPlan){expect(result.id).not.toBe(originalId);expect(result.pages[0].name).toBe('重新确认后的标题');}
 else{expect(result.id).toBe(originalId);expect(spoken.filter(text=>text==='第一句。')).toHaveLength(1);}
});
