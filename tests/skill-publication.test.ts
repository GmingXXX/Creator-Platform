import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
beforeEach(()=>useStudio.setState(createInitialData()));
describe('personal skills and reviewed community versions',()=>{
 it('publishes an independent approved snapshot without replacing the private skill',()=>{
  const state=useStudio.getState(),skill={...state.skills[0],id:'my-skill',personal:true,public:false,name:'我的时间轴'};state.addSkill(skill);
  const id=state.submitSkill(skill.id)!;expect(id).toBeTruthy();expect(state.submitSkill(skill.id)).toBe(id);
  expect(useStudio.getState().skills.some(s=>s.sourceSkillId===skill.id&&s.public)).toBe(false);
  state.addSkill({...skill,name:'私人后续修改'});state.setRole('reviewer');expect(state.reviewSubmission(id,'approved')).toBe(true);
  expect(useStudio.getState().skills.find(s=>s.id===skill.id)?.name).toBe('私人后续修改');
  expect(useStudio.getState().skills.find(s=>s.sourceSkillId===skill.id&&s.public)?.name).toBe('我的时间轴');
 });
 it('keeps old public version through rejection and withdrawal, then updates it on approval',()=>{
  const state=useStudio.getState(),skill={...state.skills[0],id:'my-skill',personal:true,public:false};state.addSkill(skill);state.setRole('reviewer');const first=state.submitSkill(skill.id)!;state.reviewSubmission(first,'approved');
  const old=useStudio.getState().skills.find(s=>s.sourceSkillId===skill.id&&s.public)!;
  state.addSkill({...skill,name:'新版'});const second=state.submitSkill(skill.id)!;expect(state.reviewSubmission(second,'rejected','补充预览')).toBe(true);expect(useStudio.getState().skills.find(s=>s.id===old.id)).toEqual(old);
  const third=state.submitSkill(skill.id)!;state.reviewSubmission(third,'withdrawn');expect(useStudio.getState().skills.find(s=>s.id===old.id)).toEqual(old);
  const fourth=state.submitSkill(skill.id)!;state.reviewSubmission(fourth,'approved');expect(useStudio.getState().skills.find(s=>s.id===old.id)?.name).toBe('新版');
 });
 it('adopts a pinned personal version once and preserves it when the community source changes',()=>{
  const state=useStudio.getState(),publicSkill=state.skills[0];const copy=state.adoptSkill(publicSkill.id)!;expect(copy.id).not.toBe(publicSkill.id);expect(copy.personal).toBe(true);expect(copy.public).toBe(false);
  expect(state.adoptSkill(publicSkill.id)?.id).toBe(copy.id);
  useStudio.setState(s=>({skills:s.skills.map(skill=>skill.id===publicSkill.id?{...skill,name:'新的公共版本',revision:2}:skill)}));
  const newer=state.adoptSkill(publicSkill.id)!;expect(newer.id).not.toBe(copy.id);expect(useStudio.getState().skills.find(s=>s.id===copy.id)?.name).toBe(publicSkill.name);
 });
 it('reuses the same adopted content when an unchanged skill is approved again',()=>{
  const state=useStudio.getState(),skill={...state.skills[0],id:'same-content',personal:true,public:false};state.addSkill(skill);state.setRole('reviewer');
  state.reviewSubmission(state.submitSkill(skill.id)!,'approved');const published=useStudio.getState().skills.find(item=>item.sourceSkillId===skill.id&&item.public)!;
  const adopted=state.adoptSkill(published.id)!;
  state.reviewSubmission(state.submitSkill(skill.id)!,'approved');expect(state.adoptSkill(published.id)?.id).toBe(adopted.id);
  expect(useStudio.getState().skills.filter(item=>item.origin?.skillId===published.id)).toHaveLength(1);
  state.addSkill({...skill,steps:[...skill.steps,'新增内容校对']});state.reviewSubmission(state.submitSkill(skill.id)!,'approved');expect(state.adoptSkill(published.id)?.id).not.toBe(adopted.id);
 });
 it('rejects missing or public submissions and adoption of another private skill',()=>{
  const state=useStudio.getState();expect(state.submitSkill('missing')).toBeUndefined();expect(state.submitSkill(state.skills[0].id)).toBeUndefined();expect(state.adoptSkill('missing')).toBeUndefined();
  state.addSkill({...state.skills[0],id:'private',personal:true,public:false});expect(state.adoptSkill('private')).toBeUndefined();
  state.addSkill({...state.skills[0],id:'invalid-private',personal:true,public:false,steps:[]});expect(state.submitSkill('invalid-private')).toBeUndefined();
 });
});
