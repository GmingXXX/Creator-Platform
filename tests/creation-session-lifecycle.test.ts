import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createDraft,createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {deleteCreationSession,type CreationSession} from '../src/domain/creation-session';
import {isAssetReferenced} from '../src/domain/generation';

const chat=(workspaceId:string):CreationSession=>({id:'chat-'+workspaceId,workspaceId,draft:createDraft({workspaceId}),messages:[{id:'message',role:'user',text:'保存在此空间的私有需求'}]});
function storage():Storage{
 const items=new Map<string,string>();
 return {get length(){return items.size;},clear:()=>items.clear(),getItem:k=>items.get(k)??null,key:i=>[...items.keys()][i]??null,setItem:(k,v)=>{items.set(k,v);},removeItem:k=>{items.delete(k);}};
}
beforeEach(()=>{
 vi.stubGlobal('sessionStorage',storage());
 vi.stubGlobal('localStorage',storage());
 useStudio.setState({...createInitialData(),creationSessions:[chat('personal'),chat('xintai')]});
});
afterEach(()=>vi.unstubAllGlobals());
it('preserves chats and checkpoints while an archived or recycled space is recoverable, then removes only that space',()=>{
 const state=useStudio.getState();
 for(const id of ['personal','xintai']){
  sessionStorage.setItem('zc-followup-chat-'+id,'未发送');
  localStorage.setItem('zc-creation-plan:'+id+':demo','方案');
 }
 state.archiveWorkspace('xintai');state.deleteWorkspace('xintai');
 expect(useStudio.getState().creationSessions).toHaveLength(2);
 expect(sessionStorage.getItem('zc-followup-chat-xintai')).toBe('未发送');
 state.permanentlyDeleteWorkspace('xintai','信泰企业展厅');
 expect(useStudio.getState().creationSessions?.map(s=>s.workspaceId)).toEqual(['personal']);
 expect(sessionStorage.getItem('zc-followup-chat-xintai')).toBeNull();
 expect(localStorage.getItem('zc-creation-plan:xintai:demo')).toBeNull();
 expect(localStorage.getItem('zc-creation-plan:personal:demo')).toBe('方案');
 expect(sessionStorage.getItem('zc-followup-chat-personal')).toBe('未发送');
});
it('preserves pending chat attachments in other spaces and rejects the purge atomically',()=>{
 const state=useStudio.getState(),asset={...state.assets[0],id:'referenced-by-queue',workspaceId:'xintai',public:false,src:'idb:queued'};
 const session={...chat('personal'),queued:[{id:'pending',role:'user' as const,text:'应用配图',attachmentIds:[asset.id]}]};
 useStudio.setState({assets:[...state.assets,asset],creationSessions:[session,chat('xintai')]});
 expect(isAssetReferenced(useStudio.getState(),asset.id,asset.src)).toBe(true);
 state.deleteWorkspace('xintai');
 expect(()=>state.permanentlyDeleteWorkspace('xintai','信泰企业展厅')).toThrow('依赖');
 expect(useStudio.getState().creationSessions).toHaveLength(2);
});
it('resets all chats including unsent replies and saved plan drafts',()=>{
 sessionStorage.setItem('zc-followup-chat-personal','私有草稿');
 localStorage.setItem('zc-creation-plan:xintai:run','私有方案');
 useStudio.getState().resetDemo();
 expect(useStudio.getState().creationSessions).toEqual([]);
 expect(sessionStorage.getItem('zc-followup-chat-personal')).toBeNull();
 expect(localStorage.getItem('zc-creation-plan:xintai:run')).toBeNull();
});

it('drops stale chats from a previously purged workspace during rehydration',()=>{
 const state=useStudio.getState();
 state.deleteWorkspace('xintai');state.permanentlyDeleteWorkspace('xintai','信泰企业展厅');
 const after=useStudio.getState();
 const previous={...JSON.parse(JSON.stringify(after)),creationSessions:[chat('personal'),chat('xintai')]};
 const loaded=useStudio.persist.getOptions().merge!(previous,after);
 expect(loaded.creationSessions?.map(c=>c.workspaceId)).toEqual(['personal']);
});

it('deletes only the selected conversation and its unsent reply',()=>{
 const state=useStudio.getState(),id='chat-personal';
 sessionStorage.setItem('zc-followup-'+id,'未发的回复');
 sessionStorage.setItem('zc-followup-chat-xintai','其他会话');
 deleteCreationSession(id);
 const after=useStudio.getState();
 expect(after.creationSessions?.map(s=>s.id)).toEqual(['chat-xintai']);
 expect(sessionStorage.getItem('zc-followup-'+id)).toBeNull();
 expect(sessionStorage.getItem('zc-followup-chat-xintai')).toBe('其他会话');
 expect(after.works).toBe(state.works);
 expect(after.assets).toBe(state.assets);
 expect(after.runs).toBe(state.runs);
 expect(after.drafts).toBe(state.drafts);
});
it('refuses to delete a conversation outside the active editable workspace',()=>{
 expect(()=>deleteCreationSession('chat-xintai')).toThrow();
 expect(useStudio.getState().creationSessions).toHaveLength(2);
 useStudio.getState().archiveWorkspace('xintai');
 useStudio.setState({activeWorkspaceId:'xintai'});
 expect(()=>deleteCreationSession('chat-xintai')).toThrow();
 expect(useStudio.getState().creationSessions).toHaveLength(2);
});
