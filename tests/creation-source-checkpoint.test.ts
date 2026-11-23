import {expect,it} from 'vitest';
import type {Asset} from '../src/domain/types';
import {checkpointSources,restoreCheckpointSources} from '../src/features/studios/creation-source-checkpoint';
const asset:Asset={id:'doc',name:'补充.txt',kind:'document',workspaceId:'personal',source:'uploaded',src:'idb:large-document',description:'',tags:[],author:'',createdAt:''};
it('保存资料引用及有界正文，不复制素材blob或src',()=>{const result=checkpointSources([{asset,text:'补充事实',status:'已解析'}]);expect(result).toEqual([{assetId:'doc',text:'补充事实',status:'已解析'}]);expect(JSON.stringify(result)).not.toContain('idb:');expect(checkpointSources([{asset,text:'字'.repeat(25000),status:'已解析'}])[0].text.length).toBe(24000);});
it('恢复使用当前资产并排除已删除、禁用AI和其他项目资料',()=>{const saved=checkpointSources([{asset,text:'补充事实',status:'已解析'}]);expect(restoreCheckpointSources(saved,[asset],'personal')).toEqual([{asset,text:'补充事实',status:'已解析'}]);for(const changed of [{...asset,deletedAt:'now'},{...asset,workspaceId:'foreign'},{...asset,metadata:{business:{allowAi:false,note:'',subject:'',confirmed:true,usage:'reference' as const}}}])expect(restoreCheckpointSources(saved,[changed],'personal')).toEqual([]);});
it('损坏资料条目忽略，空列表保留用户移除资料的决定',()=>{expect(restoreCheckpointSources([{assetId:'doc',text:12},null], [asset],'personal')).toEqual([]);expect(restoreCheckpointSources([], [asset],'personal')).toEqual([]);});
