import {beforeEach, describe, expect, it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import type {Asset} from '../src/domain/types';
import {assetSearchText, getAssetMetadata, mergeAssetMetadata} from '../src/domain/asset-metadata';
import {rankAssets} from '../src/domain/asset-retrieval';
import {assetAvailableForInsertion} from '../src/domain/asset-access';

const image = (patch:Partial<Asset>={}):Asset => ({...createInitialData().assets[0], id:'image', source:'uploaded', public:false, workspaceId:'xintai', name:'最终版03.png', description:'本地上传', tags:['本地上传'], metadata:undefined,...patch});
const confirmed = {note:'客户确认的晋江工厂实拍',subject:'信泰',confirmed:true,usage:'project' as const,allowAi:true};

beforeEach(()=>useStudio.setState(createInitialData()));

describe('honest asset metadata',()=>{
 it('does not infer visual content or customer identity from an upload filename',()=>{
  const metadata=getAssetMetadata(image({name:'信泰科技蓝工厂.png'}));
  expect(metadata.analysis.status).toBe('needs-description');
  expect(metadata.analysis.tags).toEqual([]);
  expect(metadata.business.subject).toBe('');
  expect(metadata.business.confirmed).toBe(false);
 });
 it('inherits descriptive metadata while keeping business identity unconfirmed',()=>{
  const metadata=getAssetMetadata(image({source:'community',public:true,description:'蓝灰色工业背景',tags:['工业','背景']}));
  expect(metadata.analysis.basis).toBe('inherited');
  expect(metadata.analysis.status).toBe('ready');
  expect(metadata.analysis.summary).toContain('蓝灰色');
  expect(metadata.business.confirmed).toBe(false);
 });
 it('preserves confirmed business metadata across automated analysis refreshes',()=>{
  const asset=image({metadata:{business:confirmed}});
  const next=mergeAssetMetadata(asset,{analysis:{status:'ready',summary:'工厂画面',tags:['厂房'],basis:'demo'}});
  expect(next.metadata?.business).toEqual(confirmed);
  expect(asset.metadata?.analysis).toBeUndefined();
  expect(assetSearchText(next)).toContain('晋江工厂实拍');
 });
});

describe('resource retrieval eligibility precedes ranking',()=>{
 it('does not use an unknown upload automatically even when its filename matches',()=>{
  const asset=image({name:'工业背景.png'});
  expect(rankAssets({assets:[asset],workspaceId:'xintai',query:'工业背景',forAI:true})).toEqual([]);
  expect(rankAssets({assets:[asset],workspaceId:'xintai',query:'工业背景',forAI:false})).toHaveLength(1);
 });
 it('retrieves confirmed business notes independently of filenames',()=>{
  const asset=image({metadata:{business:confirmed}});
  const result=rankAssets({assets:[asset],workspaceId:'xintai',query:'晋江工厂',forAI:true});
  expect(result).toHaveLength(1);
  expect(result[0].reasons.join('')).toContain('业务说明');
 });
 it('filters other spaces, disabled AI, reference-only, archived and deleted assets',()=>{
  const good=image({metadata:{business:confirmed}});
  const assets=[good,{...good,id:'other',workspaceId:'dongguan'},{...good,id:'off',metadata:{business:{...confirmed,allowAi:false}}},{...good,id:'reference',metadata:{business:{...confirmed,usage:'reference' as const}}},{...good,id:'archived',archived:true},{...good,id:'deleted',deletedAt:'2026-11-06'}];
  expect(rankAssets({assets,workspaceId:'xintai',query:'工厂',forAI:true}).map(match=>match.asset.id)).toEqual(['image']);
 });
 it('requires confirmed identity for specific customer requests',()=>{
  const generic=image({id:'generic',source:'community',public:true,description:'信泰工厂风格背景',tags:['工厂']});
  const actual=image({metadata:{business:confirmed}});
  expect(rankAssets({assets:[generic,actual],workspaceId:'xintai',query:'工厂背景',subject:'信泰',forAI:true}).map(match=>match.asset.id)).toEqual(['image']);
  expect(rankAssets({assets:[generic,actual],workspaceId:'xintai',query:'信泰客户自己的工厂照片',forAI:true}).map(match=>match.asset.id)).toEqual(['image']);
 });
 it('does not recommend a generic factory illustration for an unknown company real-photo request',()=>{
  const generic=image({id:'generic',source:'generated',description:'工业工厂背景图片',tags:['工业','工厂','背景']});
  expect(rankAssets({assets:[generic],workspaceId:'xintai',query:'TAGAL工厂实拍照片',forAI:true})).toEqual([]);
  expect(rankAssets({assets:[generic],workspaceId:'xintai',query:'真实工厂照片',forAI:true})).toEqual([]);
 });
 it('normalizes explicitly known project aliases without merging arbitrary substrings',()=>{
  const actual=image({metadata:{business:{...confirmed,subject:'信泰企业展厅'}}});
  const other=image({id:'another-company',metadata:{business:{...confirmed,subject:'信泰科技设备公司'}}});
  expect(rankAssets({assets:[actual,other],workspaceId:'xintai',query:'信泰工厂实拍',forAI:true}).map(match=>match.asset.id)).toEqual(['image']);
 });
 it('does not treat a component preview or editable studio work as insertable media',()=>{
  expect(assetAvailableForInsertion(image({kind:'component',componentType:undefined}),'xintai')).toBe(false);
  expect(assetAvailableForInsertion(image({kind:'component',componentType:'bubble'}),'xintai')).toBe(true);
  expect(assetAvailableForInsertion(image({kind:'document'}),'xintai')).toBe(false);
  expect(rankAssets({assets:[image({sourceWorkId:'work-5',kind:'video'})],workspaceId:'xintai',query:'',forAI:false})).toEqual([]);
 });
 it('does not invent a match when no content overlaps and uses private sources only as a tiebreak',()=>{
  const community=image({id:'public',public:true,source:'community',description:'蓝色工业厂房背景',tags:['工业','背景']});
  const local={...community,id:'local',public:false,workspaceId:'xintai'};
  expect(rankAssets({assets:[community,local],workspaceId:'xintai',query:'工业背景',forAI:true})[0].asset.id).toBe('local');
  expect(rankAssets({assets:[community],workspaceId:'xintai',query:'珠宝首饰',forAI:true})).toEqual([]);
 });
});

describe('private resource adoption and composer lifecycle',()=>{
 it('adopts registered community dependencies when a template is cloned',()=>{
  const state=useStudio.getState(),template=state.templates[0];
  const src='/media/template-background-v1.svg';
  const resource=image({id:'template-background',public:true,source:'community',src});
  state.addAsset(resource);
  useStudio.setState({templates:[{...template,work:{...template.work,pages:template.work.pages.map((page,index)=>index===0?{...page,backgroundImage:src}:page)}}]});
  state.setWorkspace('xintai');
  const work=state.cloneTemplate(template.id)!;
  expect(work.pages[0].backgroundImage).toBe(src);
  const adopted=useStudio.getState().assets.find(asset=>asset.id===work.pages[0].backgroundAssetId)!;
  expect(adopted).toMatchObject({workspaceId:'xintai',public:false,origin:{assetId:'template-background'}});
  expect(adopted.id).not.toBe(resource.id);
 });
 it('rejects forbidden AI attachments at submission without consuming the draft',()=>{
  const state=useStudio.getState();state.setWorkspace('xintai');
  state.addAsset(image({metadata:{business:{...confirmed,allowAi:false}}}));
  state.updateDraft({text:'用这张工厂图片制作背景',attachmentIds:['image']});
  const id=useStudio.getState().activeDraftId;
  expect(state.startRun()).toBeUndefined();
  expect(useStudio.getState().creationError).toContain('AI');
  expect(useStudio.getState().activeDraftId).toBe(id);
  expect(useStudio.getState().drafts.find(draft=>draft.id===id)?.text).toContain('工厂图片');
 });
 it('revalidates permission on task completion and conversational changes',()=>{
  const state=useStudio.getState();state.setWorkspace('xintai');
  state.addAsset(image({metadata:{business:confirmed}}));
  state.updateDraft({text:'生成背景图片',attachmentIds:['image']});
  const run=state.startRun()!;
  state.updateAssetMetadata('image',{business:{...confirmed,allowAi:false}});
  state.completeRun(run.id);
  expect(useStudio.getState().runs.find(task=>task.id===run.id)?.status).toBe('failed');
  expect(useStudio.getState().runs.find(task=>task.id===run.id)?.assetId).toBeUndefined();
  const work=state.createWork({title:'展项',type:'时间演进型',width:1920,height:1080});
  expect(state.reviseWork(work.id,'更换背景',{scope:'work'},['image']).ok).toBe(false);
  expect(state.referenceAsset(useStudio.getState().assets.find(asset=>asset.id==='image')!)).toBeUndefined();
 });
 it('reuses an unscoped platform built-in without creating a private copy',()=>{
  const state=useStudio.getState();const source={...state.assets[0],id:'builtin',workspaceId:undefined,public:false,source:'builtin' as const};
  useStudio.setState({assets:[...state.assets,source]});
  const count=useStudio.getState().assets.length;
  expect(state.adoptAsset(source.id,'xintai')?.id).toBe(source.id);
  expect(useStudio.getState().assets).toHaveLength(count);
 });
 it('adopts a stable community version into an explicit target space once',()=>{
  const state=useStudio.getState();
  const source={...state.assets[0],id:'shared-version',public:true,source:'community' as const,updatedAt:'2026-11-06T01:00:00Z'};
  state.addAsset(source);
  const first=state.adoptAsset(source.id,'xintai')!;
  expect(first.public).toBe(false);
  expect(first.workspaceId).toBe('xintai');
  expect(first.origin?.assetId).toBe(source.id);
  expect(state.adoptAsset(source.id,'xintai')?.id).toBe(first.id);
  expect(state.adoptAsset(source.id,'dongguan')?.id).not.toBe(first.id);
  state.addAsset({...source,src:'/updated.png'});
  const next=state.adoptAsset(source.id,'xintai')!;
  expect(next.id).not.toBe(first.id);
  expect(useStudio.getState().assets.find(asset=>asset.id===first.id)?.src).toBe(source.src);
 });
 it('returns a same-space private asset without cloning and rejects inaccessible assets',()=>{
  const state=useStudio.getState(), asset=image();state.addAsset(asset);
  expect(state.adoptAsset(asset.id,'xintai')?.id).toBe(asset.id);
  expect(state.adoptAsset(asset.id,'dongguan')).toBeUndefined();
  expect(state.adoptAsset(asset.id,'invalid')).toBeUndefined();
  expect(state.adoptAsset('missing','personal')).toBeUndefined();
 });
 it('allows current-space business corrections without rewriting facts or published assets',()=>{
  const state=useStudio.getState();state.setWorkspace('xintai');
  state.addAsset(image({metadata:{facts:{width:1920,height:1080}}}));
  expect(state.updateAssetMetadata('image',{business:confirmed})).toBe(true);
  expect(useStudio.getState().assets.find(asset=>asset.id==='image')?.metadata?.business).toEqual(confirmed);
  expect(state.updateAssetMetadata('image',{facts:{width:999}})).toBe(false);
  expect(useStudio.getState().assets.find(asset=>asset.id==='image')?.metadata?.facts?.width).toBe(1920);
  state.setWorkspace('dongguan');
  expect(state.updateAssetMetadata('image',{business:confirmed})).toBe(false);
  expect(state.updateAssetMetadata(state.assets.find(asset=>asset.public)!.id,{business:confirmed})).toBe(false);
 });
 it('consumes only successfully submitted input and keeps new unsent input independent',()=>{
  const state=useStudio.getState();state.updateDraft({text:'钢铁大事记',model:'Claude',styleId:'industrial',skillIds:['skill-1'],attachmentIds:['asset-1']});
  const oldId=useStudio.getState().activeDraftId;
  const run=state.startRun()!;
  const current=useStudio.getState(), draft=current.drafts.find(item=>item.id===current.activeDraftId)!;
  expect(current.drafts.some(item=>item.id===oldId)).toBe(false);
  expect(draft).toMatchObject({text:'',model:'Claude',styleId:'',skillIds:[],attachmentIds:[]});
  expect(run).toMatchObject({prompt:'钢铁大事记',model:'Claude',styleId:'industrial',attachmentIds:['asset-1']});
  state.updateDraft({text:'钢铁大事记'});
  expect(useStudio.persist.getOptions().merge!(useStudio.getState(),useStudio.getState()).drafts.find(item=>item.id===draft.id)?.text).toBe('钢铁大事记');
  state.updateDraft({text:' '});const id=useStudio.getState().activeDraftId;
  expect(state.startRun()).toBeUndefined();expect(useStudio.getState().activeDraftId).toBe(id);
 });
 it('reveals legacy archives once without resurrecting deleted works or discarding ambiguous drafts',()=>{
  const state=useStudio.getState();
  const old={...createInitialData(),resourceSchemaVersion:undefined,works:state.works.map((work,index)=>({...work,archived:true,...(index===0?{deletedAt:'2026-11-06'}:{})})),drafts:[{...state.drafts[0],text:'旧的未发送需求'}]};
  const merged=useStudio.persist.getOptions().merge!(old,state);
  expect(merged.works.every(work=>!work.archived)).toBe(true);
  expect(merged.works[0].deletedAt).toBe('2026-11-06');
  expect(merged.assets.every(asset=>!asset.archived)).toBe(true);
  expect(merged.drafts[0].text).toBe('旧的未发送需求');
  expect(merged.resourceSchemaVersion).toBe(3);
  const newer={...merged,works:[{...merged.works[1],archived:true}]};
  expect(useStudio.persist.getOptions().merge!(newer,state).works[0].archived).toBe(true);
 });
});
