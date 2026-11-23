import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createSceneWork} from '../src/domain/scenes';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {buildLocalExperience,parseExperienceSections,organizeExperience,editExperience,createExperienceSkill,experienceFingerprint,isExperienceRequest} from '../src/domain/creation-experience';
vi.mock('../src/domain/ai-client',()=>({aiChat:vi.fn()}));
import {aiChat} from '../src/domain/ai-client';
const sample=()=>({...createSceneWork({title:'手工历程',type:'时间演进型',width:1920,height:1080}),workspaceId:'personal',aiModel:'demo'});
const sections={overview:'当前作品使用时间轴。',references:'无参考来源。',changes:'暂无过程记录。',lessons:'可将阶段总览作为候选方法。',limitations:'现场效果未验证。'};
function insert(){const work=sample();useStudio.setState(s=>({works:[work,...s.works]}));return work;}
describe('creation experience',()=>{
 beforeEach(()=>{useStudio.setState(createInitialData());vi.mocked(aiChat).mockReset()});
 it('summarizes manually authored work without inventing reasons or successful research',()=>{
  const work=sample(),result=buildLocalExperience(work,[],{scope:'work'});
  expect(result.overview).toContain('手工历程');expect(result.changes).toContain('没有可核对的');expect(result.limitations).toContain('未验证');expect(work.experience).toBeUndefined();
 });
 it('validates selected scope and model output instead of accepting arbitrary payloads',()=>{
  expect(()=>buildLocalExperience(sample(),[],{scope:'node',pageId:'missing',nodeId:'bad'})).toThrow();
  for(const bad of [null,{}, {...sections,html:'<script>'},{...sections,lessons:[]},{...sections,overview:'x'.repeat(5001)}])expect(()=>parseExperienceSections(bad)).toThrow();
  expect(parseExperienceSections(sections)).toEqual(sections);
 });
 it('stores a summary without altering canvas revision or creating an asset',async()=>{
  const work=insert(),assets=useStudio.getState().assets.length;
  const next=await organizeExperience(work.id,{model:'demo'});
  expect(next.revision).toBe(work.revision);expect(next.pages).toEqual(work.pages);expect(next.experience?.mode).toBe('local');expect(useStudio.getState().assets).toHaveLength(assets);expect(aiChat).not.toHaveBeenCalled();
 });
 it('updates one summary, preserves human corrections and retains version history',async()=>{
  const work=insert();await organizeExperience(work.id,{model:'demo'});
  const edited=editExperience(work.id,{...useStudio.getState().works.find(w=>w.id===work.id)!.experience!.sections,lessons:'人工确认的阶段组织方法'});
  const changed={...edited,title:'人工修改后的标题'};useStudio.getState().saveWork(changed);
  const latest=await organizeExperience(work.id,{model:'demo'});
  expect(latest.experience?.id).toBe(edited.experience?.id);expect(latest.experience?.sections.lessons).toBe('人工确认的阶段组织方法');expect(latest.experience?.sections.overview).toContain('人工修改后的标题');expect(latest.experience?.history.length).toBeGreaterThan(0);
 });
 it('records exact scope labels and preserves them in history after page renaming',async()=>{
  const work=insert(),page=work.pages[0],target={scope:'page' as const,pageId:page.id};
  const first=await organizeExperience(work.id,{model:'demo',target});
  expect(first.experience?.targetLabel).toBe(`页面 · ${page.name}`);
  useStudio.getState().saveWork({...first,pages:first.pages.map(p=>({...p,name:'新页面名称'}))});
  const second=await organizeExperience(work.id,{model:'demo'});
  expect(second.experience?.targetLabel).toBe('整个作品');
  expect(second.experience?.history[0].targetLabel).toBe(`页面 · ${page.name}`);
  expect(second.experience?.history[0].target).toEqual(target);
 });
 it('rejects stale results after manual edits and does not fall back to fake success',async()=>{
  const work=insert();vi.mocked(aiChat).mockImplementation(async()=>{useStudio.getState().saveWork({...work,title:'稍后的手动修改'});return {content:JSON.stringify(sections),model:'deepseek-flash'}});
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('已改变');expect(useStudio.getState().works.find(w=>w.id===work.id)?.experience).toBeUndefined();
  vi.mocked(aiChat).mockResolvedValue({content:'invalid',model:'deepseek-flash'});
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('格式');
 });
 it('rejects cancellation even when model transport resolves',async()=>{
  const work=insert(),controller=new AbortController();vi.mocked(aiChat).mockImplementation(async()=>{controller.abort();return {content:JSON.stringify(sections),model:'deepseek-flash'}});
  await expect(organizeExperience(work.id,{model:'deepseek-flash',signal:controller.signal})).rejects.toThrow('取消');
 });
 it('keeps user edits made while model runs instead of overwriting them',async()=>{
  const work=insert();await organizeExperience(work.id,{model:'demo'});
  vi.mocked(aiChat).mockImplementation(async()=>{editExperience(work.id,{...sections,lessons:'整理中补充的结论'});return {content:JSON.stringify(sections),model:'deepseek-flash'}});
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('已改变');expect(useStudio.getState().works.find(w=>w.id===work.id)?.experience?.sections.lessons).toBe('整理中补充的结论');
 });
 it('builds a private disabled skill draft, never publishes or overwrites existing skills',async()=>{
  const work=insert();const next=await organizeExperience(work.id,{model:'demo'});
  const skill=createExperienceSkill(next,'历程制作方法',sections.lessons,'已确认事件资料','按阶段整理\n预览检查');
  expect(skill.public).toBe(false);expect(skill.enabled).toBe(false);expect(skill.personal).toBe(true);expect(skill.steps).toHaveLength(2);
  expect(()=>createExperienceSkill(next,'','方法','资料','步骤')).toThrow();
 });
 it('fingerprint detects manual visual edits while summary metadata alone does not change it',async()=>{
  const work=insert(),fingerprint=experienceFingerprint(work);const next=await organizeExperience(work.id,{model:'demo'});expect(experienceFingerprint(next)).toBe(fingerprint);
  expect(experienceFingerprint({...next,width:1080})).not.toBe(fingerprint);
 });
 it('routes explicit experience requests but does not hijack editing requests',()=>{
  expect(isExperienceRequest('整理制作经验')).toBe(true);expect(isExperienceRequest('只整理这次交互调整的经验')).toBe(true);expect(isExperienceRequest('把标题改成制作经验')).toBe(false);
 });
 it('records observable manual changes against the previous summary without claiming outcomes',async()=>{
  const work=insert();await organizeExperience(work.id,{model:'demo'});
  const first=useStudio.getState().works.find(w=>w.id===work.id)!;
  useStudio.getState().saveWork({...first,title:'新的手工标题',width:1080,pages:first.pages.map(page=>({...page,nodes:page.nodes.map(node=>({...node,fontSize:32,content:'人工文字'}))}))});
  const next=await organizeExperience(work.id,{model:'demo'});
  expect(next.experience?.sections.changes).toContain('新的手工标题');expect(next.experience?.sections.changes).toContain('字号');expect(next.experience?.sections.changes).toContain('不推断');
 });
 it('supports page, node, story and shot scopes and rejects missing selections',()=>{
  const work=sample(),page=work.pages[0];expect(buildLocalExperience(work,[],{scope:'page',pageId:page.id}).overview).toContain('当前选中');
  expect(buildLocalExperience(work,[],{scope:'node',pageId:page.id,nodeId:page.nodes[0].id}).overview).toContain('1 个组件');
  const story={...work,kind:'story' as const,storyNodes:[{id:'n',type:'scene',x:0,y:0,title:'节点',text:'剧情'}],storyEdges:[]};
  expect(buildLocalExperience(story,[],{scope:'node',pageId:'@story',nodeId:'n'}).overview).toContain('1 个故事节点');
  const video={...work,kind:'video' as const,shots:[{id:'s',title:'分镜',narration:'讲述',duration:10,src:''}]};
  expect(buildLocalExperience(video,[],{scope:'node',pageId:'@shots',nodeId:'s'}).overview).toContain('1 个分镜');
  for(const target of [{scope:'node' as const,pageId:page.id,nodeId:'missing'},{scope:'node' as const,pageId:'@story',nodeId:'missing'},{scope:'node' as const,pageId:'@shots',nodeId:'missing'}])expect(()=>buildLocalExperience(work,[],target)).toThrow();
 });
 it('syncs an explicitly linked private media package but does not expose private summaries through public or foreign assets',async()=>{
  const work=insert(),state=useStudio.getState(),base=state.assets.find(a=>a.package)!;
  const media={...base,id:'linked-media',kind:'image' as const,workspaceId:'personal',public:false,package:{...base.package!,params:{experienceWorkId:work.id}}};
  useStudio.setState(s=>({assets:[media,{...media,id:'public-media',public:true},{...media,id:'foreign-media',workspaceId:'foreign'},...s.assets]}));
  await organizeExperience(work.id,{model:'demo'});
  expect(useStudio.getState().assets.find(a=>a.id==='linked-media')?.package?.experience).toBeDefined();
  expect(useStudio.getState().assets.find(a=>a.id==='public-media')?.package?.experience).toBeUndefined();
  expect(useStudio.getState().assets.find(a=>a.id==='foreign-media')?.package?.experience).toBeUndefined();
 });
 it('rechecks workspace permissions after a model request and does not redirect the result when spaces change',async()=>{
  const state=useStudio.getState(),space=state.createWorkspace({name:'经验权限'}),work=state.createWork({workspaceId:space.id,title:'空间作品',type:'时间演进型',width:1920,height:1080});
  const member=state.inviteWorkspaceMember(space.id,'reader','viewer');state.acceptWorkspaceInvitation(space.id,member.id);
  vi.mocked(aiChat).mockImplementation(async()=>{state.setWorkspaceActor(space.id,member.id);state.setWorkspace('personal');return {content:JSON.stringify(sections),model:'deepseek-flash'}});
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('只读');
  expect(useStudio.getState().works.find(w=>w.id===work.id)?.experience).toBeUndefined();
  await expect(organizeExperience(work.id,{model:'demo'})).rejects.toThrow('只读');
 });
 it('uses successful model output, rejects unsupported model and oversized context, and checks edit versions',async()=>{
  const work=insert();vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(sections),model:'deepseek-flash'});
  const updated=await organizeExperience(work.id,{model:'deepseek-flash'});expect(updated.experience?.sections.overview).toBe(sections.overview);expect(updated.experience?.sections.references).toContain('未记录展项参考来源');expect(updated.experience?.mode).toBe('model');
  expect(()=>editExperience(work.id,sections,0)).toThrow('后续修改');
  await expect(organizeExperience(work.id,{model:'unsupported'})).rejects.toThrow('请选择');
  const big={...updated,pages:updated.pages.map(p=>({...p,nodes:p.nodes.map(n=>({...n,content:'很多内容'.repeat(10000)}))}))};useStudio.setState(s=>({works:s.works.map(w=>w.id===big.id?big:w)}));
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('内容较多');
 });
 it('includes explicit modification history without rewriting unsupported or reverted actions as successful changes',()=>{
  const work=sample();const turns=[{id:'t',workId:work.id,prompt:'按业务阶段分组',target:{scope:'work' as const},status:'applied' as const,summary:'已调整条目',createdAt:'2026-11-17'}];
  expect(buildLocalExperience(work,turns,{scope:'work'}).changes).toContain('按业务阶段分组');
  expect(buildLocalExperience(work,[{...turns[0],status:'reverted'}],{scope:'work'}).changes).toContain('没有可核对的');
 });

 it('editing a summary does not falsely mark a newer canvas version as already analyzed',async()=>{
  const work=insert(),initial=await organizeExperience(work.id,{model:'demo'}),record=initial.experience!;
  useStudio.getState().saveWork({...initial,title:'稍后改变的作品'});
  const edited=editExperience(work.id,{...record.sections,lessons:'我补充的方法'});
  expect(edited.experience?.workRevision).toBe(record.workRevision);expect(edited.experience?.sourceFingerprint).toBe(record.sourceFingerprint);
  expect(edited.experience?.sourceFingerprint).not.toBe(experienceFingerprint(edited));expect(edited.experience?.observation).toEqual(record.observation);
 });

 it('does not send media URLs, HTML source or tool parameters to the summary model',async()=>{
  const work=insert(),secret='https://private.example/media?signature=secret-token';
  const html={...work.pages[0].nodes[0],id:'html-private',type:'html' as const,name:'交互程序',content:'<script>window.exfiltrate("secret-code")</script>',src:secret,commands:[{id:'cmd',phrase:'口令',aliases:'',action:'private-tool-secret',targetId:'private-target',enabled:true,scope:'global' as const}]};
  const latest={...work,cover:secret,pages:work.pages.map(page=>({...page,backgroundImage:secret,nodes:[...page.nodes,html]})),shots:[{id:'shot',title:'分镜',narration:'讲述',duration:3,src:secret}],storyNodes:[{id:'story',type:'scene',x:0,y:0,title:'节点',text:'剧情',media:secret}]};
  useStudio.setState(s=>({works:s.works.map(w=>w.id===work.id?latest:w)}));
  vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(sections),model:'deepseek-flash'});
  await organizeExperience(work.id,{model:'deepseek-flash'});
  const messages=vi.mocked(aiChat).mock.calls[0][1],text=messages.map(m=>m.content).join('');
  for(const forbidden of [secret,'signature','secret-code','<script>','private-tool-secret','private-target','"src"','"media"','"backgroundImage"'])expect(text).not.toContain(forbidden);
  expect(text).toContain('交互程序');expect(text).toContain('讲述');
 });
 it('rejects AI-disabled dependencies before any model call but allows explicit local organization',async()=>{
  const work=insert(),state=useStudio.getState(),asset={...state.assets[0],id:'no-ai-image',kind:'image' as const,workspaceId:'personal',public:false,src:'/media/no-ai.png',package:undefined,metadata:{business:{note:'不允许AI',subject:'客户',confirmed:true,usage:'project' as const,allowAi:false}}};
  const latest={...work,pages:work.pages.map(page=>({...page,backgroundAssetId:asset.id,backgroundImage:asset.src}))};
  useStudio.setState(s=>({assets:[asset,...s.assets],works:s.works.map(w=>w.id===work.id?latest:w)}));
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('素材依赖');expect(aiChat).not.toHaveBeenCalled();
  const local=await organizeExperience(work.id,{model:'demo'});expect(local.experience?.mode).toBe('local');expect(aiChat).not.toHaveBeenCalled();
 });
 it('rejects a late model result when an asset AI allowance is revoked',async()=>{
  const work=insert(),state=useStudio.getState(),asset={...state.assets[0],id:'revoked-image',kind:'image' as const,workspaceId:'personal',public:false,src:'/media/revoked.png',package:undefined,metadata:{business:{note:'本客户图片',subject:'客户',confirmed:true,usage:'project' as const,allowAi:true}}};
  const latest={...work,pages:work.pages.map(page=>({...page,backgroundAssetId:asset.id,backgroundImage:asset.src}))};
  useStudio.setState(s=>({assets:[asset,...s.assets],works:s.works.map(w=>w.id===work.id?latest:w)}));
  vi.mocked(aiChat).mockImplementation(async()=>{useStudio.setState(s=>({assets:s.assets.map(a=>a.id===asset.id?{...asset,metadata:{business:{...asset.metadata.business,allowAi:false}}}:a)}));return {content:JSON.stringify(sections),model:'deepseek-flash'}});
  await expect(organizeExperience(work.id,{model:'deepseek-flash'})).rejects.toThrow('素材依赖');expect(useStudio.getState().works.find(w=>w.id===work.id)?.experience).toBeUndefined();
 });

});
