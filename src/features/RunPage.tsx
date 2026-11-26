import {startRelatedOutput,retrySession} from '../domain/creation-session';
import {SessionHistory,SessionInput,useSessionTasks} from './creation/SessionChat';
import {RunProgress, type RunActivity} from './creation/RunProgress';
import {KnowledgeSourceSummary} from './creation/KnowledgeSourceSummary';
import {RecoverExhibitActions} from './creation/RecoverExhibitActions';
import {ResultWorkActions} from './creation/ResultWorkActions';
import {BackgroundComposer} from './creation/BackgroundComposer';
import {ContextualExhibitPreview} from './creation/ContextualExhibitPreview';
import {exhibitBackgroundPage,tryWorkBackgroundRequest} from '../domain/work-background-request';
import {applyBackground,beginWorkBackground} from '../domain/background-generation';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, FileText, ImagePlus, Layers, MoreHorizontal, PackageCheck, RotateCcw, Sparkles, StopCircle } from 'lucide-react';
import { useStudio } from '../domain/store';
import type { Asset, EditTarget } from '../domain/types';
import { useMedia } from '../domain/upload';
import { Artwork } from '../components/Artwork';
import { Button, Badge, EmptyState, Menu, Modal, toast, useDocumentTitle } from '../components/ui';
import { workRoute } from './AppShell';
import { CurrentWorkPreview } from './conversation/CurrentWorkPreview';
import { WorkConversation } from './conversation/WorkConversation';
import {AssetPreview} from './resources/Shared';
import { MaterialWorkPreview } from './resources/MaterialWorkPreview';
import { navigateInWorkspace } from './workspace/output-navigation';
import { getBackgroundCandidates, nativeComponentForPrompt, resumeRunPatch, runPauseCopy, retryRunPatch, realOutputDescription } from '../domain/generation-resource';
import { describeAssetSource, getAssetMetadata } from '../domain/asset-metadata';
import { requestedSubject } from '../domain/asset-retrieval';
import { MaterialPicker } from './resources/MaterialPicker';
import '../styles/run-resources.css';
import {PresentationViewer} from './studios/PresentationViewer';
import {StoryExperience} from './studios/StoryPreview';
import {RunStudioReview} from './creation/RunStudioReview';
import {ExhibitPlanReview} from './creation/ExhibitPlanReview';
import {stopInactiveAI} from '../domain/ai-run';

export default function RunPage() {
  const { id } = useParams(), state = useStudio(), navigate = useNavigate();
  const session=state.creationSessions?.find(item=>item.id===id);
  const run = state.runs.find(item => item.id === (session?.runId||id));
  useSessionTasks(session,run);
  const [pane,setPane]=useState<'chat'|'preview'>('chat');
  const switchPane=<button className="session-mobile-toggle" onClick={()=>setPane(pane==='chat'?'preview':'chat')}>{pane==='chat'?'查看预览':'返回对话'}</button>;
  const [expanded, setExpanded] = useState(false);
  const [generationOpen,setGenerationOpen]=useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidatePreview, setCandidatePreview] = useState<Asset>();
  const [target, setTarget] = useState<EditTarget>({ scope: 'work' });
  const [activityState, setActivityState] = useState<{id: string; value: RunActivity}>();
  const reportActivity = useCallback((value?: RunActivity) => {
    if (!id) return;
    setActivityState(previous => value ? {id, value} : previous?.id === id ? undefined : previous);
  }, [id]);
  const activity = activityState?.id === id ? activityState?.value : undefined;
  const asset = state.assets.find(item => item.id === run?.assetId);
  const backgroundAsset = run?.outputKind === 'exhibit' ? state.assets.find(item => item.id === run.backgroundAssetId)||(asset?.kind === 'image'?asset:undefined) : undefined;
  const backgroundUrl = useMedia(backgroundAsset?.src);
  const candidatePreviewUrl = useMedia(candidatePreview?.src);
  useEffect(() => {
    setTarget({ scope: 'work' }); setExpanded(false); setBackgroundOpen(false); setPickerOpen(false); setCandidatePreview(undefined);
  }, [id]);
  useDocumentTitle('智能创作');
  if(session&&!run)return <div className="run-page session-page" data-pane={pane}><header className="run-header"><Button variant="ghost" title="返回首页" onClick={()=>navigate('/')}><ArrowLeft/></Button><div><strong>智能创作</strong><span>{session.draft.model}</span></div>{switchPane}</header><div className="run-layout"><section className="run-conversation"><SessionInput key={session.id} session={session}>{choices=><div className="session-scroll"><SessionHistory session={session} choices={choices}/><KnowledgeSourceSummary assets={state.assets.filter(a=>session.draft.attachmentIds.includes(a.id))}/></div>}</SessionInput></section><section className="run-artifact"><div className="artifact-heading"><span><Layers size={16}/>创作成果</span></div><EmptyState title="方案将在这里呈现" description={session.draft.attachmentIds.length?state.assets.filter(a=>session.draft.attachmentIds.includes(a.id)).map(a=>a.name).join(' · '):'明确观众的体验方式后，可以在这里核对创作方案。'}/></section></div></div>;
  if (!run) return <EmptyState title="未找到这个创作任务" description="可以从首页开始一次新的创作。" action={<Button onClick={() => navigate('/')}>返回首页</Button>} />;
  const sourceWork = state.works.find(item => item.id === run.workId);
  const work = sourceWork?.deletedAt ? undefined : sourceWork;
  const openOutput = (destination: string) => navigateInWorkspace(navigate, sourceWork?.workspaceId ?? asset?.workspaceId ?? run.workspaceId, destination);
  const done = run.status === 'complete';
  const pauseCopy=runPauseCopy(run);
  const pause=()=>{state.updateRun(run.id,{status:'stopped'});stopInactiveAI();};
  const discussing=run.aiPlan?.mode==='discuss';
  const structureReview=run.outputKind==='exhibit'&&run.aiPlan?.mode==='create'&&!run.structureConfirmed;
  const guidedReview=!!run.studioReview||structureReview;
  const choosePlan=(prompt:string)=>state.updateRun(run.id,{prompt,aiPlan:undefined,skillSelections:undefined,status:'running',step:0});
  const mediaProject = work?.kind === 'presentation' || work?.kind === 'video';
  const candidates = run.status === 'waiting' ? getBackgroundCandidates(run, state.assets) : [];
  const needsRealSubject = Boolean(requestedSubject(run.prompt, run.workspaceId || 'personal'));
  const embeddedComponent = run.outputKind === 'component' && !nativeComponentForPrompt(run.prompt);
  const embeddedProgram = embeddedComponent || run.outputKind === 'html';
  const useBackground = (selected: Asset, selection: 'suggested' | 'manual') => {
    const metadata = getAssetMetadata(selected);
    if (!metadata.business.allowAi) throw new Error('这张素材未允许智能体调用，请更换素材或在素材库调整使用范围。');
    if (metadata.business.usage === 'reference') throw new Error('这张素材仅供参考，不能直接作为展项背景，请选择可用于成品的图片。');
    const adopted = state.adoptAsset(selected.id, run.workspaceId || 'personal');
    if (!adopted || adopted.kind !== 'image') throw new Error('这张背景暂不可用，请选择其他图片。');
    const adoptedMetadata = getAssetMetadata(adopted);
    if (!adoptedMetadata.business.allowAi) throw new Error('当前空间中的这份素材副本未允许智能体调用，请更换素材或在素材库调整使用范围。');
    if (adoptedMetadata.business.usage === 'reference') throw new Error('当前空间中的这份素材副本仅供参考，不能直接作为展项背景，请选择可用于成品的图片。');
    if(done)applyBackground(run.id,adopted.id,work?exhibitBackgroundPage(work,run,target.scope==='work'?undefined:target.pageId)?.id:undefined);
    else state.updateRun(run.id, { status:'running', step:3, resourceStrategy:'reuse', backgroundAssetId:adopted.id, backgroundSelection:selection, error:undefined });
    setPickerOpen(false); setCandidatePreview(undefined);
  };
  const useSuggestedBackground = (selected: Asset) => {
    try { useBackground(selected,'suggested'); }
    catch (error) { toast(error instanceof Error ? error.message : '背景暂不可用，请重试',true); }
  };
  const generateBackground = () => setGenerationOpen(true);
  const restart = () => {
    state.newDraft({ workspaceId: run.workspaceId || 'personal', references:structuredClone(run.references||[]), text: run.prompt, styleId: run.styleId, model: run.model, skillIds: [...run.skillIds], attachmentIds: [...run.attachmentIds], reference: run.reference ? structuredClone(run.reference) : undefined });
    navigate('/');
  };
  const continueFromAsset = () => {
    if (!asset) return;
    state.setWorkspace(run.workspaceId || asset.workspaceId || 'personal');
    const draft = useStudio.getState().referenceAsset(asset);
    if (!draft) { toast(useStudio.getState().creationError || '这份素材的创作资料尚不完整，请先在素材库补充', true); return; }
    navigate('/');
  };
  const artifactLabel = embeddedComponent && !run.studioReview ? '交互程序 · 待适配' : { image: '图片素材', component: '可编辑组件', video: '视频工程', html: '交互程序', presentation: '智能演示', story: '互动影片', exhibit: '交互页面' }[work?.kind||run.outputKind];
  return <div className={session?"run-page session-page":"run-page"} data-pane={pane}>
    <header className="run-header">
      <Button variant="ghost" size="icon" title="返回首页" onClick={() => navigate('/')}><ArrowLeft /></Button>
      <div><strong>智能创作</strong><span>{run.model} · {state.systems.find(system => system.id === run.styleId)?.name || '自由创作'}</span></div>
      {session&&switchPane}<Badge tone={done ? 'green' : run.status === 'failed' ? 'red' : 'blue'}>{done ? '创作完成' : run.status === 'waiting' && !activity ? '等待选择' : run.status === 'stopped' ? pauseCopy.status : run.status === 'failed' ? '任务异常' : '正在创作'}</Badge>
      <Menu trigger={<Button variant="ghost" size="icon" aria-label="任务更多操作"><MoreHorizontal /></Button>} items={[
        { label: '演示失败与恢复', disabled: done, onClick: () => state.updateRun(run.id, { status: 'failed', error: '当前步骤暂时没有响应。已保留需求、参考资料与资源选择，可重试继续。' }) },
        { label: '用此需求重新创作', onClick: restart },
      ]} />
    </header>
    <div className="run-layout">
      <section className="run-conversation">
        <div className={session?"session-scroll":undefined}>{session?<SessionHistory session={session}/>:<div className="user-message"><span className="avatar">纪</span><p>{run.prompt}</p></div>}
        <KnowledgeSourceSummary assets={state.assets.filter(asset=>run.attachmentIds.includes(asset.id))}/>
        <div className="assistant-message">
          <span className="assistant-avatar"><Sparkles size={16} /></span>
          <div>
            <h3>{done ? '已完成，可以继续调整。' : '我来帮你把想法变成创作成果。'}</h3>
            {!done && <p>{run.reference ? '我会参考这份创作资料包的制作方法，结合新需求组织内容；沿用已选设计风格，完成后可以继续调整背景。' : '根据需求匹配可用技能与参考资料，保留内容结构；完成后可继续修改页面和素材。'}</p>}
            {!done && embeddedComponent && !run.studioReview && <p className="component-adaptation-note">这类新组件尚未适配原生编辑。先提供交互程序示例，内部功能需要开发接入；画布可调整外层位置与尺寸。</p>}
            {!!run.references?.length&&<p>参考方向：{run.references.map(ref=>`${ref.sourceTitle}（${{interaction:'交互',ui:'UI 风格',content:'内容组织',effect:'局部效果'}[ref.dimension]}）`).join('、')}。{run.styleId&&run.references.some(ref=>ref.dimension==='ui')?'视觉样式以所选创作参考的 UI 风格为主，设计风格仅作未覆盖区域兜底。':''}实际采用范围将在作品中记录。</p>}
            {!!run.skillSelections?.length&&<p>本次使用：{run.skillSelections.map(s=>`${s.name}（${s.mode==='explicit'?'已指定':'自动匹配'}）`).join('、')}</p>}
            {done && <button className="creation-process-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Check size={13} />创作流程已完成<ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></button>}
            {(!done || expanded) && <RunProgress run={run} activity={activity} pausedLabel={pauseCopy.status}/>}
            {run.aiPlan&&<div className="ai-plan-answer"><p style={{whiteSpace:'pre-wrap'}}>{run.aiPlan.answer}</p>{discussing&&run.aiPlan.options?.map((option,i)=><div className="resource-gap" key={i}><strong>{option.title}</strong><p>{option.description}</p><Button onClick={()=>choosePlan(option.prompt)}>按此方案创建</Button></div>)}</div>}
            {run.status === 'waiting' && !discussing && !guidedReview && <div className="resource-gap"><div><ImagePlus size={18} /><strong>{candidates.length ? '找到可供选择的背景' : '暂未找到合适的背景'}</strong></div><p>{candidates.length ? '可以直接继续创建；完成后再生成或更换背景，也可在右侧选择已有图片。' : needsRealSubject ? '还没有找到业务对象已确认的匹配素材。请上传或选择客户确认的图片；生成的概念背景不能替代真实客户素材。' : '当前可用素材中没有匹配结果。可以生成背景，或从素材库自行挑选并上传。'}</p><div>
              <Button variant="primary" size="sm" onClick={()=>state.updateRun(run.id,{resourceStrategy:'reuse',status:'running',step:3})}>继续创建</Button>
              <Button size="sm" onClick={() => setPickerOpen(true)}>自行选择素材</Button>
            </div></div>}
            {run.status === 'failed' && <div className="run-error"><strong>这一步没有完成</strong><p>{run.error}</p>{run.model.startsWith('deepseek-')&&<p>{run.aiImageTaskId?'重新查询只尝试恢复原任务，不会重复提交。若云端任务已经失败，请检查任务记录，再调整需求发起新任务。':'已提交的远端任务可能继续运行。若提示提交结果未知，请先检查任务记录，再决定是否重新创作。'}</p>}<Button size="sm" onClick={() => state.updateRun(run.id, retryRunPatch(run))}><RotateCcw />{pauseCopy.retry}</Button>{run.outputKind === 'exhibit' && run.backgroundAssetId && <Button size="sm" onClick={() => setPickerOpen(true)}>重新选择背景</Button>}</div>}
            {run.status === 'stopped' && <div className="resource-gap"><strong>{pauseCopy.status}</strong><p>{pauseCopy.description}</p><Button size="sm" onClick={() => state.updateRun(run.id, resumeRunPatch(run))}>{pauseCopy.resume}</Button></div>}
            {done && <div className="completion-note"><PackageCheck size={17} /><span>{work ? '已保存到作品库。继续描述修改，我会调整这件作品。' : run.workId ? '作品已移入回收站，恢复后可继续创作。' : '生成结果已保存到你的素材库。'}</span></div>}
            {run.status === 'running' && <Button variant="ghost" size="sm" onClick={pause}><StopCircle />{pauseCopy.pause}</Button>}
          </div>
        </div>
        {session?.error&&done&&work&&<p role="alert">{session.error} <Button size="sm" onClick={()=>retrySession(session.id)}>重试补充要求</Button></p>}
        {!!session?.priorRunIds?.length&&<details><summary>之前的方案和成果</summary>{session.priorRunIds.map(rid=><p key={rid}><button onClick={()=>navigate('/create/'+rid)}>查看{state.runs.find(r=>r.id===rid)?.prompt.split('\n')[0].slice(0,30)||'之前的创作记录'}</button></p>)}</details>}
        </div>
        {session&&!(done&&work)&&<SessionInput key={session.id} session={session} run={run} reviewBusy={!!activity}/>}
        {done && work && (session||work.kind !== 'video' && !embeddedProgram) && <div className="conversation-composer"><WorkConversation key={work.id} draftKey={session?.id} onNewOutput={(value,ids,model)=>{
          const pageId=target.scope==='work'?undefined:target.pageId;
          if(session)return startRelatedOutput(session.id,value,ids,false,pageId,model);
          const page=tryWorkBackgroundRequest(run,work,value,pageId);
          if(!page)return false;
          beginWorkBackground(run.id,value,page.id,ids,model);return true;
        }} work={work} target={target} onTargetChange={setTarget} /></div>}
        {!session && done && work && work.kind === 'video' && <div className="asset-continue"><p>进入视频工作台，继续调整分镜、字幕和时长。</p><Button onClick={() => openOutput(workRoute(work))}>继续编辑分镜<ArrowUpRight size={14} /></Button></div>}
        {!session && done && !work && asset && !run.workId && <div className="asset-continue"><p>带上这份素材和制作方法，开始下一次创作。</p><Button onClick={continueFromAsset}><Sparkles size={14} />以此素材继续创作</Button></div>}
      </section>
      <section className="run-artifact">
        <div className="artifact-heading"><span><Layers size={16} />创作成果</span><Badge>{work?.kind === 'exhibit' ? work.type : artifactLabel}</Badge></div>
        {done && (work || asset) && !(run.workId && !work) ? <motion.div className="artifact-result" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.28,ease:[0.22,1,0.36,1]}}>
          <div className="artifact-preview">{work?.kind==='presentation'?<PresentationViewer embedded work={work} onClose={()=>{}}/>:work && mediaProject ? <MaterialWorkPreview work={work} large/> : work?.kind === 'story' ? <StoryExperience projectMusic={work.storyMusic} styleId={work.styleId} nodes={work.storyNodes||[]} edges={work.storyEdges||[]} width={work.width} height={work.height}/> : work?.kind==='exhibit' ? <ContextualExhibitPreview work={work} run={run} pageId={target.scope==='work'?undefined:target.pageId}/> : work ? <CurrentWorkPreview work={work} pageId={target.scope === 'work' ? undefined : target.pageId} /> : asset?.kind==='html' ? <AssetPreview asset={asset} large/> : <Artwork type={asset?.componentType || 'image'} styleId={run.styleId} title={asset?.name} image={asset?.kind === 'image' ? asset.src : undefined} />}</div>
          {work?.kind==='exhibit'&&<div className="artifact-result-actions"><Button size="sm" onClick={generateBackground}><ImagePlus size={14}/>生成背景</Button><Button size="sm" onClick={()=>setPickerOpen(true)}>从素材库选择</Button></div>}
          {realOutputDescription(run)&&<p className="component-capability-note">{realOutputDescription(run)}</p>}
          <div className="artifact-result-info">
            <div><h2>{work?.title || asset?.name}</h2><p>{work ? `${work.width} × ${work.height} · ${work.kind === 'video' ? `${work.shots?.length || 0} 个分镜` : work.kind === 'story' ? `${work.storyNodes?.length || 0} 个故事节点` : `${work.pages.length} 个页面`} · 已保存到作品库` : '已保存到素材库 · 可复用与继续创作'}</p></div>
            <div className="artifact-result-actions">{!work && session && <RecoverExhibitActions key={run.id} sessionId={session.id}/>} {work ? <ResultWorkActions work={work} onOpen={openOutput}/> : <Button variant="primary" onClick={() => openOutput(asset ? `/library?asset=${encodeURIComponent(asset.id)}` : '/library')}>前往素材库<ArrowUpRight size={15} /></Button>}</div>
          </div>
          <div className="artifact-composition"><h3>已为你准备</h3><div><span><Layers size={16} />{embeddedProgram ? '嵌入程序 · 可编辑外层布局' : work ? work.kind === 'video' ? `${work.shots?.length || 0} 个可编辑分镜` : work.kind === 'story' ? `${work.storyNodes?.length || 0} 个节点 · ${work.storyEdges?.length || 0} 条连接` : `${work.pages.reduce((total, page) => total + page.nodes.length, 0)} 个可编辑组件` : asset?.kind === 'component' ? '已适配组件 · 可编辑开放属性' : '生成产物与预览'}</span><span><PackageCheck size={16} />保留素材引用</span><span><FileText size={16} />保留本次创作来源</span></div></div>
          {(embeddedProgram || asset?.kind === 'component') && <p className="component-capability-note">{embeddedProgram ? '当前为嵌入式组件。可运行预览、调整位置与尺寸；已开放参数可在生成后的试编辑中修改，内部结构不会自动拆分。' : asset?.componentType === 'bubble' ? '基于已适配组件生成样式与配置，可在画布中编辑开放属性；语音识别、模型回答与语音合成需另行接入。' : '基于已适配组件生成样式与配置，可在画布中编辑开放属性。新的内部功能需要按组件协议开发接入。'}</p>}
          {work && backgroundAsset && <div className="generated-background"><img src={backgroundUrl} alt={asset?.kind === 'image' ? '本次生成的背景' : '本次采用的背景'} /><div><strong>{asset?.kind === 'image' ? '本次新增素材' : '本次采用素材'}</strong><span>{backgroundAsset.name} · {describeAssetSource(backgroundAsset)}</span></div><Button size="sm" onClick={() => setBackgroundOpen(true)}>{asset?.kind === 'image' ? '查看新增背景' : '查看采用背景'}</Button></div>}
        </motion.div> : done ? <EmptyState title="作品已移入回收站" description="恢复作品后，可以继续查看成果和修改记录。" action={<Button onClick={() => openOutput('/projects?status=trash')}>前往作品回收站</Button>} /> : run.status === 'waiting' && run.studioReview ? <RunStudioReview key={run.id} run={run} onActivity={reportActivity}/> : run.status === 'waiting' && structureReview ? <ExhibitPlanReview key={run.id} run={run} onActivity={reportActivity}/> : run.status === 'waiting' && discussing ? <EmptyState title="先选择一个创作方案" description="查看左侧的方案建议，选择后再组织内容与素材。" /> : run.status === 'waiting' ? <div className="background-match-results"><h2>{candidates.length ? '为这个展项选择背景' : '为展项补充一张背景'}</h2><p className="background-match-description">{candidates.length ? '已按素材说明和业务信息匹配，选定后将用于完整展项。' : '匹配范围：当前空间、平台内置与共创社区。指定业务对象时需身份已确认，仅供参考的素材不会自动推荐。'}</p>{candidates.length ? <div className="background-candidate-grid">{candidates.map(match => <BackgroundCandidate key={match.asset.id} asset={match.asset} reasons={match.reasons} onSelect={() => useSuggestedBackground(match.asset)} onPreview={() => setCandidatePreview(match.asset)} />)}</div> : <div className="background-match-empty"><ImagePlus size={30} /><strong>没有符合当前要求的候选</strong><span>展项内容与交互结构将和背景一起编排，完成后可以继续编辑。</span><Button onClick={() => setPickerOpen(true)}>选择或上传图片</Button></div>}<p className="background-match-footnote">演示模式：按已登记的说明与标签匹配，未接入多模态识别服务。</p></div> : run.status === 'running' ? <motion.div className="run-pending-card" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.24}}><div className="run-pending-shimmer" aria-hidden="true"><div className="run-pending-wireframe"><span className="wire-bar wire-bar-title"/><div className="wire-grid"><span className="wire-block"/><span className="wire-block"/></div></div><div className="run-pending-pulse"><span/><span/></div></div><h3>{activity?.label || (['正在理解创作需求…','正在匹配可用素材…','正在确认创作资源…','正在编排内容与交互…','正在检查布局与体验…','正在准备创作成果…'][run.step] ?? '正在构建创作成果…')}</h3><p>完成后将直接在这里呈现可交互预览，并支持继续对话微调或一键进入编辑器精修。</p></motion.div> : null}
      </section>
    </div>
    <BackgroundComposer runId={run.id} pageId={target.scope==='work'?undefined:target.pageId} open={generationOpen} onClose={()=>setGenerationOpen(false)}/>
    <MaterialPicker open={pickerOpen} onClose={() => setPickerOpen(false)} workspaceId={run.workspaceId || 'personal'} kinds={['image']} title="选择展项背景" onSelect={selected => useBackground(selected,'manual')} />
    <Modal open={backgroundOpen} onClose={() => setBackgroundOpen(false)} title={asset?.kind === 'image' ? '本次生成的背景' : '本次采用的背景'} wide><img className="generated-background-large" src={backgroundUrl} alt={backgroundAsset?.name || '展项背景'} /><p className="background-preview-note">背景已应用到展项，并保存在素材库。修改背景时，展项中的组件与交互会保留。</p></Modal>
    <Modal open={Boolean(candidatePreview)} onClose={() => setCandidatePreview(undefined)} title={candidatePreview?.name || '背景预览'} wide footer={<><Button onClick={() => setCandidatePreview(undefined)}>继续比较</Button><Button variant="primary" onClick={() => candidatePreview && useSuggestedBackground(candidatePreview)}>使用这张并继续</Button></>}><img className="generated-background-large" src={candidatePreviewUrl} alt={candidatePreview?.name || '候选背景'} /><p className="background-preview-note">{candidatePreview && describeAssetSource(candidatePreview)} · 使用后保留当前素材版本。</p></Modal>
  </div>;
}

function BackgroundCandidate({asset,reasons,onSelect,onPreview}:{asset:Asset;reasons:string[];onSelect:()=>void;onPreview:()=>void}) {
  const src = useMedia(asset.src);
  return <article className="background-candidate">
    <button className="background-candidate-preview" onClick={onPreview} aria-label={`预览${asset.name}`}><img src={src} alt={asset.name} /><span>放大预览</span></button>
    <div className="background-candidate-info"><strong title={asset.name}>{asset.name}</strong><span>{reasons[0]}</span><p>{reasons.slice(1).join(' · ') || '适合当前创作需求'}</p><Button size="sm" onClick={onSelect}>使用这张并继续<ArrowUpRight size={14} /></Button></div>
  </article>;
}
