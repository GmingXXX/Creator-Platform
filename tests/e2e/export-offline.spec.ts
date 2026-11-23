import { test, expect, type Page, type Download } from '@playwright/test';
import JSZip from 'jszip';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Users/ming/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = resolve('output/playwright/export-offline');
test.use({baseURL, viewport:{width:1440,height:900}, launchOptions:{executablePath}, acceptDownloads:true, actionTimeout:15_000});
test.setTimeout(120_000);

async function exportDownload(page:Page):Promise<Download> {
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出管理平台运行包',exact:true}).click();
  return download;
}
async function zipOf(download:Download) {
  expect(await download.failure()).toBeNull();
  return JSZip.loadAsync(await readFile((await download.path())!));
}
async function extract(zip:JSZip) {
  const dir=await mkdtemp(join(tmpdir(),'zhichuang-offline-'));
  for(const entry of Object.values(zip.files)) {
    const destination=resolve(dir,entry.name);
    expect(destination.startsWith(dir+sep)).toBe(true);
    if(entry.dir) await mkdir(destination,{recursive:true});
    else {await mkdir(resolve(destination,'..'),{recursive:true});await writeFile(destination,await entry.async('nodebuffer'));}
  }
  return dir;
}

test('E11 real UI downloads current scene and runs extracted ZIP completely offline',async({page,browser},testInfo)=>{
  await mkdir(artifacts,{recursive:true});
  const uiErrors:string[]=[];
  page.on('pageerror',error=>uiErrors.push(error.message));
  await page.goto('/#/login');
  await page.getByPlaceholder('输入你的账号').fill('jiming');
  await page.getByPlaceholder('输入密码',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'进入工作台',exact:false}).click();
  await expect(page).toHaveURL(`${baseURL}/#/`);
  await page.goto('/#/editor/work-1');
  const title='离线验证 · 钢铁发展历程';
  await page.getByLabel('展项名称',{exact:true}).fill(title);
  await page.getByRole('button',{name:'图层',exact:false}).first().click();
  await page.locator('.layer-select').filter({hasText:'主标题'}).click();
  await page.getByLabel('文本内容').fill('OFFLINE-当前版本 · 走向新未来');
  await page.getByLabel('字体',{exact:true}).selectOption('serif');
  await page.getByLabel('字重',{exact:true}).selectOption('700');
  await page.getByTitle('添加页面',{exact:true}).click();
  await page.getByRole('button',{name:'组件',exact:true}).click();
  await page.locator('.component-tile').filter({hasText:/^视频$/}).click();
  await page.getByTestId('material-picker').getByRole('tab',{name:'共创社区',exact:true}).click();
  await page.locator('.material-picker-card').first().click();
  await page.getByRole('button',{name:'使用此素材',exact:true}).click();
  await page.getByLabel('组件名称',{exact:true}).fill('离线视频');
  await page.getByLabel('X',{exact:true}).fill('120');
  await page.getByLabel('Y',{exact:true}).fill('120');
  await page.getByLabel('W',{exact:true}).fill('1600');
  await page.getByLabel('H',{exact:true}).fill('700');
  await page.locator('.component-tile').filter({hasText:/^音频$/}).click();
  await page.getByTestId('material-picker').getByRole('tab',{name:'我的素材',exact:true}).click();
  await page.locator('.material-picker-card').first().click();
  await page.getByRole('button',{name:'使用此素材',exact:true}).click();
  await page.getByLabel('组件名称',{exact:true}).fill('离线讲解');
  await page.getByLabel('X',{exact:true}).fill('120');
  await page.getByLabel('Y',{exact:true}).fill('880');
  await page.getByLabel('W',{exact:true}).fill('1600');
  await page.getByLabel('H',{exact:true}).fill('180');
  await page.getByTitle('添加页面',{exact:true}).click();
  await page.getByRole('button',{name:'组件',exact:true}).click();
  await page.locator('.component-tile').filter({hasText:'HTML 交互程序'}).click();
  await page.getByTestId('material-picker').getByRole('tab',{name:'共创社区',exact:true}).click();
  await page.locator('.material-picker-card').first().click();
  await page.getByRole('button',{name:'使用此素材',exact:true}).click();
  await page.getByLabel('W',{exact:true}).fill('1600');
  await page.getByLabel('H',{exact:true}).fill('900');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByText('所有更改已保存',{exact:true})).toBeVisible();

  const browserDownload=await exportDownload(page);
  const browserZip=await zipOf(browserDownload);
  await browserDownload.saveAs(join(artifacts,'browser-package.zip'));
  const scene=JSON.parse(await browserZip.file('scene.json')!.async('string'));
  const manifest=JSON.parse(await browserZip.file('manifest.json')!.async('string'));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhichuang-studio-v1')!).state.works.find((work:{id:string})=>work.id==='work-1'));
  expect(scene.title).toBe(title); expect(scene.pages).toHaveLength(3);
  expect(scene.pages[0].nodes.find((node:{name:string})=>node.name==='主标题').content).toContain('OFFLINE-当前版本');
  expect(scene.revision).toBe(saved.revision);
  expect(manifest.work.revision).toBe(scene.revision);
  expect(manifest.resources.some((resource:{mime:string})=>resource.mime.startsWith('video/'))).toBe(true);
  expect(manifest.resources.some((resource:{mime:string})=>resource.mime.startsWith('audio/'))).toBe(true);
  expect(JSON.stringify(scene)).not.toMatch(/(?:idb:|blob:|https?:\/\/|\/media\/)/);
  for(const resource of manifest.resources){
    expect(browserZip.file(resource.path)).not.toBeNull();
    const bytes=await browserZip.file(resource.path)!.async('nodebuffer');
    expect(bytes.byteLength).toBe(resource.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(resource.sha256);
  }
  const html=await browserZip.file('index.html')!.async('string');
  expect(html).toContain('id="scene-data"');expect(html).not.toMatch(/(?:src|href)="https?:/);
  expect(await browserZip.file('runtime.js')!.async('string')).not.toMatch(/\bfetch\s*\(/);

  expect(browserDownload.suggestedFilename()).toContain('管理平台运行包.zip');

  const extracted=await extract(browserZip);
  const context=await browser.newContext({offline:true,viewport:{width:1440,height:900}});
  const offline=await context.newPage();
  const runtimeErrors:string[]=[];const requests:string[]=[];const failures:string[]=[];
  offline.on('pageerror',error=>runtimeErrors.push(error.message));
  offline.on('request',request=>requests.push(request.url()));
  offline.on('requestfailed',request=>failures.push(`${request.url()} ${request.failure()?.errorText}`));
  await offline.goto(pathToFileURL(join(extracted,'index.html')).href);
  await expect(offline.locator('#stage')).toContainText('OFFLINE-当前版本');
  await expect(offline.getByText('OFFLINE-当前版本 · 走向新未来',{exact:true})).toHaveCSS('font-family','serif');
  await expect(offline.getByText('OFFLINE-当前版本 · 走向新未来',{exact:true})).toHaveCSS('font-weight','700');
  await expect(offline.locator('.event-card')).toHaveCount(5);
  await expect.poll(()=>offline.locator('#stage img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
  await offline.locator('.event-card').first().click();
  await expect(offline.locator('#detail')).toBeVisible();
  await expect(offline.locator('#detail-body h2')).toHaveText('初创 · 蓄势');
  await expect(offline.locator('#detail-body img')).toBeVisible();
  await offline.getByRole('button',{name:'关闭详情',exact:true}).click();
  await expect(offline.locator('#detail')).not.toBeVisible();
  await offline.screenshot({path:join(artifacts,'offline-timeline.png'),fullPage:true});

  await offline.locator('#page-nav button').nth(1).click();
  const video=offline.locator('video');const audio=offline.locator('audio');
  await expect(video).toBeVisible();await expect(audio).toBeVisible();
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  const videoBox=(await video.boundingBox())!;
  await video.click({position:{x:20,y:videoBox.height-20}});
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).currentTime)).toBeGreaterThan(.2);
  const videoStatus=await video.evaluate(element=>({currentTime:(element as HTMLVideoElement).currentTime,videoWidth:(element as HTMLVideoElement).videoWidth,duration:(element as HTMLVideoElement).duration,error:(element as HTMLVideoElement).error?.message||null}));
  expect(videoStatus.videoWidth).toBeGreaterThan(0);expect(videoStatus.error).toBeNull();
  await video.evaluate(element=>(element as HTMLVideoElement).pause());
  await expect.poll(()=>audio.evaluate(element=>(element as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(2);
  const audioBox=(await audio.boundingBox())!;
  const audioScale=audioBox.width/await audio.evaluate(element=>(element as HTMLAudioElement).clientWidth);
  await audio.click({position:{x:24*audioScale,y:audioBox.height/2}});
  await expect.poll(()=>audio.evaluate(element=>(element as HTMLAudioElement).currentTime)).toBeGreaterThan(.2);
  const audioStatus=await audio.evaluate(element=>({currentTime:(element as HTMLAudioElement).currentTime,duration:(element as HTMLAudioElement).duration,error:(element as HTMLAudioElement).error?.message||null}));
  expect(audioStatus.error).toBeNull();
  await offline.screenshot({path:join(artifacts,'offline-media.png'),fullPage:true});
  const audioHandle=(await audio.elementHandle())!;
  await offline.locator('#page-nav button').first().click();
  await expect(offline.locator('.event-card')).toHaveCount(5);
  expect(await audioHandle.evaluate(element=>(element as HTMLAudioElement).paused)).toBe(true);
  await offline.locator('#page-nav button').nth(2).click();
  const program=offline.frameLocator('iframe');
  await expect(program.getByRole('heading',{name:'让技术，连接更多可能',exact:true})).toBeVisible();
  await program.getByRole('button',{name:'人工智能',exact:true}).click();
  await expect(program.locator('#name')).toHaveText('人工智能');
  expect(await offline.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts');
  await offline.screenshot({path:join(artifacts,'offline-html.png'),fullPage:true});
  expect(requests.filter(url=>/^https?:/.test(url))).toEqual([]);
  // Chromium cancels local preload/range requests when playback starts or a page
  // is removed. Decoded dimensions, advancing clocks and media.error above prove
  // these are successful streams, not missing resources.
  const unexpectedFailures=failures.filter(failure=>!/^file:.*\.(?:mp4|wav) net::ERR_ABORTED$/.test(failure));
  expect(unexpectedFailures).toEqual([]);expect(runtimeErrors).toEqual([]);expect(uiErrors).toEqual([]);
  const report={date:new Date().toISOString(),browser:await browser.version(),viewport:'1440×900',offline:true,entry:pathToFileURL(join(extracted,'index.html')).href,workTitle:scene.title,revision:scene.revision,resourceCount:manifest.resources.length,video:videoStatus,audio:audioStatus,networkRequests:requests.filter(url=>/^https?:/.test(url)),unexpectedFailures,expectedMediaStops:failures,runtimeErrors,uiErrors,playerProtocol:'protocol-example'};
  await writeFile(join(artifacts,'verification.json'),JSON.stringify(report,null,2));
  await testInfo.attach('offline-export-verification',{body:JSON.stringify(report,null,2),contentType:'application/json'});
  await context.close();
});
