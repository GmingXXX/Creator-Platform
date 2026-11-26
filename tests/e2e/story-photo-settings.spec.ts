import {test,expect} from '@playwright/test';
import type {StudioData} from '../../src/domain/types';

test('设置拍照窗口与倒计时，确认样片后沿事件进入结局',async({page})=>{
  await page.goto('/#/login');
  await page.getByRole('button',{name:'填入',exact:true}).click();
  await page.getByRole('button',{name:'进入工作台'}).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.evaluate(()=>{
    const key='zhichuang-studio-v1', record=JSON.parse(localStorage.getItem(key)!);
    const state:StudioData=record.state;
    const works=state.works.map(work=>work.id!=='work-6'?work:{...work,
      storyNodes:['start','photo','end'].map((type,i)=>({id:String(i),type,title:['序幕','留真取景','结局'][i],text:'',x:270*i,y:80,
        layers:type==='end'?['photo','faceImage','faceVideo'].map((source,index)=>({id:source,name:source,kind:source==='faceVideo'?'video':'image',resultSource:source,text:'',x:index*30,y:60,width:25,height:20})):[]})),
      storyEdges:[{id:'first',source:'0',target:'1',label:'进入取景'},{id:'accept',source:'1',target:'2',label:'下一幕',trigger:'photoConfirm'},{id:'skip',source:'1',target:'2',label:'跳转',trigger:'photoSkip'}]
    });
    const assets=[...state.assets,...[
      ['山水模板','image','/media/industrial.svg'],['留真模板','image','/media/finance.svg'],['故事样片','video','/media/demo-loop.mp4'],
    ].map(([name,kind,src])=>({id:'template-'+name,workspaceId:works.find(w=>w.id==='work-6')?.workspaceId||'personal',name,kind,src,preview:kind==='image'?src:'/media/demo-loop-poster.jpg',source:'uploaded',description:'',tags:[],author:'纪鸣',createdAt:'2026-11-25'}))];
    localStorage.setItem(key,JSON.stringify({...record,state:{...state,assets,works}}));
  });
  await page.reload();await page.goto('/#/dream/work-6');
  await page.locator('.react-flow__node').filter({hasText:'留真取景'}).click();
  const settings=page.getByRole('region',{name:'拍照设置'});
  await settings.getByText('换脸模板 · 样片演示').click();
  const choose=async(button:string,name:string)=>{
    await settings.getByRole('button',{name:button,exact:true}).click();
    await page.getByRole('button',{name:'选择'+name,exact:true}).click();
    await page.getByRole('button',{name:'使用此素材'}).click();
  };
  await choose('选择图片模板','山水模板');
  await choose('替换图片模板','留真模板');
  await choose('选择视频模板','故事样片');
  await settings.getByLabel('拍前提示').fill('请站到取景框中央');
  await settings.getByLabel('拍摄倒计时（秒）').fill('2');
  await settings.getByLabel('允许重拍').uncheck();
  await settings.getByText('取景框',{exact:true}).click();
  await settings.getByLabel('取景框形状').selectOption('circle');
  await settings.getByLabel('取景框边框').selectOption('dashed');
  await page.getByRole('button',{name:'预览',exact:true}).click();
  const preview=page.getByRole('dialog');
  await preview.getByRole('button',{name:'进入取景',exact:true}).click();
  await expect(preview.locator('.story-photo-viewfinder')).toHaveCSS('border-radius','50%');
  await expect(preview.locator('.story-photo-viewfinder')).toHaveCSS('border-style','dashed');
  await expect(preview.getByText('请站到取景框中央')).toBeVisible();
  await preview.getByRole('button',{name:'拍摄样片'}).click();
  await expect(preview.getByRole('status').filter({hasText:'拍摄倒计时'})).toBeVisible();
  await preview.getByRole('button',{name:'取消倒计时'}).click();
  await expect(preview.getByText('请站到取景框中央')).toBeVisible();
  await preview.getByRole('button',{name:'拍摄样片'}).click();
  await expect(preview.getByRole('button',{name:'确认照片'})).toBeVisible();
  await expect(preview.getByRole('button',{name:'重拍'})).toHaveCount(0);
  await preview.getByRole('button',{name:'确认照片'}).click();
  await expect(preview.locator('.story-preview-body h2')).toHaveText('结局');
  await expect(preview.locator('[aria-label="photo"] img')).toHaveAttribute('src',/culture.svg/);
  await expect(preview.locator('[aria-label="faceImage"] img')).toHaveAttribute('src',/finance.svg/);
  await expect(preview.locator('[aria-label="faceVideo"] video')).toHaveAttribute('src',/demo-loop.mp4/);
  await expect(preview.getByText('模板样片',{exact:true})).toHaveCount(2);
  await preview.getByRole('button',{name:'返回上一步'}).click();
  await preview.getByRole('button',{name:'跳过拍照'}).click();
  await expect(preview.locator('.story-preview-body h2')).toHaveText('结局');
  await page.reload();
  await page.goto('/#/dream/work-6');
  await page.locator('.react-flow__node').filter({hasText:'留真取景'}).click();
  await settings.getByText('换脸模板 · 样片演示').click();
  await expect(settings.getByText('留真模板',{exact:true})).toBeVisible();
  await expect(settings.getByText('故事样片',{exact:true})).toBeVisible();
  await expect(settings.getByLabel('拍前提示')).toHaveValue('请站到取景框中央');
  await page.locator('.react-flow__node').filter({hasText:'留真取景'}).dblclick();
  const detail=page.getByRole('dialog');
  const detailSettings=detail.getByRole('region',{name:'拍照设置'});
  await detailSettings.getByText('取景框',{exact:true}).click();
  await detailSettings.getByLabel('取景框形状').selectOption('rect');
  await expect(detail.locator('.story-photo-viewfinder')).toHaveCSS('border-radius','0px');
  await detail.getByRole('button',{name:'完成并返回流程'}).click();
  await expect(settings.getByLabel('取景框形状')).toHaveValue('rect');
});
