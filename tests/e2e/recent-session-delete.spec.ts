import {expect,test,type Page} from '@playwright/test';
import type {StudioData} from '../../src/domain/types';
import type {CreationSession} from '../../src/domain/creation-session';

const prompt='展厅历史沿革时间轴';
const remaining='企业介绍会话';
const separate='信泰项目会话';
const storage='zhichuang-studio-v1';

async function readStudio(page:Page):Promise<StudioData>{
  return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).state,storage);
}

test('取消保留最近会话，确认后刷新仍移除，并可继续打开原作品',async({page})=>{
  await page.goto('/#/login');
  await page.getByRole('button',{name:'填入',exact:true}).click();
  await page.getByRole('button',{name:'进入工作台'}).click();
  await expect(page.getByRole('textbox',{name:'创作需求'})).toBeVisible();
  const workTitle=await page.evaluate(({storage,prompt,remaining,separate})=>{
    const record=JSON.parse(localStorage.getItem(storage)!);
    const state:StudioData=record.state;
    const work=state.works.find(w=>w.id==='work-1')!;
    const runId='run-session-removal';
    const run={
      id:runId,workspaceId:'personal',workId:work.id,outputKind:'exhibit' as const,status:'complete' as const,
      step:5,prompt,model:'demo',styleId:work.styleId,skillIds:[],attachmentIds:[],createdAt:new Date().toISOString(),
    };
    const session=(id:string,text:string,workspaceId='personal'):CreationSession=>({
      id,workspaceId,prepared:true,draft:{...state.drafts[0],workspaceId,text,model:'demo'},
      messages:[{id:id+'-message',role:'user',text}],
    });
    const sessions=[
      {...session('chat-remove',prompt),runId},
      session('chat-remain',remaining),
      session('chat-other',separate,'xintai'),
    ];
    localStorage.setItem('zc-sidebar','0');
    localStorage.setItem(storage,JSON.stringify({...record,state:{...state,runs:[run,...state.runs],creationSessions:sessions}}));
    return work.title;
  },{storage,prompt,remaining,separate});
  await page.goto('/#/projects');
  await page.reload();
  const sidebar=page.locator('.sidebar-recents');
  const conversation=sidebar.getByRole('link',{name:prompt,exact:true});
  const remove=sidebar.getByRole('button',{name:'删除会话：'+prompt,exact:true});
  const dialog=page.getByRole('dialog');
  await conversation.hover();
  await remove.click({timeout:3500});
  await expect(dialog).toContainText(prompt);
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await expect(conversation).toBeVisible();
  await expect(page).toHaveURL(/#\/projects$/);
  await conversation.focus();
  await page.keyboard.press('Tab');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button',{name:/删除/}).click();
  await expect(conversation).toHaveCount(0);
  await expect(page).toHaveURL(/#\/projects$/);
  await page.reload();
  await expect(conversation).toHaveCount(0);
  await expect(sidebar.getByRole('link',{name:remaining,exact:true})).toBeVisible();
  await expect(sidebar.getByRole('link',{name:separate,exact:true})).toHaveCount(0);
  await expect(sidebar.getByRole('button',{name:'删除草稿：'+workTitle,exact:true})).toBeAttached();
  await page.getByRole('button',{name:'打开'+workTitle,exact:true}).click();
  await expect(page).toHaveURL(/#\/editor\/work-1$/);
  const state=await readStudio(page);
  expect(state.creationSessions?.map(s=>s.id)).toEqual(['chat-remain','chat-other']);
  expect(state.works.find(w=>w.id==='work-1')?.deletedAt).toBeFalsy();
  await page.goto('/#/projects');
  await page.getByRole('button',{name:'切换创作空间'}).click();
  await page.getByRole('menuitem',{name:'信泰企业展厅',exact:true}).click();
  await expect(sidebar.getByRole('link',{name:separate,exact:true})).toBeVisible();
  await expect(sidebar.getByRole('link',{name:remaining,exact:true})).toHaveCount(0);
});
