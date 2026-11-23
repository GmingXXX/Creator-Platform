import {beforeEach,expect,it,vi} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {reviseWorkWithAI} from '../src/domain/ai-revision';
import {useStudio} from '../src/domain/store';
import {reviseScene} from '../src/domain/conversation';
const access=vi.hoisted(()=>({denied:false}));
vi.mock('../src/domain/ai-client',()=>({aiChat:vi.fn()}));
vi.mock('../src/domain/workspace-management',async original=>({...await original<object>(),workspaceCanEdit:()=>!access.denied}));
import {aiChat} from '../src/domain/ai-client';
const fixture=()=>({...createSceneWork({title:'排版演示',type:'时间演进型',width:1920,height:1080}),aiModel:'deepseek-flash'});
beforeEach(()=>{access.denied=false;useStudio.getState().resetDemo();vi.mocked(aiChat).mockReset();});
function seed(){const work=fixture();useStudio.setState({works:[work],conversationTurns:[]});return work;}
it('applies a clearly labelled local relayout without a model call and supports undo',async()=>{
 const work=seed(),result=await reviseWorkWithAI(work.id,'重新排版整个页面',{scope:'page',pageId:work.pages[0].id});
 expect(result.ok).toBe(true);expect(result.summary).toContain('本地规则');expect(aiChat).not.toHaveBeenCalled();
 const updated=useStudio.getState().works[0];expect(updated.pages).not.toEqual(work.pages);expect(updated.revision).toBe(work.revision+1);
 expect(updated.pages.flatMap(p=>p.nodes.map(n=>[n.id,n.content,n.items,n.src,n.assetId]))).toEqual(work.pages.flatMap(p=>p.nodes.map(n=>[n.id,n.content,n.items,n.src,n.assetId])));
 expect(useStudio.getState().undoRevision(result.turnId!).ok).toBe(true);expect(useStudio.getState().works[0].pages).toEqual(work.pages);
});
it('supports demo-mode local relayout through the existing scene/store transaction',()=>{
 const work=seed();expect(reviseScene(work,'重新排版',{scope:'work'}).ok).toBe(true);
 const result=useStudio.getState().reviseWork(work.id,'重新排版',{scope:'work'});expect(result.ok).toBe(true);expect(result.summary).toContain('本地规则');expect(useStudio.getState().undoRevision(result.turnId!).ok).toBe(true);
});
it('does not silently discard mixed instructions into the local shortcut',async()=>{
 const work=seed();vi.mocked(aiChat).mockResolvedValue({model:'deepseek-flash',content:JSON.stringify({summary:'已修改标题',patches:[{kind:'work',changes:{title:'新标题'}}]})});
 await reviseWorkWithAI(work.id,'重新排版并把标题改为新标题');expect(aiChat).toHaveBeenCalledOnce();expect(useStudio.getState().works[0].title).toBe('新标题');
});
it('rejects locked-down workspace, cancelled requests and node scope without altering the work',async()=>{
 const work=seed();access.denied=true;await expect(reviseWorkWithAI(work.id,'重新排版')).rejects.toThrow('权限');access.denied=false;
 const cancel=new AbortController();cancel.abort();await expect(reviseWorkWithAI(work.id,'重新排版',{scope:'work'},[],cancel.signal)).rejects.toThrow('取消');
 const lateCancel=new AbortController();await expect(reviseWorkWithAI(work.id,'重新排版',{scope:'work'},[],lateCancel.signal,()=>lateCancel.abort())).rejects.toThrow('取消');
 await expect(reviseWorkWithAI(work.id,'重新排版',{scope:'node',pageId:work.pages[0].id,nodeId:work.pages[0].nodes[0].id})).rejects.toThrow('范围');
 expect(aiChat).not.toHaveBeenCalled();expect(useStudio.getState().works[0]).toEqual(work);expect(useStudio.getState().conversationTurns).toEqual([]);
});
it('rechecks changes and permissions after flushing the editor, and never commits stale layouts',async()=>{
 const work=seed();await expect(reviseWorkWithAI(work.id,'重新排版',{scope:'work'},[],undefined,()=>useStudio.getState().saveWork({...work,title:'最新编辑'}))).rejects.toThrow('后续修改');expect(useStudio.getState().works[0].title).toBe('最新编辑');
 useStudio.setState({works:[work]});await expect(reviseWorkWithAI(work.id,'重新排版',{scope:'work'},[],undefined,()=>{access.denied=true;})).rejects.toThrow('权限');expect(useStudio.getState().works[0]).toEqual(work);expect(useStudio.getState().conversationTurns).toEqual([]);
});
it('rejects inaccessible attachments and no-op layouts without creating applied turns',async()=>{
 const work=seed();await expect(reviseWorkWithAI(work.id,'重新排版',{scope:'work'},['missing'])).rejects.toThrow('参考素材');
 await reviseWorkWithAI(work.id,'重新排版');const previous=useStudio.getState().works[0];await expect(reviseWorkWithAI(work.id,'重新排版')).rejects.toThrow('无需重复修改');expect(useStudio.getState().works[0]).toEqual(previous);expect(useStudio.getState().conversationTurns).toHaveLength(1);
});
