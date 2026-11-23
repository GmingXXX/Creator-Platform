import {beforeEach,describe,expect,it} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {getWorkDisplayForm,getWorkPurposes,publicationCategoryError} from '../src/domain/project-taxonomy';
import {filterWorks} from '../src/features/resources/helpers';
beforeEach(()=>useStudio.setState(createInitialData()));
const make=()=>useStudio.getState().createWork({title:'未分类项目',type:'卡片浏览型',displayForm:null,contentPurposes:[],width:1920,height:1080});
describe('optional display classification',()=>{
 it('keeps explicit none through creation, saving and copying without inference',()=>{
  const work=make();expect(getWorkDisplayForm(work)).toBeNull();expect(getWorkPurposes(work)).toEqual([]);
  useStudio.getState().saveWork({...work,title:'企业发展历程'});
  const copy=useStudio.getState().duplicateWork(work.id)!;
  expect(copy.displayForm).toBeNull();expect(getWorkPurposes(copy)).toEqual([]);
 });
 it('retains classifications on legacy works and uses explicit form when supplied',()=>{
  const work=createInitialData().works[0];expect(getWorkDisplayForm(work)).toBe(work.type);
  expect(getWorkDisplayForm({...work,displayForm:'关系图谱型'})).toBe('关系图谱型');
 });
 it('does not match an internal composition type when user selected none',()=>{
  const work=make();const filters={query:'',type:'卡片浏览型',time:'全部时间',sort:'recent',archived:false};
  expect(filterWorks([work],filters)).toEqual([]);
  expect(filterWorks([{...work,displayForm:'卡片浏览型'}],filters)).toHaveLength(1);
 });
 it('requires content OR form at submission and approval boundaries',()=>{
  const work=make();expect(publicationCategoryError(work)).toContain('至少');
  expect(()=>useStudio.getState().submitWork(work.id)).toThrow('至少');
  useStudio.getState().saveWork({...work,contentPurposes:['history']});
  const submission=useStudio.getState().submitWork(work.id)!;expect(submission).toBeTruthy();
  useStudio.getState().setRole('reviewer');expect(useStudio.getState().reviewSubmission(submission,'approved')).toBe(true);
  const template=useStudio.getState().templates.find(item=>item.work.id===work.id)!;
  expect(getWorkDisplayForm(template.work)).toBeNull();expect(template.work.contentPurposes).toEqual(['history']);
 });
 it('accepts form only and both, rejecting unknown form values',()=>{
  const work=make();expect(publicationCategoryError({...work,displayForm:'时间演进型'})).toBeUndefined();
  expect(publicationCategoryError({...work,displayForm:'时间演进型',contentPurposes:['history']})).toBeUndefined();
  expect(publicationCategoryError({...work,displayForm:'invalid' as never})).toBeTruthy();
 });
 it('blocks approval of an unclassified submission even if inserted outside the dialog',()=>{
  const work=make();useStudio.setState({role:'reviewer',submissions:[{id:'uncategorized',kind:'template',name:work.title,work,author:'纪鸣',createdAt:work.createdAt,status:'pending',revision:1}]});
  expect(useStudio.getState().reviewSubmission('uncategorized','approved')).toBe(false);
  expect(useStudio.getState().submissions[0].status).toBe('pending');
 });
});
