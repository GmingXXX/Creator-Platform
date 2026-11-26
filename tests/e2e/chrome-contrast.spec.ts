import {expect,test,type Locator,type Page} from '@playwright/test';

async function contrast(locator:Locator) {
 return locator.evaluate(element=>{
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  const channels=(css:string)=>{
    ctx.clearRect(0,0,1,1);ctx.fillStyle=css;ctx.fillRect(0,0,1,1);
    const [r,g,b,a]=ctx.getImageData(0,0,1,1).data;
    return [r,g,b,a/255];
  };
  const composite=(back:number[],front:number[])=>back.map((value,index)=>value+(front[index]-value)*(front[3]??1));
  const layers:number[][]=[];
  for(let parent:Element|null=element;parent;parent=parent.parentElement)layers.push(channels(getComputedStyle(parent).backgroundColor));
  const background=layers.reverse().reduce(composite,[255,255,255]);
  const foreground=composite(background,channels(getComputedStyle(element).color));
  const luminance=(rgb:number[])=>rgb.map(byte=>byte/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const [low,high]=[luminance(foreground),luminance(background)].sort((a,b)=>a-b);
  return {ratio:(high+.05)/(low+.05),background};
 });
}

async function checkControl(page:Page, item:Locator,theme:string, neutral=true){
 await expect(item).toBeVisible();
 await page.mouse.move(1,1);
 expect((await contrast(item)).ratio).toBeGreaterThanOrEqual(4.5);
 await item.hover();
 await expect.poll(async()=>(await contrast(item)).ratio).toBeGreaterThanOrEqual(4.5);
 // Inspect the final transition state too: a failing color can start from a readable one.
 await item.evaluate(el=>el.getAnimations().forEach(animation=>animation.finish()));
 const result=await contrast(item);
 expect(result.ratio).toBeGreaterThanOrEqual(4.5);
 if(neutral&&theme==='dark')expect(Math.max(...result.background)).toBeLessThan(150);
}

for(const theme of ['light','dark'])test('interactive chrome contrast and neutral hover in '+theme, async({page})=>{
 await page.goto('/#/login');
 if(theme==='dark')await page.getByRole('button',{name:'切换到暗色模式'}).click();
 await page.getByRole('button',{name:'填入',exact:true}).click();
 await checkControl(page,page.getByRole('button',{name:'进入工作台'}),theme,false);
 await page.getByRole('button',{name:'进入工作台'}).click();
 await expect(page.locator('.composer')).toBeVisible();
 const sidebarToggle=page.locator('.sidebar-toggle');
 await checkControl(page,sidebarToggle,theme);
 await sidebarToggle.focus();
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 await expect(sidebarToggle).toBeFocused();
 await expect(sidebarToggle).toHaveCSS('outline-style','solid');

 await page.goto('/#/editor/work-1');
 await checkControl(page,page.locator('.editor-home-logo'),theme);
 const ghost=page.locator('.editor-toolbar .btn-ghost:not(:disabled)').first();
 await checkControl(page,ghost,theme);
 const disabled=page.locator('.editor-toolbar .btn:disabled').first();
 await expect(disabled).toBeDisabled();
 const disabledColor=await disabled.evaluate(el=>getComputedStyle(el).backgroundColor);
 await disabled.hover({force:true});
 await expect(disabled).toHaveCSS('background-color',disabledColor);

 await page.goto('/#/video/work-5');
 await checkControl(page,page.locator('.studio-home-logo'),theme);
 await checkControl(page,page.locator('.video-shot-list > button:not(.active)').first(),theme);
 const selected=page.locator('.video-shot-list > button.active');
 await checkControl(page,selected,theme);

 await page.goto('/#/dream/work-6');
 await page.locator('.react-flow__node').first().click();
 await checkControl(page,page.locator('.story-route-summary').first(),theme);
 await page.goto('/#/review');
 await checkControl(page,page.locator('.res-review-role .btn'),theme);
});
