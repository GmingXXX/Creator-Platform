import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:'/Users/ming/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 for(const slug of ['milestone-timeline','floating-card']){
  await page.goto(`http://127.0.0.1:5390/components-catalog/${slug}/index.html`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({path:`public/components-catalog/${slug}/preview.png`});
  if(slug==='milestone-timeline'){
   await page.getByRole('tab',{name:'2025'}).click();
   if(await page.locator('#title').textContent()!=='向协同制造迈进')throw Error('Timeline year switching failed');
  }else{
   await page.getByRole('button',{name:'探索成果'}).click();
   if(!await page.locator('dialog').isVisible())throw Error('Card details failed');
   await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:375,height:650});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${slug} narrow overflow`);
  await page.setViewportSize({width:1280,height:720});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(resolve(`public/components-catalog/${slug}/index.html`)).href);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  if(slug==='milestone-timeline'){
   await page.getByRole('tab',{name:'2025'}).click();
   if(await page.locator('#title').textContent()!=='向协同制造迈进')throw Error('Offline timeline switching failed');
  }else{
   await page.getByRole('button',{name:'探索成果'}).click();
   if(!await page.locator('dialog').isVisible())throw Error('Offline card details failed');
  }
  await page.context().setOffline(false);
 }
 await mkdir('output/catalog-components',{recursive:true});
 await writeFile('output/catalog-components/runtime-check.json',JSON.stringify({errors,checks:['timeline selects year','card opens/closes detail','375px no horizontal overflow','screenshots captured from runtime','file:// offline images and interactions']},null,2));
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
