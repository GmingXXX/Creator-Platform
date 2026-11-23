import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {applyAIRevision,reviseWorkWithAI} from '../src/domain/ai-revision';
import {useStudio} from '../src/domain/store';
vi.mock('../src/domain/ai-client',()=>({aiChat:vi.fn()}));
import {aiChat} from '../src/domain/ai-client';
const sample=()=>({...createSceneWork({title:'测试',type:'时间演进型',width:1920,height:1080}),aiModel:'deepseek-flash'});
const response=(patches:unknown[])=>({summary:'已调整',patches});
describe('AI revision boundary',()=>{
 it('changes only allowed selected fields without mutating input',()=>{const w=sample(),before=structuredClone(w),p=w.pages[0],n=p.nodes[0];const result=applyAIRevision(w,{scope:'node',pageId:p.id,nodeId:n.id},response([{kind:'node',pageId:p.id,nodeId:n.id,changes:{content:'新的内容',fontSize:42}}]));expect(result.pages[0].nodes[0].content).toBe('新的内容');expect(result.pages[0].nodes.slice(1)).toEqual(w.pages[0].nodes.slice(1));expect(w).toEqual(before)});
 it.each([{src:'https://evil.example/code'},{locked:false},{id:'replacement'},{x:Infinity},{background:'url(https://evil)'},{w:-1}])('rejects unsafe node changes %j',changes=>{const w=sample(),p=w.pages[0],n=p.nodes[0];expect(()=>applyAIRevision(w,{scope:'work'},response([{kind:'node',pageId:p.id,nodeId:n.id,changes}]))).toThrow()});
 it('rejects cross-scope, missing, and locked targets atomically',()=>{const w=sample(),p=w.pages[0],n=p.nodes[0];for(const nodeId of ['missing',p.nodes[1].id])expect(()=>applyAIRevision(w,{scope:'node',pageId:p.id,nodeId:n.id},response([{kind:'node',pageId:p.id,nodeId,changes:{content:'bad'}}]))).toThrow();const locked={...w,pages:[{...p,nodes:p.nodes.map(x=>({...x,locked:true}))}]};expect(()=>applyAIRevision(locked,{scope:'work'},response([{kind:'node',pageId:p.id,nodeId:n.id,changes:{content:'bad'}}]))).toThrow()});
 it('does not permit work or page changes from a node selection',()=>{const w=sample(),p=w.pages[0],target={scope:'node' as const,pageId:p.id,nodeId:p.nodes[0].id};for(const patch of [{kind:'work',changes:{title:'bad'}},{kind:'page',pageId:p.id,changes:{background:'#123456'}}])expect(()=>applyAIRevision(w,target,response([patch]))).toThrow()});
 it('validates JSON and preserves content on empty or oversized output',()=>{const w=sample();for(const body of [null,{},response([]),response(Array(51).fill({})),{summary:'ok',patches:[],extra:true}])expect(()=>applyAIRevision(w,{scope:'work'},body)).toThrow()});
 it('supports page backgrounds while preserving components',()=>{const w=sample(),p=w.pages[0];const out=applyAIRevision(w,{scope:'page',pageId:p.id},response([{kind:'page',pageId:p.id,changes:{background:'#123456',clearBackgroundImage:true}}]));expect(out.pages[0].backgroundImage).toBeUndefined();expect(out.pages[0].nodes).toEqual(p.nodes)});
 it('allows new content items but preserves known image refs',()=>{const w=sample(),p=w.pages[0],n=p.nodes.find(n=>n.items?.length)!;const first=n.items![0];const out=applyAIRevision(w,{scope:'work'},response([{kind:'node',pageId:p.id,nodeId:n.id,changes:{items:[{id:first.id,title:'改名',description:'说明'},{id:'new-year',title:'新节点',description:'说明',year:'2026'}]}}]));const items=out.pages[0].nodes.find(x=>x.id===n.id)!.items!;expect(items[0].image).toBe(first.image);expect(items[1].year).toBe('2026');expect(()=>applyAIRevision(w,{scope:'work'},response([{kind:'node',pageId:p.id,nodeId:n.id,changes:{items:[{id:'bad',title:'a',description:'b',image:'https://evil'}]}}]))).toThrow()});
 it('adds editable native nodes to an empty page without touching other pages',()=>{
  const w={...sample(),pages:sample().pages.map(p=>({...p,nodes:[]}))},page=w.pages[0],before=structuredClone(w);
  const result=applyAIRevision(w,{scope:'page',pageId:page.id},response([
   {kind:'add-node',pageId:page.id,changes:{type:'text',name:'标题',content:'企业的发展',x:80,y:100,w:900,h:100,fontSize:56}},
   {kind:'add-node',pageId:page.id,changes:{type:'timeline',x:80,y:300,w:1700,h:600,items:[{id:'year-2026',title:'新起点',description:'面向未来',year:'2026'}]}}
  ]));
  expect(result.pages[0].nodes.map(n=>n.type)).toEqual(['text','timeline']);
  expect(result.pages[0].nodes[1].items?.[0].year).toBe('2026');
  expect(new Set(result.pages[0].nodes.map(n=>n.id)).size).toBe(2);expect(w).toEqual(before);
 });
 it.each([{type:'html',content:'<script>alert(1)</script>'},{type:'text',src:'https://evil.example'},{type:'text',id:'hijack'},{type:'text',locked:true}])('rejects unsafe newly added components %j',changes=>{
  const w=sample();expect(()=>applyAIRevision(w,{scope:'page',pageId:w.pages[0].id},response([{kind:'add-node',pageId:w.pages[0].id,changes}]))).toThrow();
 });
 it('does not expand a selected component edit to add siblings',()=>{
  const w=sample(),page=w.pages[0];expect(()=>applyAIRevision(w,{scope:'node',pageId:page.id,nodeId:page.nodes[0].id},response([{kind:'add-node',pageId:page.id,changes:{type:'text',content:'outside'}}]))).toThrow();
 });
});
describe('AI revision persistence',()=>{
 beforeEach(()=>{useStudio.getState().resetDemo();vi.mocked(aiChat).mockReset()});
 it('uses DeepSeek for blank or template works without a model binding',async()=>{
  const w={...sample(),aiModel:undefined};useStudio.setState(s=>({works:[w,...s.works]}));
  vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(response([{kind:'work',changes:{title:'真实模型修改'}}])),model:'deepseek-flash'});
  await reviseWorkWithAI(w.id,'修改标题');expect(aiChat).toHaveBeenCalledWith('deepseek-flash',expect.any(Array),undefined);
  expect(useStudio.getState().works.find(x=>x.id===w.id)?.aiModel).toBe('deepseek-flash');
 });
 it('does not invoke a remote model when the work explicitly uses demo mode',async()=>{
  const w={...sample(),aiModel:'demo'};useStudio.setState(s=>({works:[w,...s.works]}));
  await expect(reviseWorkWithAI(w.id,'修改')).rejects.toThrow('演示模式');expect(aiChat).not.toHaveBeenCalled();
 });
 it('stores an undoable revision',async()=>{const w=sample();useStudio.setState(s=>({works:[w,...s.works]}));vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(response([{kind:'work',changes:{title:'新标题'}}])),model:'deepseek-flash'});const result=await reviseWorkWithAI(w.id,'改标题',{scope:'work'});expect(result.ok).toBe(true);expect(useStudio.getState().works.find(x=>x.id===w.id)?.title).toBe('新标题');expect(useStudio.getState().undoRevision(result.turnId!).ok).toBe(true);expect(useStudio.getState().works.find(x=>x.id===w.id)?.title).toBe(w.title)});
 it('does not overwrite newer manual edits',async()=>{const w=sample();useStudio.setState(s=>({works:[w,...s.works]}));vi.mocked(aiChat).mockImplementation(async()=>{useStudio.getState().saveWork({...w,title:'手动修改'});return {content:JSON.stringify(response([{kind:'work',changes:{title:'AI覆盖'}}])),model:'deepseek-flash'}});await expect(reviseWorkWithAI(w.id,'改标题',{scope:'work'})).rejects.toThrow('后续修改');expect(useStudio.getState().works.find(x=>x.id===w.id)?.title).toBe('手动修改')});
 it('does not fallback to fake success on malformed or failed model responses',async()=>{const w=sample();useStudio.setState(s=>({works:[w,...s.works]}));vi.mocked(aiChat).mockResolvedValue({content:'not-json',model:'deepseek-flash'});await expect(reviseWorkWithAI(w.id,'修改',{scope:'work'})).rejects.toThrow();expect(useStudio.getState().works.find(x=>x.id===w.id)).toEqual(w)});
 it('flushes pending canvas edits before committing and rejects the stale result',async()=>{const w=sample();useStudio.setState(s=>({works:[w,...s.works]}));vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(response([{kind:'work',changes:{title:'AI标题'}}])),model:'deepseek-flash'});const flush=vi.fn(()=>useStudio.getState().saveWork({...w,title:'尚未自动保存的画布修改'}));await expect(reviseWorkWithAI(w.id,'改标题',{scope:'work'},[],undefined,flush)).rejects.toThrow('后续修改');expect(flush).toHaveBeenCalledOnce();expect(useStudio.getState().works.find(x=>x.id===w.id)?.title).toBe('尚未自动保存的画布修改')});
 it('does not commit a cancelled result even if the transport resolves',async()=>{const w=sample(),controller=new AbortController();useStudio.setState(s=>({works:[w,...s.works]}));vi.mocked(aiChat).mockImplementation(async()=>{controller.abort();return {content:JSON.stringify(response([{kind:'work',changes:{title:'已取消'}}])),model:'deepseek-flash'}});await expect(reviseWorkWithAI(w.id,'改标题',{scope:'work'},[],controller.signal)).rejects.toThrow('取消');expect(useStudio.getState().works.find(x=>x.id===w.id)).toEqual(w)});
 it('keeps the original when the API fails and rejects inaccessible attachments before calling',async()=>{const w=sample();useStudio.setState(s=>({works:[w,...s.works]}));await expect(reviseWorkWithAI(w.id,'改标题',{scope:'work'},['missing'])).rejects.toThrow('参考素材');expect(aiChat).not.toHaveBeenCalled();vi.mocked(aiChat).mockRejectedValue(new Error('模型服务暂时不可用'));await expect(reviseWorkWithAI(w.id,'改标题')).rejects.toThrow('暂时不可用');expect(useStudio.getState().works.find(x=>x.id===w.id)).toEqual(w)});

 it('rejects an oversized whole-work context before charging and asks for a narrower scope',async()=>{const original=sample(),w={...original,pages:Array.from({length:12},(_,i)=>({...original.pages[0],id:`page-${i}`,nodes:original.pages[0].nodes.map(n=>({...n,content:'长正文'.repeat(1000)}))}))};useStudio.setState(s=>({works:[w,...s.works]}));await expect(reviseWorkWithAI(w.id,'优化文案')).rejects.toThrow('页面或组件');expect(aiChat).not.toHaveBeenCalled()});
 it('drops old conversation context before rejecting an otherwise compact scoped request',async()=>{const w=sample(),page=w.pages[0],node=page.nodes[0];useStudio.setState(s=>({works:[w,...s.works],conversationTurns:Array.from({length:6},(_,i)=>({id:`old-${i}`,workId:w.id,prompt:'过去的请求'.repeat(1000),summary:'过去的回复'.repeat(1000),target:{scope:'work'},status:'unsupported',createdAt:'2026-11-11'}))}));vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(response([{kind:'node',pageId:page.id,nodeId:node.id,changes:{content:'新标题'}}])),model:'deepseek-flash'});await reviseWorkWithAI(w.id,'修改选中文本',{scope:'node',pageId:page.id,nodeId:node.id});const userMessage=vi.mocked(aiChat).mock.calls[0][1].find(m=>m.role==='user')!;expect(userMessage.content.length).toBeLessThanOrEqual(12000);expect(JSON.parse(userMessage.content).history).toEqual([]);expect(JSON.parse(userMessage.content).request).toBe('修改选中文本')});

});
