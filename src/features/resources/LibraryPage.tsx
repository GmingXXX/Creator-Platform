import {captureKnowledgeTarget,type KnowledgeTarget} from '../../domain/workspace-knowledge';
import {importWorkspaceFile} from '../../domain/workspace-upload';
import {KnowledgeTargetNotice} from '../workspace/KnowledgeTargetNotice';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, CheckCircle2, FileUp, MoreHorizontal, Plus, Trash2, Upload } from 'lucide-react';
import { useStudio } from '../../domain/store';
import {workspaceCanEdit} from '../../domain/workspace-management';
import { resourceInView } from '../../domain/resource-sharing';
import { assetSearchText, getAssetMetadata } from '../../domain/asset-metadata';
import { getAssetCategory, isLibraryAsset, resolveAssetProject } from '../../domain/project-taxonomy';
import { navigateInWorkspace } from '../workspace/output-navigation';
import { uploadFileKind } from '../../domain/upload';
import { inspectComponentFile, type ComponentInspection } from '../../domain/component-import';
import type { Asset } from '../../domain/types';
import { Button, EmptyState, Menu, Modal, PageHeader, SearchInput, Tabs, toast } from '../../components/ui';
import { AssetDetails, AssetPreview, Avatar, FavoriteButton, SubmissionDialog } from './Shared';
import { formatDate, sourceLabels, typeLabels, workRoute } from './helpers';
import { AssetInformationStatus } from './AssetMetadataPanel';
import { ComponentExampleDownload, ComponentImportDialog, type ComponentImportResult } from './ComponentImportDialog';
import '../../styles/resources-v15.css';
import {libraryUploadPolicy,validateLibraryUpload,type LibraryUploadCategory} from './library-upload';
type UploadTarget={category:LibraryUploadCategory;workspaceId:string;label:string;knowledgeTarget:KnowledgeTarget};

const categories = [{ value: 'all', label: '全部素材' }, { value: 'image', label: '图片' }, { value: 'video', label: '视频' }, { value: 'audio', label: '音频' }, { value: 'component', label: '组件' }, { value: 'document', label: '文档资料' }];

export function LibraryPage() {
  const state = useStudio();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = libraryUploadPolicy(params.get('type') || 'all').category;
  const [query, setQuery] = useState('');
  const linkedAsset=state.assets.find(asset=>asset.id===params.get('asset'));
  const view = state.activeWorkspaceId!=='personal'&&params.get('scope')!=='mine'&&!(params.get('scope')===null&&linkedAsset&&(linkedAsset.workspaceId||'personal')==='personal')?'shared':'mine';
  const workspaces=state.workspaces;
  const targetWorkspace = view === 'shared' ? state.activeWorkspaceId : 'personal';
  const editable=workspaceCanEdit(state,targetWorkspace);
  const [source, setSource] = useState('all');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [uploadTarget,setUploadTarget]=useState<UploadTarget|null>(null);
  const uploadLock=useRef(false);
  const currentPolicy=libraryUploadPolicy(category);
  const policy=libraryUploadPolicy(uploadTarget?.category||category);
  const currentUploadTarget=():UploadTarget=>({category,workspaceId:targetWorkspace,knowledgeTarget:captureKnowledgeTarget(useStudio.getState(),targetWorkspace),label:view==='shared'?`${workspaces.find(space=>space.id===targetWorkspace)?.name||'当前空间'} · 空间共享素材`:'我的素材库'});
  const beginUpload=()=>{if(!editable)return;setItems([]);setUploadTarget(currentUploadTarget());setUpload(true);};
  const closeUpload=()=>{if(uploadLock.current)return;setUpload(false);setUploadTarget(null);};
  const [drag, setDrag] = useState(false);
  const [items, setItems] = useState<{ name: string; status: string; error?: string; assetId?: string; facts?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [component, setComponent] = useState<{ inspection: ComponentInspection; file: File; workspaceId: string; knowledgeTarget:KnowledgeTarget; version: number } | null>(null);
  const componentResolve = useRef<((asset: Asset | null) => void) | null>(null);
  const mounted = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; componentResolve.current?.(null); componentResolve.current = null; };
  }, []);
  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next, { replace: true });
  };
  const previousWorkspace=useRef(state.activeWorkspaceId);
  useEffect(()=>{
    if(previousWorkspace.current===state.activeWorkspaceId)return;
    previousWorkspace.current=state.activeWorkspaceId;
    setShareId(null);setSubmissionId(null);setRemoveId(null);
    const next=new URLSearchParams(params);next.delete('asset');
    state.activeWorkspaceId==='personal'?next.delete('scope'):next.set('scope','shared');
    setParams(next,{replace:true});
  },[state.activeWorkspaceId,params,setParams]);
  // Keep old bookmarks useful without exposing editable projects as material cards.
  useEffect(() => {
    const legacyAsset = state.assets.find(item => item.id === params.get('asset'));
    if (legacyAsset && !isLibraryAsset(legacyAsset)) {
      if (legacyAsset.public) {
        const template = state.templates.find(item => item.id === legacyAsset.id) || state.templates.find(item => item.work.id === legacyAsset.workSnapshot?.id);
        navigate(`/community?tab=templates&template=${encodeURIComponent(template?.id || legacyAsset.id)}`, { replace: true });
        return;
      }
      const project = resolveAssetProject(legacyAsset, state.works);
      if (project) navigateInWorkspace(navigate, project.workspaceId, project.deletedAt ? '/projects?status=trash' : workRoute(project));
    } else if (params.get('type') === 'presentation' || params.get('status') === 'trash') {
      navigate(`/projects?${params.get('status') === 'trash' ? 'status=trash' : 'category=presentation-video'}`, { replace: true });
    }
  }, [navigate, params, state.assets, state.works, state.templates]);
  const spaceAssets = state.assets.filter(asset => !asset.public && isLibraryAsset(asset) && resourceInView(asset, view, state.activeWorkspaceId));
  const selected = spaceAssets.find(asset => asset.id === params.get('asset'));
  const submission = spaceAssets.find(asset => asset.id === submissionId);
  const remove = spaceAssets.find(asset => asset.id === removeId);
  const sharing = view==='mine'&&state.activeWorkspaceId!=='personal'?spaceAssets.find(asset=>asset.id===shareId):undefined;
  const shareAsset=()=>{if(!sharing)return;const saved=state.adoptAsset(sharing.id,state.activeWorkspaceId);if(saved){setShareId(null);toast('已带入当前空间，个人原件保持不变');}else toast(useStudio.getState().creationError||'暂时无法共享此素材，请重试',true);};
  const assets = spaceAssets.filter(asset => {
    return !asset.deletedAt && (category === 'all' || getAssetCategory(asset) === category) && (source === 'all' || asset.source === source) && assetSearchText(asset).includes(query.trim().toLowerCase());
  }).sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));

  const uploadFiles = async (files: FileList | null, target:UploadTarget=uploadTarget||currentUploadTarget()) => {
    if(!workspaceCanEdit(useStudio.getState(),target.workspaceId)){toast('当前空间为只读，无法上传共享素材',true);return;}
    if (!files?.length || uploadLock.current || component) return;
    uploadLock.current=true;setUploadTarget(target);
    setUpload(true); setBusy(true);setQuery('');setSource('all');
    const workspaceId = target.workspaceId;
    const list = Array.from(files);
    let componentCount = 0;
    let savedComponents = 0;
    let failures = 0;
    setItems(list.map(file => ({ name: file.name, status: '正在读取' })));
    for (let index = 0; index < list.length; index++) {
      if (!mounted.current) break;
      try {
        if (useStudio.getState().assets.some(asset => asset.name === list[index].name && asset.source === 'uploaded' && (asset.workspaceId || 'personal') === workspaceId)) throw new Error('素材库中已有同名文件，请更名后再上传。');
        uploadFileKind(list[index]);
        const inspection = await inspectComponentFile(list[index]);
        validateLibraryUpload(list[index],target.category,Boolean(inspection));
        let asset: Asset;
        if (inspection) {
          componentCount++;
          setUpload(false);
          const saved = await new Promise<Asset | null>(resolve => {
            componentResolve.current = resolve;
            setComponent({ inspection, file: list[index], workspaceId, knowledgeTarget:target.knowledgeTarget, version: 0 });
          });
          if (!saved) {
            setItems(previous => previous.map((item, i) => i === index ? { ...item, status: '已取消' } : item));
            continue;
          }
          asset = saved;
          savedComponents++;
        } else {
          asset = await importWorkspaceFile(list[index],workspaceId,target.knowledgeTarget);
          if (!mounted.current) break;
          state.addAsset({ ...asset, workspaceId });
        }
        const facts = getAssetMetadata(asset).facts;
        const factLabel = [facts.width && facts.height ? `${facts.width} × ${facts.height}` : '', facts.duration !== undefined ? `${facts.duration.toFixed(1)} 秒` : '', '待补充内容说明'].filter(Boolean).join(' · ');
        setItems(previous => previous.map((item, i) => i === index ? { ...item, status: '已添加', assetId: asset.id, facts: factLabel } : item));
      } catch (error) {
        failures++;
        setItems(previous => previous.map((item, i) => i === index ? { ...item, status: '失败', error: error instanceof Error ? error.message : '文件读取失败' } : item));
      }
    }
    uploadLock.current=false;setBusy(false);
    if (componentCount) {
      setUpload(failures > 0);
      if (!failures) setUploadTarget(null);
      if (savedComponents) toast(`已保存 ${savedComponents} 个组件，预览配置已保留`);
    }
    if (fileInput.current) fileInput.current.value = '';
  };
  const finishComponent = (asset: Asset | null) => {
    const resolve = componentResolve.current;
    componentResolve.current = null;
    setComponent(null);
    resolve?.(asset);
  };
  const saveComponent = async (result: ComponentImportResult) => {
    if (!component) return;
    if (useStudio.getState().assets.some(asset => asset.name === result.name && (asset.workspaceId || 'personal') === component.workspaceId && !asset.deletedAt)) throw new Error('已有同名素材，请调整组件名称后保存。');
    const asset = await importWorkspaceFile(new File([result.html], `${result.name.replace(/\.html?$/i, '')}.html`, { type: 'text/html;charset=utf-8' }),component.workspaceId,component.knowledgeTarget);
    const saved: Asset = { ...asset, name: result.name, description: result.description || 'HTML 嵌入组件', workspaceId: component.workspaceId, componentImport: result.componentImport };
    useStudio.getState().addAsset(saved);
    finishComponent(saved);
  };
  const replaceComponent = async (file: File) => {
    const inspection = await inspectComponentFile(file);
    if (!inspection) throw new Error('这个压缩包中没有 HTML 文件，请选择包含 HTML 和相关资源的 ZIP。');
    setComponent(previous => previous ? { ...previous, file, inspection, version: previous.version + 1 } : null);
  };
  const selectComponentEntry = async (entry: string) => {
    if (!component) return;
    const inspection = await inspectComponentFile(component.file, entry);
    if (inspection) setComponent(previous => previous ? { ...previous, inspection, version: previous.version + 1 } : null);
  };
  const deleteAsset = () => {
    if (!remove) return;
    if (state.removeAsset(remove.id)) { toast('素材已删除'); setRemoveId(null); }
    else toast('该素材正在被作品使用，请先移除相应引用');
  };
  const menuItems = (asset: Asset) => !workspaceCanEdit(state,asset.workspaceId||'personal')?[{label:'查看详情',onClick:()=>updateParams({asset:asset.id})}]:[
    { label: '查看详情', onClick: () => updateParams({ asset: asset.id }) },
    ...(view==='mine'&&state.activeWorkspaceId!=='personal'&&asset.source!=='builtin'?[{label:'带入当前空间',onClick:()=>setShareId(asset.id)}]:[]),
    ...(view==='shared'?[{label:'保存到我的素材库',onClick:()=>{const saved=state.adoptAsset(asset.id,'personal');toast(saved?'已保存独立副本到我的素材库':'保存失败，请重试',!saved);}}]:[]),
    { label: '提交社区', onClick: () => setSubmissionId(asset.id) },
    { label: '删除素材', danger: true, icon: <Trash2 size={14} />, onClick: () => setRemoveId(asset.id) },
  ];

  const backgroundDropEnabled=editable&&!upload&&!component&&!selected&&!submission&&!remove&&!sharing;
  return <div className="res-page" onDragOver={event => { if (backgroundDropEnabled && !(event.target as HTMLElement).closest('[role=dialog]') && !uploadLock.current && !component && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDrag(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrag(false); }} onDrop={event => { event.preventDefault(); setDrag(false); if (backgroundDropEnabled && !(event.target as HTMLElement).closest('[role=dialog]')) void uploadFiles(event.dataTransfer.files,currentUploadTarget()); }}>
    <PageHeader title={view === 'mine' ? '我的素材库' : '空间共享素材'} description="管理图片、视频、音频、组件与文档资料，让每次创作都能继续复用。"><Button variant="primary" onClick={beginUpload} disabled={busy||!editable}><Upload size={16} />{currentPolicy.label}</Button></PageHeader>
    {state.activeWorkspaceId !== 'personal' && <div className="resource-scope-row"><Tabs value={view} onChange={value=>updateParams({scope:value,asset:''})} items={[{value:'mine',label:'我的素材'},{value:'shared',label:'空间共享'}]}/><span>{view==='mine'?'个人素材需明确带入后，才会用于当前空间':'此处素材可供当前项目空间成员使用'}</span></div>}
    <Tabs value={category} onChange={value => updateParams({ type: value === 'all' ? '' : value })} items={categories} />
    <div className="res-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="搜索素材名称、说明或标签" /><select aria-label="素材来源" value={source} onChange={event => setSource(event.target.value)}><option value="all">全部来源</option><option value="uploaded">本地上传</option><option value="generated">智能生成</option><option value="community">社区复用</option><option value="builtin">内置素材</option></select><span className="res-toolbar-spacer" /><span className="res-result-count">{assets.length} 项素材</span></div>
    {assets.length ? <div className="res-grid res-assets-grid">{assets.map((asset, index) => <motion.article className="res-card" key={asset.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.22,delay:Math.min(index,8)*0.025,ease:[0.22,1,0.36,1]}}>
      <div className="res-cover-wrapper"><button className="res-cover-button" onClick={() => updateParams({ asset: asset.id })} aria-label={`预览${asset.name}`}><AssetPreview asset={asset} /><span className="res-cover-action">查看素材 <ArrowUpRight size={15} /></span></button><FavoriteButton id={asset.id} /></div>
      <div className="res-card-body"><div className="res-card-title-row"><button className="res-text-link" onClick={() => updateParams({ asset: asset.id })}><h3>{asset.name}</h3></button><Menu trigger={<button className="res-icon-button" aria-label={`${asset.name}更多操作`}><MoreHorizontal size={18} /></button>} items={menuItems(asset)} /></div><p className="res-card-description">{typeLabels[asset.kind]} · {sourceLabels[asset.source]} · {formatDate(asset.updatedAt || asset.createdAt)}</p><div className="res-card-footer"><span><Avatar name={asset.author} />{asset.author}</span><AssetInformationStatus asset={asset} /></div></div>
    </motion.article>)}</div> : <EmptyState title={query||source!=='all'||category!=='all'?'没有匹配的素材':'还没有相关素材'} description={query||source!=='all'||category!=='all'?'试试其他关键词，或清除筛选查看全部素材。':'上传本地文件，或在首页智能体中生成素材。'} action={query||source!=='all'||category!=='all'?<Button variant="secondary" onClick={()=>{setQuery('');setSource('all');updateParams({type:''});}}>清除筛选</Button>:<Button variant="secondary" onClick={beginUpload} disabled={busy||!editable}><Plus size={15} />{currentPolicy.label}</Button>} />}
    <input ref={fileInput} className="res-sr-only" type="file" multiple disabled={!editable} onChange={event => void uploadFiles(event.target.files)} accept={policy.accept} />
    {drag && <div className="res-drop-overlay"><FileUp size={38} /><h2>松开鼠标，{currentPolicy.label}</h2><p>{currentPolicy.hint}</p><p>保存到：{currentUploadTarget().label}</p></div>}
    <Modal open={upload} onClose={closeUpload} title={policy.label} footer={<Button variant="secondary" onClick={closeUpload} disabled={busy||!editable}>完成</Button>}><div onDragOver={event=>{event.preventDefault();event.stopPropagation();}} onDrop={event=>{event.preventDefault();event.stopPropagation();setDrag(false);void uploadFiles(event.dataTransfer.files);}}><p className="res-muted">保存到：{uploadTarget?.label||currentUploadTarget().label} · {policy.name}</p><KnowledgeTargetNotice target={(uploadTarget||currentUploadTarget()).knowledgeTarget}/><button className="res-upload-zone" disabled={busy||!editable} onClick={() => fileInput.current?.click()}><Upload size={28} /><strong>{busy ? '正在读取文件…' : '点击选择文件，或拖入此页面'}</strong><span>{policy.hint}</span></button>{(policy.category==='all'||policy.category==='component')&&<div className="component-upload-help"><span>组件包将先检查和预览试编辑，确认后再入库。</span><ComponentExampleDownload/></div>}{items.length > 0 && <div className="res-upload-files">{items.map((item, index) => <div key={index}><FileUp size={17} /><div><strong>{item.name}</strong>{item.facts && <small className="asset-upload-facts">{item.facts}</small>}{item.error && <small className="res-error">{item.error}</small>}</div><span className={item.error ? 'res-error' : 'res-success'}>{item.status}</span>{item.status === '已添加' && <CheckCircle2 size={16} />}{item.assetId && <button className="asset-info-quick-link" disabled={busy||!editable} onClick={() => { setUpload(false); updateParams({ asset: item.assetId! }); }}>查看素材</button>}</div>)}</div>}<p className="res-muted">{uploadTarget?.workspaceId!=='personal'?'添加后，目标项目空间成员可使用这些素材。':'添加到我的素材库，不自动共享。'}</p><p className="res-muted">素材会保存在当前浏览器，刷新后仍可使用。上传文件不会自动发布到社区。</p></div></Modal>
    {component && <ComponentImportDialog key={component.version} inspection={component.inspection} workspaceLabel={component.workspaceId === 'personal' ? '我的素材库' : '当前空间共享素材'} onCancel={() => finishComponent(null)} onReplace={replaceComponent} onEntryChange={selectComponentEntry} onSave={saveComponent}/>}
    <Modal open={Boolean(sharing)} onClose={()=>setShareId(null)} title="带入当前空间" footer={<><Button onClick={()=>setShareId(null)}>取消</Button><Button variant="primary" onClick={shareAsset}>确认带入</Button></>}><p>将「{sharing?.name}」的当前版本及关联资源添加为固定副本，当前项目空间成员可使用。你的个人版本保持不变。</p></Modal>
    {selected && <AssetDetails key={selected.id} asset={selected} onClose={() => updateParams({ asset: '' })} />}
    {submission && <SubmissionDialog asset={submission} onClose={() => setSubmissionId(null)} />}
    <Modal open={Boolean(remove)} onClose={() => setRemoveId(null)} title="删除素材" footer={<><Button variant="secondary" onClick={() => setRemoveId(null)}>取消</Button><Button variant="danger" onClick={deleteAsset}>删除素材</Button></>}><p>确定删除“{remove?.name}”？正在被作品引用的素材会保留，并提示你先处理引用。</p></Modal>
  </div>;
}
