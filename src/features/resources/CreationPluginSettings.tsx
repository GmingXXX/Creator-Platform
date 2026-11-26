import {useState} from 'react';
import {Badge,Button,Modal,toast} from '../../components/ui';
import {aiRequest,type AIConfig} from '../../domain/ai-client';
import {canAdmin} from '../../domain/admin-management';
import {creationPlugins,platformOffersPlugin,setDailyTaskLimit,setPluginScope,setDefaultCreationModel,setPlatformPlugin,setSpacePlugin,textModels,useCreationConfig,type CreationPluginId} from '../../domain/creation-plugins';
import {useStudio} from '../../domain/store';
import {workspaceCanEdit,workspaceRole} from '../../domain/workspace-management';

function apply(action:()=>void){
 try{action();toast('设置已保存');return true;}catch(error){toast(error instanceof Error?error.message:'设置未保存',true);return false;}
}
export function CreationPluginSettings(){
 const studio=useStudio(),config=useCreationConfig();
 const [section,setSection]=useState<'plugins'|'models'>(canAdmin(studio.role,'plugins')?'plugins':'models');
 const [pending,setPending]=useState<CreationPluginId>(),[status,setStatus]=useState(''),[testing,setTesting]=useState(false);
 const [scopeId,setScopeId]=useState<CreationPluginId>(),[selectedSpaces,setSelectedSpaces]=useState<string[]|undefined>(),[limit,setLimit]=useState(String(config.dailyTaskLimit));
 const spaces=studio.workspaces.filter(space=>!space.deletedAt&&!space.purgedAt);
 const plugin=creationPlugins.find(p=>p.id===pending);
 const refresh=async()=>{
  setTesting(true);
  try{
   const result=await aiRequest<AIConfig>('config');
   if(!result.configured)throw new Error('未取得模型服务状态，请检查本地服务。');
   const labels:Record<string,string>={deepseek:'文本',image:'图片',video:'视频',speech:'语音'};
   setStatus(Object.entries(result.configured).map(([id,ok])=>(labels[id]||id)+(ok?'已配置':'待配置')).join(' · '));
  }catch(error){setStatus(error instanceof Error?error.message:'模型服务不可用');}finally{setTesting(false);}
 };
 return <div className="creation-plugin-settings">
  <nav aria-label="平台配置分类">{(['plugins','models'] as const).map(sectionId=><Button key={sectionId} disabled={!canAdmin(studio.role,sectionId)} variant={section===sectionId?'primary':'secondary'} onClick={()=>setSection(sectionId)}>{sectionId==='plugins'?'创作插件':'模型服务'}</Button>)}</nav>
  {section==='plugins'&&canAdmin(studio.role,'plugins')&&creationPlugins.map(item=><article key={item.id}><div><strong>{item.name}</strong><Badge tone={config.platform[item.id]===false?'neutral':'green'}>{config.platform[item.id]===false?'已停用':'已启用'}</Badge><p>{item.description}</p><div className="admin-plugin-facts"><span>开放范围<strong>{config.allowedSpaces[item.id]===undefined?'全部空间':config.allowedSpaces[item.id]!.length+' 个空间'}</strong></span><span>服务<strong>{item.services.join('、')}</strong></span><span>已有作品<strong>{studio.works.filter(w=>w.kind===item.id&&!w.deletedAt).length} 件</strong></span><small>v{item.version}</small></div></div><div><Button variant="secondary" onClick={()=>{setScopeId(item.id);setSelectedSpaces(config.allowedSpaces[item.id]);}}>设置开放空间</Button><Button variant="secondary" onClick={()=>config.platform[item.id]===false?apply(()=>setPlatformPlugin(studio.role,item.id,true)):setPending(item.id)}>{config.platform[item.id]===false?'启用':'停用'}{item.name}</Button></div></article>)}
  {section==='models'&&canAdmin(studio.role,'models')&&<>
   <article className="admin-model-row"><div><label htmlFor="admin-default-model">默认创作模型</label><p>用于新建的创作草稿。</p></div><select id="admin-default-model" aria-label="默认创作模型" value={config.defaultModel} onChange={e=>apply(()=>setDefaultCreationModel(studio.role,e.target.value))}>{textModels.map(model=><option key={model.id} value={model.id}>{model.label}</option>)}</select></article>
   <article className="admin-model-row"><div><label htmlFor="admin-daily-limit">每空间每日 Agent 创作任务上限</label><p>按本机创建的任务次数计算，填 0 表示不限。</p></div><div><input id="admin-daily-limit" type="number" min={0} max={10000} value={limit} onChange={e=>setLimit(e.target.value)}/><Button size="sm" disabled={!limit||Number(limit)===config.dailyTaskLimit} onClick={()=>apply(()=>setDailyTaskLimit(studio.role,Number(limit)))}>保存限额</Button></div></article>
   <article className="admin-model-row"><div><strong>模型服务连接</strong><p>查看文本、图片、视频与语音服务的配置状态。</p>{status&&<small role="status">{status}</small>}</div><Button variant="secondary" disabled={testing} onClick={refresh}>{testing?'正在读取…':'查看服务配置状态'}</Button></article>
  </>}
  <Modal open={!!scopeId} title="设置开放空间" onClose={()=>setScopeId(undefined)} footer={<Button variant="primary" onClick={()=>{if(scopeId&&apply(()=>setPluginScope(studio.role,scopeId,selectedSpaces,spaces)))setScopeId(undefined);}}>保存范围</Button>}>
   <div className="res-form"><label><input type="checkbox" checked={selectedSpaces===undefined} onChange={e=>setSelectedSpaces(e.target.checked?undefined:spaces.map(space=>space.id))}/> 全部空间（含未来新建空间）</label>{selectedSpaces&&spaces.map(space=><label key={space.id}><input type="checkbox" checked={selectedSpaces.includes(space.id)} onChange={e=>setSelectedSpaces(e.target.checked?[...selectedSpaces,space.id]:selectedSpaces.filter(id=>id!==space.id))}/>{space.name}</label>)}</div>
  </Modal>
  <Modal open={!!plugin} title={'停用'+(plugin?.name||'')} onClose={()=>setPending(undefined)} footer={<Button variant="danger" onClick={()=>{if(plugin&&apply(()=>setPlatformPlugin(studio.role,plugin.id,false)))setPending(undefined);}}>确认停用</Button>}><p>目前有 {studio.runs.filter(run=>run.outputKind===pending&&['running','waiting'].includes(run.status)).length} 个进行中的任务。所有空间将停止发起此类新任务。已生成的作品仍可打开和预览，已提交的任务可继续完成。</p></Modal>
 </div>;
}
export function SpacePluginSettings({workspaceId}:{workspaceId:string}){
 const studio=useStudio(),config=useCreationConfig();
 const owner=workspaceRole(studio,workspaceId)==='owner'&&workspaceCanEdit(studio,workspaceId);
 return <section className="creation-plugin-settings"><h4>空间创作工具</h4><p>{creationPlugins.some(item=>platformOffersPlugin(item.id,workspaceId,config))?'负责人可以选择当前空间开放的创作工具。':'平台暂未向本空间开放创作工具。'}</p>{creationPlugins.filter(item=>platformOffersPlugin(item.id,workspaceId,config)).map(item=><article key={item.id}><div><strong>{item.name}</strong><p>{config.platform[item.id]===false?'平台已停用':item.capabilities}</p></div><label><input type="checkbox" aria-label={'启用'+item.name} checked={config.platform[item.id]!==false&&config.spaces[workspaceId]?.[item.id]!==false} disabled={!owner||config.platform[item.id]===false} onChange={e=>apply(()=>setSpacePlugin(studio,workspaceId,item.id,e.target.checked))}/> 启用</label></article>)}</section>;
}
