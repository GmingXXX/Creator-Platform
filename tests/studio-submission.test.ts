import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {prepareStudioSubmission} from '../src/features/studios/studio-submission';
beforeEach(()=>useStudio.setState(createInitialData()));
describe('editor submission snapshot',()=>{
 it.each(['presentation','story'] as const)('flushes unsaved %s edits before reading the snapshot',kind=>{
  const work=useStudio.getState().works.find(w=>w.kind===kind)!;
  const save=vi.fn(()=>{useStudio.getState().saveWork({...work,title:'最新内容'});return true;});
  const snapshot=prepareStudioSubmission(work.id,save)!;
  expect(save).toHaveBeenCalledOnce();expect(snapshot.title).toBe('最新内容');
  expect(snapshot.revision).toBeGreaterThan(work.revision);
  expect(snapshot).not.toBe(useStudio.getState().works.find(w=>w.id===work.id));
 });
 it('does not open a snapshot if saving fails',()=>{
  const work=useStudio.getState().works[0];expect(prepareStudioSubmission(work.id,()=>false)).toBeUndefined();
  expect(()=>prepareStudioSubmission(work.id,()=>{throw new Error('存储失败');})).toThrow('存储失败');
 });
 it('blocks missing, deleted and read-only works before saving',()=>{
  const work=useStudio.getState().works[0],save=vi.fn(()=>true);
  expect(()=>prepareStudioSubmission('missing',save)).toThrow();
  useStudio.setState({works:[{...work,deletedAt:new Date().toISOString()}]});
  expect(()=>prepareStudioSubmission(work.id,save)).toThrow();
  useStudio.setState({works:[{...work,workspaceId:'missing-space'}]});
  expect(()=>prepareStudioSubmission(work.id,save)).toThrow();expect(save).not.toHaveBeenCalled();
 });
 it('rechecks access and existence after the save callback',()=>{
  const work=useStudio.getState().works[0];
  expect(()=>prepareStudioSubmission(work.id,()=>{useStudio.setState({works:[]});return true;})).toThrow();
 });
});
