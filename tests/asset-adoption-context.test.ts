import {beforeEach,describe,it,expect} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import {assetDependencyError} from '../src/domain/resource-permissions';
beforeEach(()=>useStudio.setState(createInitialData()));
describe('explicit material adoption keeps project dependencies local',()=>{
 it('copies nested personal dependencies atomically and remaps their identifiers',()=>{
  const state=useStudio.getState(),base=state.assets[0];
  const image={...base,id:'private-leaf',workspaceId:'personal',source:'uploaded' as const,public:false,src:'idb:private-leaf',preview:'idb:private-leaf',package:undefined};
  const component={...base,id:'private-bundle',workspaceId:'personal',source:'uploaded' as const,public:false,kind:'component' as const,componentType:'gallery' as const,src:'idb:private-bundle',package:{id:'pack',version:'1',prompt:'',files:[{name:'data.json',type:'data',content:JSON.stringify({image:image.src,assetId:image.id})}],skillIds:[],params:{referenceAssetIds:JSON.stringify([image.id])},sourceId:image.id,complete:true}};
  state.addAsset(image);state.addAsset(component);state.setWorkspace('xintai');
  const adopted=state.adoptAsset(component.id,'xintai')!,current=useStudio.getState();
  expect(adopted).toBeDefined();expect(adopted.package?.sourceId).not.toBe(image.id);
  expect(current.assets.find(a=>a.id===adopted.package?.sourceId)?.workspaceId).toBe('xintai');
  expect(assetDependencyError(current.assets,adopted,'xintai','ai')).toBeUndefined();
  expect(current.assets.find(a=>a.id===component.id)?.package?.sourceId).toBe(image.id);
  expect(state.adoptAsset(component.id,'xintai')?.id).toBe(adopted.id);
 });
 it('refuses raw personal dependencies in project saves instead of silently substituting a matching public URL',()=>{
  const state=useStudio.getState(),asset={...state.assets[0],id:'not-adopted',workspaceId:'personal',source:'uploaded' as const,public:false,package:undefined};state.addAsset(asset);
  const work=state.createWork({title:'项目工程',type:'时间演进型',width:1920,height:1080,workspaceId:'xintai'});
  expect(()=>state.saveWork({...work,pages:work.pages.map(page=>({...page,backgroundImage:asset.src,backgroundAssetId:asset.id}))})).toThrow('依赖');
  expect(useStudio.getState().works.find(item=>item.id===work.id)?.pages).toEqual(work.pages);
 });
 it('rejects an invalid dependency without leaving partial copies',()=>{
  const state=useStudio.getState(),asset={...state.assets[0],id:'broken-personal',workspaceId:'personal',source:'uploaded' as const,public:false,package:{id:'broken',version:'1',prompt:'',files:[],skillIds:[],params:{},sourceId:'missing',complete:true}};
  state.addAsset(asset);state.setWorkspace('xintai');const count=useStudio.getState().assets.length;
  expect(state.adoptAsset(asset.id,'xintai')).toBeUndefined();expect(useStudio.getState().assets).toHaveLength(count);
 });
 it('explicit same-style creation adopts the selected personal material before using project context',()=>{
  const state=useStudio.getState(),asset={...state.assets[0],id:'personal-same-style',workspaceId:'personal',source:'uploaded' as const,public:false,package:{id:'pack',version:'1',prompt:'编排示例',files:[],skillIds:[],params:{},complete:true}};
  state.addAsset(asset);state.setWorkspace('xintai');
  const draft=state.referenceAsset(asset)!;expect(draft).toBeDefined();expect(draft.workspaceId).toBe('xintai');expect(draft.reference?.sourceId).not.toBe(asset.id);
  expect(useStudio.getState().assets.find(a=>a.id===draft.reference?.sourceId)?.workspaceId).toBe('xintai');
 });
 it('clears original ACP routing in adopted packages and nested work snapshots without touching source',()=>{
  const state=useStudio.getState(),studio={version:1,qa:{enabled:true,scope:'page',knowledge:{workspaceId:'source-private',fieldId:'private-acp-id',fieldName:'私有知识场',bindingRevision:1}}};
  const pkg={id:'private-pack',version:'1',prompt:'',files:[],skillIds:[],params:{presentationStudio:JSON.stringify(studio)},complete:true};
  const asset={...state.assets[0],id:'private-qa-bundle',workspaceId:'personal',source:'uploaded' as const,public:false,package:pkg,workSnapshot:{...state.works[0],pages:[],creationPackage:pkg}};
  state.addAsset(asset);state.setWorkspace('xintai');const adopted=state.adoptAsset(asset.id,'xintai')!;
  expect(adopted).toBeDefined();expect(JSON.stringify(adopted)).not.toContain('private-acp-id');expect(JSON.parse(adopted.package!.params.presentationStudio).qa.scope).toBe('page');expect(JSON.stringify(useStudio.getState().assets.find(a=>a.id===asset.id))).toContain('private-acp-id');
 });

});
