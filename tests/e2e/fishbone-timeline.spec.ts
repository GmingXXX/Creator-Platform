import {test,expect} from '@playwright/test';
import JSZip from 'jszip';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

test('鱼骨时间轴可横向拖动、键盘浏览与查看原文，导出保留交互',async({page,browser})=>{
 await page.goto('/#/login');await page.getByRole('button',{name:'填入',exact:true}).click();await page.getByRole('button',{name:'进入工作台'}).click();await expect(page).toHaveURL(/#\/$/);
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('zhichuang-studio-v1')!);const work=data.state.works.find((w:{id:string})=>w.id==='work-1');work.width=1920;work.height=1080;work.pages[0].nodes=[{id:'fishbone',name:'企业大事件',type:'timeline',timelineLayout:'fishbone',x:70,y:150,w:1780,h:760,rotation:0,opacity:1,hidden:false,locked:false,content:'星澜智造发展历程',color:'#c9e9ff',background:'transparent',fontSize:28,radius:8,items:Array.from({length:10},(_,i)=>({id:`event-${i}`,year:String(2012+i),title:`企业事件 ${i+1}`,description:`模拟企业第 ${i+1} 个事件的完整原文。保留可追溯资料内容。`,image:i%2?undefined:'/media/industrial.svg'}))}];localStorage.setItem('zhichuang-studio-v1',JSON.stringify(data));});
 await page.reload();await page.goto('/#/editor/work-1');await page.getByRole('button',{name:'运行预览',exact:true}).click();
 const runtime=page.locator('.runtime-overlay'),scroll=runtime.getByRole('region',{name:'企业鱼骨时间轴'});
 await expect(runtime.locator('.fishbone-event')).toHaveCount(10);await expect(runtime.locator('.fishbone-event.is-upper')).toHaveCount(5);await expect(runtime.locator('.fishbone-event.is-lower')).toHaveCount(5);
 const upper=await runtime.locator('.fishbone-event.is-upper .fishbone-card').first().boundingBox(),lower=await runtime.locator('.fishbone-event.is-lower .fishbone-card').first().boundingBox();expect(upper!.y+upper!.height).toBeLessThan(lower!.y);
 await runtime.getByRole('button',{name:'2012 企业事件 1',exact:true}).click();await expect(runtime.getByRole('dialog')).toContainText('模拟企业第 1 个事件的完整原文。');await runtime.getByRole('button',{name:'返回浏览',exact:true}).click();
 const box=await scroll.boundingBox();await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.5);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.3,box!.y+box!.height*.5,{steps:12});await page.mouse.up();await expect.poll(()=>scroll.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);await expect(runtime.getByRole('dialog')).toHaveCount(0);
 await scroll.focus();const offset=await scroll.evaluate(el=>el.scrollLeft);await page.keyboard.press('ArrowRight');await expect.poll(()=>scroll.evaluate(el=>el.scrollLeft)).toBeGreaterThan(offset+50);
 await mkdir('output/验收截图',{recursive:true});await page.screenshot({path:'output/验收截图/fishbone-timeline-preview.png',animations:'disabled'});
 await runtime.getByRole('button',{name:/返回编辑/}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出管理平台运行包',exact:true}).click();
 const zip=await JSZip.loadAsync(await readFile((await (await download).path())!));const dir=await mkdtemp(join(tmpdir(),'fishbone-offline-'));
 for(const entry of Object.values(zip.files)){const destination=resolve(dir,entry.name);expect(destination.startsWith(dir+sep)).toBe(true);if(entry.dir)await mkdir(destination,{recursive:true});else{await mkdir(dirname(destination),{recursive:true});await writeFile(destination,await entry.async('nodebuffer'));}}
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:900}}),offline=await context.newPage();await offline.goto(pathToFileURL(join(dir,'index.html')).href);await expect(offline.locator('.fishbone-event')).toHaveCount(10);await offline.getByRole('button',{name:'2012 企业事件 1',exact:true}).click();await expect(offline.locator('#detail')).toBeVisible();await expect(offline.locator('#detail-body')).toContainText('模拟企业第 1 个事件的完整原文。');await offline.getByRole('button',{name:'关闭详情',exact:true}).click();await offline.getByRole('button',{name:'向后浏览时间轴',exact:true}).click();await expect.poll(()=>offline.locator('.fishbone-viewport').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);await context.close();
});
