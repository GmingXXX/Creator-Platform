import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const evidence='output/真实演示验收/互动影片.json';
test('回放真实生成的三个结局和HTML交互，不再次调用模型',async({page})=>{
 test.skip(!existsSync(evidence),'需要先完成显式真实生成验收');
 const {work:original}=JSON.parse(await readFile(evidence,'utf8'));
 const work={...original,title:'泰山寻碑 · 实测作品回放'},files=work.creationPackage.files;
 await page.route('**/qa-story-media/**',async route=>{const name=decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!);await route.fulfill({path:path.resolve('output/智创真实演示资料_20261116/03_互动影片/素材',name)});});
 let modelCalls=0;await page.route('**/api/ai/chat',route=>{modelCalls++;return route.abort();});
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 work.storyNodes=work.storyNodes.map((node:any)=>{const file=files.find((f:any)=>f.src===node.media);return {...node,media:file?`/qa-story-media/${encodeURIComponent(file.name)}`:node.media};});
 await page.evaluate(({work,files})=>{const key='zhichuang-studio-v1',saved=JSON.parse(localStorage.getItem(key)!);saved.state.works=[work,...saved.state.works];const sample=saved.state.assets[0];for(const file of files.filter((f:any)=>['image','video','html'].includes(f.type))){saved.state.assets.push({...sample,id:file.src.slice(4),name:file.name,kind:file.type,src:`/qa-story-media/${encodeURIComponent(file.name)}`,workspaceId:'personal',source:'upload'});}localStorage.setItem(key,JSON.stringify(saved));},{work,files});
 await page.reload();await page.goto(`/#/preview/${work.id}`);await expect(page.locator('.story-experience')).toBeVisible();
 await expect.poll(()=>page.locator('.story-preview-scene video').evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);
 const start=work.storyNodes.find((n:any)=>n.type==='start'),endings=work.storyNodes.filter((n:any)=>n.type==='end');
 function routeTo(target:string,current=start.id,seen:string[]=[]):any[]|null{if(current===target)return [];for(const edge of work.storyEdges.filter((e:any)=>e.source===current&&!seen.includes(e.target))){const rest=routeTo(target,edge.target,[...seen,current]);if(rest)return [edge,...rest];}return null;}
 for(let i=0;i<endings.length;i++){
  if(i)await page.getByRole('button',{name:'体验另一种结局',exact:true}).click();
  for(const edge of routeTo(endings[i].id)!){
   const node=work.storyNodes.find((n:any)=>n.id===edge.source);
   if(node.media?.endsWith('.html')){const frame=page.frameLocator(`iframe[title="${node.title}"]`);await frame.getByRole('button',{name:'留印 · 向山而行',exact:true}).click();await expect(frame.locator('#quote')).toHaveText('向山而行，亦向心而行。');}
   await page.locator('.story-experience').getByRole('button',{name:edge.label||'继续',exact:true}).click();
  }
  await expect(page.locator('.story-preview-body h2')).toHaveText(endings[i].title);
 }
 expect(modelCalls).toBe(0);await page.screenshot({path:'output/真实演示验收/互动影片_第三结局与HTML验收.png'});
});
