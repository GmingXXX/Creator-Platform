import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {migrateWorkspaceDemos} from '../src/domain/workspace-demo-seeds';
import {resourceInView,skillAvailableInSpace} from '../src/domain/resource-sharing';
import {getWorkPurposes} from '../src/domain/project-taxonomy';
import {extractDocumentText} from '../src/domain/document-intake';

describe('preset workspace demo resources',()=>{
 it('provides small themed working sets and leaves personal resources unchanged',()=>{
  const data=createInitialData();
  for(const id of ['xintai','dongguan','aitown']){
   const works=data.works.filter(work=>work.workspaceId===id),assets=data.assets.filter(asset=>asset.workspaceId===id),skills=data.skills.filter(skill=>skill.workspaceId===id);
   expect(works).toHaveLength(2);expect(assets).toHaveLength(3);expect(skills).toHaveLength(1);
   expect(works.every(work=>work.title.includes('演示')&&work.pages.length>0)).toBe(true);
   expect(assets.every(asset=>!asset.public&&resourceInView(asset,'shared',id)&&asset.description.includes('模拟'))).toBe(true);
   expect(skills[0]).toMatchObject({personal:true,public:false,enabled:true});
   expect(skillAvailableInSpace(skills[0],id)).toBe(true);expect(skillAvailableInSpace(skills[0],'personal')).toBe(false);
   for(const asset of assets){expect(existsSync(`public${asset.src}`)).toBe(true);expect(existsSync(`public${asset.preview}`)).toBe(true);expect(asset.knowledgeTarget).toBeUndefined();}
   for(const work of works){expect(work.creationPackage?.skillIds).toEqual([skills[0].id]);expect(work.cover).toBe(assets[0].src);expect(getWorkPurposes(work)).toEqual([id==='xintai'?'history':id==='dongguan'?'knowledge':'ecosystem']);}
  }
  expect(data.works.filter(work=>!work.workspaceId||work.workspaceId==='personal')).toHaveLength(6);
  expect(data.workspaceKnowledge).toEqual({});
 });
 it('has valid node links and only references assets within the owning workspace',()=>{
  const data=createInitialData();
  for(const work of data.works.filter(work=>work.id.startsWith('workspace-demo-'))){
   const assets=data.assets.filter(asset=>asset.workspaceId===work.workspaceId);
   for(const page of work.pages){expect(page.nodes.some(node=>node.type==='text'&&node.content.includes('模拟'))).toBe(true);for(const node of page.nodes)for(const item of node.items||[])expect(assets.some(asset=>asset.id===item.assetId)).toBe(true);}
   for(const edge of work.storyEdges||[]){expect(work.storyNodes?.some(node=>node.id===edge.source)).toBe(true);expect(work.storyNodes?.some(node=>node.id===edge.target)).toBe(true);}
   for(const media of work.creationPackage?.files||[])if(media.src)expect(existsSync(`public${media.src}`)).toBe(true);
  }
 });
 it('adds missing examples once without overwriting edited or deleted existing rows',()=>{
  const initial=createInitialData(),existing={...initial.works.find(work=>work.id.startsWith('workspace-demo-'))!,title:'用户修改保留',deletedAt:'2026-11-17'};
  const old={...initial,workspaceDemoVersion:undefined,works:[existing],assets:[],skills:[]};
  const migrated=migrateWorkspaceDemos(old);expect(old.works).toEqual([existing]);expect(migrated.works.find(work=>work.id===existing.id)).toBe(existing);
  expect(migrated.works).toHaveLength(6);expect(migrated.workspaceDemoVersion).toBe(1);
  const deleted={...migrated,works:[],assets:[],skills:[]};expect(migrateWorkspaceDemos(deleted)).toBe(deleted);
 });
 it('does not populate user-created spaces or restore deliberately removed presets',()=>{
  const data=createInitialData(),custom={id:'custom-demo',name:'客户项目',description:'',color:'#123'};
  const empty={...data,workspaceDemoVersion:undefined,workspaces:[data.workspaces[0],custom],works:[],assets:[],skills:[]};
  const result=migrateWorkspaceDemos(empty);expect(result.works).toEqual([]);expect(result.assets).toEqual([]);expect(result.skills).toEqual([]);
 });
 it('runs the upgrade for older saved state even when current seed already has a marker',()=>{
  const current=useStudio.getState(),old={...createInitialData(),workspaceDemoVersion:undefined,works:[],assets:[],skills:[]};
  const restored=useStudio.persist.getOptions().merge!(old,current);
  expect(restored.works.filter(work=>work.workspaceId==='dongguan')).toHaveLength(2);expect(restored.workspaceDemoVersion).toBe(1);
  const saved={...restored,works:restored.works.filter(work=>work.workspaceId!=='dongguan')};
  expect(useStudio.persist.getOptions().merge!(saved,current).works.filter(work=>work.workspaceId==='dongguan')).toHaveLength(0);
 });
 it('exposes parseable documents that identify simulated facts and illustrations',async()=>{
  for(const asset of createInitialData().assets.filter(asset=>asset.id.startsWith('workspace-demo-')&&asset.kind==='document')){
   const text=await extractDocumentText(new File([readFileSync(`public${asset.src}`)],asset.name));
   expect(text).toContain('模拟');expect(text).toContain('不代表客户真实事实');
  }
 });
});
