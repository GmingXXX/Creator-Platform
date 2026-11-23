import {describe,it,expect} from 'vitest';
import JSZip from 'jszip';
import {buildPresentationPptx} from '../src/domain/presentation-export';
import {buildPresentationWork} from '../src/domain/presentation-generation';
const work=()=>buildPresentationWork({title:'上传大纲生成',sections:[{title:'绿色产线',narration:'能耗降低12%，资料来源为模拟企业大纲。',bullets:['产能提升18%','能耗降低12%'],layout:'bullets'}]},{prompt:'模拟企业介绍',styleId:'technology',model:'deepseek-flash',workspaceId:'personal',width:1920,height:1080,assets:[],referenceText:'模拟企业数据'});
describe('editable presentation PPTX',()=>{
 it('writes readable OOXML with actual page body and speaker notes',async()=>{const bytes=await buildPresentationPptx(work()),zip=await JSZip.loadAsync(bytes);expect(zip.file('ppt/slides/slide1.xml')).toBeTruthy();expect(await zip.file('ppt/slides/slide1.xml')!.async('string')).toContain('能耗降低12%');expect(await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string')).toContain('模拟企业大纲');expect(await zip.file('ppt/presentation.xml')!.async('string')).toContain('12192000');});
 it('preserves edited text typography in PPTX',async()=>{
  const value=work();value.pages[0].nodes=value.pages[0].nodes.map(n=>({...n,fontFamily:'Arial, sans-serif',fontWeight:700,textAlign:'center',lineHeight:1.5}));
  const zip=await JSZip.loadAsync(await buildPresentationPptx(value));const xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  expect(xml).toContain('typeface="Arial"');expect(xml).toContain('algn="ctr"');expect(xml).toContain('b="1"');expect(xml).toContain('150000');
 });
 it('keeps independent compound title and body font properties',async()=>{
  const value=work();value.pages[0].nodes=[{...value.pages[0].nodes[0],type:'card',items:[{id:'i',title:'组件标题',description:'组件正文'}],titleStyle:{fontFamily:'Georgia',fontWeight:700,color:'#112233'},bodyStyle:{fontFamily:'Arial',fontSize:24,color:'#445566'}}];
  const zip=await JSZip.loadAsync(await buildPresentationPptx(value));const xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  expect(xml).toContain('typeface="Georgia"');expect(xml).toContain('typeface="Arial"');expect(xml).toContain('112233');expect(xml).toContain('445566');
 });
 it('embeds an actual PNG image with supported image-size dependency',async()=>{
  const value=work(),pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=';
  value.pages[0].nodes.push({...value.pages[0].nodes[0],id:'export-image',type:'image',name:'实际 PNG',src:'/test.png',x:1200,y:400,w:400,h:400});
  const zip=await JSZip.loadAsync(await buildPresentationPptx(value,async()=>`data:image/png;base64,${pixel}`));
  const image=Object.keys(zip.files).find(name=>name.startsWith('ppt/media/')&&name.endsWith('.png'));
  expect(image).toBeTruthy();expect(Buffer.from(await zip.file(image!)!.async('uint8array')).equals(Buffer.from(pixel,'base64'))).toBe(true);
  expect(await zip.file('ppt/slides/slide1.xml')!.async('string')).toContain('<p:pic>');
 });
 it('does not silently strip dynamic media',async()=>{const value=work();value.pages[0].nodes.push({...value.pages[0].nodes[0],type:'html',name:'交互模块'});await expect(buildPresentationPptx(value)).rejects.toThrow('动态素材');});
});
