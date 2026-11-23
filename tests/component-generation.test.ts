import {describe,it,expect,vi,beforeEach} from 'vitest';
import JSZip from 'jszip';
import {inspectComponentFile} from '../src/domain/component-import';
import {parseComponentPlan,buildComponentPackage,generateComponentPackage,componentPlanToFields} from '../src/domain/component-generation';
vi.mock('../src/domain/ai-client',()=>({aiChat:vi.fn()}));
import {aiChat} from '../src/domain/ai-client';
const plan={name:'星澜智造成果卡',title:'让创新成为可见成果',intro:'以下为模拟企业演示数据',accent:'#63cdda',background:'#102331',columns:3,tilt:7,cards:[{title:'智慧产线',value:'3条',body:'模拟资料中已投产的智慧产线'},{title:'研发平台',value:'2个',body:'材料与数字制造平台'},{title:'服务网络',value:'12城',body:'覆盖十二个城市'}]};
beforeEach(()=>vi.clearAllMocks());
describe('controlled component generation',()=>{
 it('validates generated content and rejects incomplete or unsafe styles',()=>{
  expect(parseComponentPlan(JSON.stringify(plan))).toEqual(plan);
  expect(()=>parseComponentPlan('{}')).toThrow();
  expect(()=>parseComponentPlan(JSON.stringify({...plan,cards:[]}))).toThrow('卡片');
  expect(()=>parseComponentPlan(JSON.stringify({...plan,accent:'red; background:url(https://x)'}))).toThrow('颜色');
  expect(()=>parseComponentPlan(JSON.stringify({...plan,columns:9}))).toThrow('列数');
  expect(()=>parseComponentPlan(JSON.stringify({...plan,cards:[{title:'x',body:'y',value:42}]}))).toThrow();
 });
 it('creates an inspectable ZIP with no external dependencies and 6 real editing fields',async()=>{
  const file=await buildComponentPackage(plan,{prompt:'为星澜展示成果',model:'deepseek-flash'});
  const inspection=await inspectComponentFile(file);
  expect(inspection).toMatchObject({canPreview:true,bridge:'zhichuang-component-v1',dependencies:[]});
  expect(inspection!.fields).toHaveLength(6);expect(inspection!.defaults.cardsText).toContain('智慧产线｜3条｜');
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['component.json','index.html','cards.css','cards.js','README.md','generation.json']));
  expect(await zip.file('cards.js')!.async('string')).toContain('textContent');
  expect(await zip.file('cards.js')!.async('string')).not.toMatch(/innerHTML|eval\(|new Function/);
 });
 it('writes saved trial values into the ZIP so reupload keeps the latest configuration',async()=>{
  const fields=componentPlanToFields(plan),values=Object.fromEntries(fields.map(f=>[f.key,f.default]));
  const file=await buildComponentPackage(plan,{prompt:'企业成果',model:'deepseek-flash'},{...values,title:'保存后的标题',cardsText:'新成果｜9项｜保存后的说明',accent:'#334455',columns:1,tilt:0});
  const inspection=await inspectComponentFile(file);expect(inspection?.defaults).toMatchObject({title:'保存后的标题',cardsText:'新成果｜9项｜保存后的说明',accent:'#334455',columns:1,tilt:0});
  expect(inspection?.canPreview).toBe(true);
  await expect(buildComponentPackage(plan,{prompt:'企业成果',model:'deepseek-flash'},{...values,cardsText:'未填完整'})).rejects.toThrow('每行');
 });
 it('keeps model text as literal data, never executable HTML or code',async()=>{
  const malicious={...plan,title:'</script><img src=x onerror=alert(1)>',cards:[{title:'<b>名称</b>',value:'1',body:'<script>alert(1)</script>'}]};
  const file=await buildComponentPackage(malicious,{prompt:'测试',model:'deepseek-flash'}),zip=await JSZip.loadAsync(await file.arrayBuffer());
  const html=await zip.file('index.html')!.async('string');expect(html).not.toContain('<img src=x');expect(html).not.toContain('onerror=alert');
  expect(await zip.file('cards.js')!.async('string')).not.toContain('<script>alert(1)</script>');
  expect(componentPlanToFields(malicious).find(x=>x.key==='title')?.default).toBe(malicious.title);
 });
 it('passes actual requirements, style, skill and source text to the chosen model',async()=>{
  vi.mocked(aiChat).mockResolvedValue({content:JSON.stringify(plan),model:'deepseek-flash'});
  const input={prompt:'展示三项成果，科技青色',model:'deepseek-flash',style:{name:'科技风',accent:'#63cdda'},skills:[{name:'成果编排',steps:['从原文提取数值']}],referenceText:'已建3条产线、2个研发平台，覆盖12城。'};
  const result=await generateComponentPackage(input);
  const [model,messages]=vi.mocked(aiChat).mock.calls[0];expect(model).toBe(input.model);
  expect(messages.map(m=>m.content).join('\n')).toContain(input.referenceText);expect(messages.map(m=>m.content).join('\n')).toContain('从原文提取数值');
  expect(result.plan.title).toBe(plan.title);expect(result.inspection.canPreview).toBe(true);
 });
 it('rejects unsupported demo models, bad request limits and cancellation before network or packaging',async()=>{
  await expect(generateComponentPackage({prompt:'企业成果',model:'demo'})).rejects.toThrow('真实模型');
  await expect(generateComponentPackage({prompt:' ',model:'deepseek-flash'})).rejects.toThrow('需求');
  const controller=new AbortController();controller.abort();await expect(generateComponentPackage({prompt:'企业成果',model:'deepseek-flash'},controller.signal)).rejects.toThrow('停止');
  expect(aiChat).not.toHaveBeenCalled();
 });
});
