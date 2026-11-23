import {beforeEach,describe,it,expect} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {organizeExperience,editExperience} from '../src/domain/creation-experience';
import {createHistory,pushHistory,undoHistory} from '../src/features/editor/editor-domain';
import {syncCreativeHistory} from '../src/domain/work-creative-metadata';
beforeEach(()=>useStudio.setState(createInitialData()));
describe('creative records are independent of canvas history',()=>{
 it('preserves a revised summary when undoing the preceding AI change',async()=>{
  const state=useStudio.getState(),work=state.works.find(w=>(w.workspaceId||'personal')==='personal')!;
  const result=state.reviseWork(work.id,'把背景改成暖色');expect(result.ok).toBe(true);
  const summarized=await organizeExperience(work.id,{model:'demo'});const record=editExperience(work.id,{...summarized.experience!.sections,lessons:'人工确认的可复用方法'}).experience;
  expect(state.undoRevision(result.turnId!).ok).toBe(true);
  const restored=useStudio.getState().works.find(w=>w.id===work.id)!;expect(restored.pages).toEqual(work.pages);expect(restored.experience).toEqual(record);
 });
 it('keeps saved summary when an editor saves an older snapshot with a new canvas change',async()=>{
  const state=useStudio.getState(),old=structuredClone(state.works.find(w=>(w.workspaceId||'personal')==='personal')!);
  const summarized=await organizeExperience(old.id,{model:'demo'});state.saveWork({...old,title:'新的手动标题'});
  expect(useStudio.getState().works.find(w=>w.id===old.id)?.experience).toEqual(summarized.experience);
 });
 it('does not add an undo step for summary metadata or lose it on canvas undo',async()=>{
  const work=useStudio.getState().works.find(w=>(w.workspaceId||'personal')==='personal')!;
  const modified={...work,title:'手动标题'};useStudio.getState().saveWork(modified);
  const history=pushHistory(createHistory(work),modified),summarized=await organizeExperience(work.id,{model:'demo'});
  const synced=syncCreativeHistory(history,summarized);expect(synced.past).toHaveLength(1);
  const restored=undoHistory(synced).present;expect(restored.title).toBe(work.title);expect(restored.experience).toEqual(summarized.experience);
 });
});
