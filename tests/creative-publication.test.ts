import {describe,it,expect,beforeEach} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {organizeExperience,editExperience} from '../src/domain/creation-experience';
import {publicWorkSnapshot,publicAssetSnapshot} from '../src/domain/creative-publication';
beforeEach(()=>useStudio.setState(createInitialData()));
const packaged=async()=>{
 const state=useStudio.getState(),work=state.works.find(w=>(w.workspaceId||'personal')==='personal')!;
 const summary=await organizeExperience(work.id,{model:'demo'});
 const updated=editExperience(work.id,{...summary.experience!.sections,lessons:'尚未公开的客户决策'});
 return {...updated,creationPackage:{id:'pack',version:'1',prompt:'已有制作说明',files:[],skillIds:[],params:{experienceWorkId:work.id,model:'demo'},complete:true,experience:updated.experience}};
};
describe('publication excludes private creative records',()=>{
 it('publishes reusable work content without summary, history or internal references',async()=>{
  const original=await packaged();const safe=publicWorkSnapshot(original);
  expect(safe.experience).toBeUndefined();expect(safe.creationPackage?.experience).toBeUndefined();expect(safe.creationPackage?.params.experienceWorkId).toBeUndefined();
  expect(safe.pages).toEqual(original.pages);expect(JSON.stringify(safe)).not.toContain('尚未公开');expect(original.experience?.sections.lessons).toContain('尚未公开');
 });
 it('does not publish private Skill definitions through a work package',async()=>{
  const work=await packaged(),skill={...useStudio.getState().skills.find(item=>item.personal)!,id:'private-method',public:false,description:'未公开方法与客户决策'};
  const source={...work,creationPackage:{...work.creationPackage,skillIds:[skill.id],skillSnapshots:[skill]}};
  const published=publicWorkSnapshot(source);expect(JSON.stringify(published)).not.toContain('未公开方法');expect(published.creationPackage?.skillIds).not.toContain(skill.id);expect(source.creationPackage.skillSnapshots).toHaveLength(1);
 });
 it('strips linked media summary and nested engineering snapshots',async()=>{
  const work=await packaged(),asset={...useStudio.getState().assets[0],package:work.creationPackage,workSnapshot:work};
  expect(JSON.stringify(publicAssetSnapshot(asset))).not.toContain('尚未公开');expect(publicAssetSnapshot(asset).package?.params.experienceWorkId).toBeUndefined();
 });
 it('cleans new submissions and rechecks old pending snapshots at approval',async()=>{
  const work=await packaged(),state=useStudio.getState();useStudio.setState(s=>({works:s.works.map(item=>item.id===work.id?work:item)}));
  const id=state.submitWork(work.id)!;expect(JSON.stringify(useStudio.getState().submissions.find(s=>s.id===id)?.work)).not.toContain('尚未公开');
  useStudio.setState(s=>({role:'reviewer',submissions:s.submissions.map(sub=>sub.id===id?{...sub,work}:sub)}));
  expect(state.reviewSubmission(id,'approved')).toBe(true);expect(JSON.stringify(useStudio.getState().templates.find(t=>t.work.id===work.id))).not.toContain('尚未公开');
 });
 it('strips private ACP routing from published work and nested asset packages while preserving presentation settings',async()=>{
  const original=await packaged(),studio={version:1,rate:1.25,pages:{slide:{sentences:[{text:'公开讲稿'}]}},qa:{enabled:true,scope:'page',includeReferences:false,knowledge:{workspaceId:'private-space',fieldId:'private-acp-id',fieldName:'私有知识场',bindingRevision:3},extraReference:'公开补充',suggestions:['问题']}};
  const work={...original,creationPackage:{...original.creationPackage,params:{...original.creationPackage.params,presentationStudio:JSON.stringify(studio)}}};
  const expected={...studio,qa:{...studio.qa,knowledge:undefined}};
  const published=publicWorkSnapshot(work),asset=publicAssetSnapshot({...useStudio.getState().assets[0],package:work.creationPackage,workSnapshot:work});
  expect(JSON.parse(published.creationPackage!.params.presentationStudio)).toEqual(JSON.parse(JSON.stringify(expected)));
  for(const value of [published,asset]){expect(JSON.stringify(value)).not.toContain('private-acp-id');expect(JSON.stringify(value)).not.toContain('私有知识场');expect(JSON.stringify(value)).not.toContain('private-space');}
  expect(JSON.parse(asset.package!.params.presentationStudio)).toEqual(JSON.parse(JSON.stringify(expected)));expect(work.creationPackage.params.presentationStudio).toBe(JSON.stringify(studio));
 });
 it('drops unreadable serialized presentation settings at publication instead of forwarding private routing',async()=>{
  const original=await packaged();for(const raw of ['{bad private-acp-id','null','["private-acp-id"]']){
   const work={...original,creationPackage:{...original.creationPackage,params:{...original.creationPackage.params,presentationStudio:raw}}};
   expect(publicWorkSnapshot(work).creationPackage?.params.presentationStudio).toBeUndefined();
  }
 });

});
