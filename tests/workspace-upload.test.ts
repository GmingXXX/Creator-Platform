import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {captureKnowledgeTarget} from '../src/domain/workspace-knowledge';
import {importWorkspaceFile} from '../src/domain/workspace-upload';
import type {Asset} from '../src/domain/types';

const upload=vi.hoisted(()=>({importFile:vi.fn()}));
vi.mock('../src/domain/upload',async original=>({...await original<object>(),importFile:upload.importFile}));
const file=new File(['客户案例'],'客户案例.txt',{type:'text/plain'});
const imported:Asset={id:'uploaded-doc',name:file.name,kind:'document',src:'idb:doc',preview:'',description:'',tags:[],author:'纪鸣',createdAt:'',source:'uploaded'};
beforeEach(()=>{useStudio.setState(createInitialData());upload.importFile.mockReset();upload.importFile.mockResolvedValue(imported);});
function reader(){const state=useStudio.getState(),member=state.inviteWorkspaceMember('xintai','reader','viewer');state.acceptWorkspaceInvitation('xintai',member.id);return member;}
function bind(){useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'acp-xintai',fieldName:'信泰知识本地场'});}
function deferred(){let finish!:(asset:Asset)=>void;upload.importFile.mockImplementation(()=>new Promise<Asset>(resolve=>{finish=resolve}));return {finish:(asset:Asset)=>finish(asset)};}

describe('workspace upload routing snapshots',()=>{
 it('captures the original bound field before reading, even when workspace and binding change',async()=>{
  bind();const pending=deferred(),task=importWorkspaceFile(file,'xintai');
  useStudio.getState().setWorkspace('dongguan');useStudio.getState().bindWorkspaceKnowledge('xintai',{fieldId:'acp-new',fieldName:'新知识本地场'});
  pending.finish(imported);const result=await task;
  expect(result.workspaceId).toBe('xintai');expect(result.knowledgeTarget).toEqual({workspaceId:'xintai',fieldId:'acp-xintai',fieldName:'信泰知识本地场',bindingRevision:1,state:'not-connected'});
  expect(upload.importFile).toHaveBeenCalledOnce();expect(useStudio.getState().assets.some(asset=>asset.id===imported.id)).toBe(false);
 });
 it('keeps personal uploads independent from the active bound project',async()=>{
  bind();useStudio.getState().setWorkspace('xintai');const result=await importWorkspaceFile(file,'personal');
  expect(result.knowledgeTarget).toEqual({workspaceId:'personal',state:'personal'});expect(result.workspaceId).toBe('personal');
 });
 it('captures the personal binding even when a different project is currently selected',async()=>{
  bind();useStudio.getState().bindWorkspaceKnowledge('personal',{fieldId:'personal-field',fieldName:'个人知识本地场'});
  useStudio.getState().setWorkspace('xintai');const result=await importWorkspaceFile(file,'personal');
  expect(result.knowledgeTarget).toMatchObject({workspaceId:'personal',fieldId:'personal-field',fieldName:'个人知识本地场',bindingRevision:1,state:'not-connected'});
 });
 it('records an unbound project without inventing an ACP destination',async()=>{
  const result=await importWorkspaceFile(file,'dongguan');expect(result.knowledgeTarget).toEqual({workspaceId:'dongguan',state:'unbound'});
 });
 it('uses one captured batch target after binding removal, and copies caller objects before awaiting',async()=>{
  bind();const target={...captureKnowledgeTarget(useStudio.getState(),'xintai')};useStudio.getState().unbindWorkspaceKnowledge('xintai');
  const pending=deferred(),task=importWorkspaceFile(file,'xintai',target);target.fieldId='changed-by-caller';pending.finish(imported);
  expect((await task).knowledgeTarget?.fieldId).toBe('acp-xintai');
 });
 it('rejects a target from another workspace before file reading',async()=>{
  await expect(importWorkspaceFile(file,'xintai',captureKnowledgeTarget(useStudio.getState(),'dongguan'))).rejects.toThrow('归属');expect(upload.importFile).not.toHaveBeenCalled();
 });
 it('blocks viewers before reading and checks originating permission after reading',async()=>{
  const member=reader();useStudio.getState().setWorkspaceActor('xintai',member.id);
  await expect(importWorkspaceFile(file,'xintai')).rejects.toThrow('权限');expect(upload.importFile).not.toHaveBeenCalled();
  useStudio.getState().setWorkspaceActor('xintai','self');const pending=deferred(),task=importWorkspaceFile(file,'xintai');useStudio.getState().setWorkspaceActor('xintai',member.id);pending.finish(imported);
  await expect(task).rejects.toThrow('权限');
 });
 it('propagates a file parsing failure without claiming a saved upload',async()=>{
  upload.importFile.mockRejectedValue(new Error('文件读取失败'));await expect(importWorkspaceFile(file,'personal')).rejects.toThrow('文件读取失败');
 });
});
