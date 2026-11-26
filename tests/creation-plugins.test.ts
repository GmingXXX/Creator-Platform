import {beforeEach,expect,it} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {initialAdminData,useAdminManagement} from '../src/domain/admin-management';
import {availableCreationPlugins,pluginEditorPath,setDailyTaskLimit,setDefaultCreationModel,setPluginScope,setPlatformPlugin,setSpacePlugin,useCreationConfig} from '../src/domain/creation-plugins';

beforeEach(()=>{
 useAdminManagement.setState(initialAdminData());
 useCreationConfig.setState({platform:{},spaces:{},allowedSpaces:{},dailyTaskLimit:0,defaultModel:'deepseek-flash'});
 useStudio.setState(createInitialData());
});
it('limits configuration to authorized actors and keeps platform restrictions above space choices',()=>{
 const state=useStudio.getState();
 expect(()=>setPlatformPlugin('creator','story',false)).toThrow('权限');
 setSpacePlugin(state,'personal','story',false);
 expect(availableCreationPlugins('personal').map(p=>p.id)).not.toContain('story');
 expect(availableCreationPlugins('xintai').map(p=>p.id)).toContain('story');
 setPlatformPlugin('reviewer','story',false);
 expect(()=>setSpacePlugin(state,'personal','story',true)).toThrow('平台');
 expect(pluginEditorPath('story','existing')).toBe('/dream/existing');
});
it('dispatches a chosen creation plugin, preserves the draft on a denied invocation, and allows standalone assets',()=>{
 const state=useStudio.getState();
 state.updateDraft({text:'自然史展厅'});
 setPlatformPlugin('reviewer','presentation',false);
 expect(state.startRun('presentation')).toBeUndefined();
 expect(useStudio.getState().creationError).toContain('智能演示');
 setPlatformPlugin('reviewer','presentation',true);
 expect(state.startRun('presentation')).toMatchObject({outputKind:'presentation',creationPluginId:'presentation'});
 state.updateDraft({text:'生成一张未来城市海报'});
 expect(state.startRun()?.outputKind).toBe('image');
});

it('launches a session review without consuming a separate home draft and pins the selected kind',()=>{
 const state=useStudio.getState(),active=state.drafts.find(d=>d.id===state.activeDraftId)!;
 const session={...active,id:'session-draft',text:'制作一个展项',model:'demo'};
 const before=useStudio.getState().drafts;
 const run=state.startRun('presentation',session)!;
 expect(run).toMatchObject({status:'waiting',step:1,studioReview:true});
 expect(useStudio.getState().drafts).toBe(before);
 state.updateRun(run.id,{outputKind:'story'});
 expect(useStudio.getState().runs.find(r=>r.id===run.id)?.outputKind).toBe('presentation');
 const exhibit=state.startRun('exhibit',session)!;
 expect(exhibit.aiPlan?.mode).toBe('create');
 const plan={...exhibit.aiPlan!,title:'已确认的标题'};
 state.updateRun(exhibit.id,{structureConfirmed:true,aiPlan:plan,status:'running'});
 state.completeRun(exhibit.id);
 expect(useStudio.getState().works.some(work=>work.title===plan.title)).toBe(true);
 expect(state.startRun('story',session)?.studioReview).toBe(true);
});

it('uses a requested standalone asset even when the session also discusses a project',()=>{
 const state=useStudio.getState(),draft={...state.drafts[0],text:'展示方案',model:'demo'};
 expect(state.startRun(undefined,draft,'image')).toMatchObject({outputKind:'image',status:'running'});
 expect(state.startRun('story',draft,'image')).toBeUndefined();
});

it('uses administrator scope, per-space limits, and the selected default for new drafts',()=>{
 const state=useStudio.getState();
 setPluginScope('reviewer','story',['personal'],state.workspaces);
 expect(availableCreationPlugins('personal').map(p=>p.id)).toContain('story');
 expect(availableCreationPlugins('xintai').map(p=>p.id)).not.toContain('story');
 expect(()=>setSpacePlugin(state,'xintai','story',true)).toThrow('平台');
 setDefaultCreationModel('reviewer','demo');
 expect(state.newDraft().model).toBe('demo');
 setDailyTaskLimit('reviewer',1);
 const draft={...state.drafts[0],model:'demo',text:'生成图片',workspaceId:'personal'};
 expect(state.startRun(undefined,draft,'image')).toBeTruthy();
 expect(state.startRun(undefined,draft,'image')).toBeUndefined();
 expect(useStudio.getState().creationError).toContain('上限');
});
