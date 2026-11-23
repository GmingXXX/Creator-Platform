import {describe,it,expect} from 'vitest';
import JSZip from 'jszip';
import {extractDocumentText} from '../src/domain/document-intake';
describe('shared document intake',()=>{
 it('reads exact text and CSV instead of filename metadata',async()=>{expect(await extractDocumentText(new File(['年份,事件\n2024,储能中心投产'], '事件.csv'))).toContain('2024,储能中心投产');});
 it('reads document paragraphs and escaped text',async()=>{const z=new JSZip();z.file('word/document.xml','<w:document><w:p><w:r><w:t>星澜&amp;智造</w:t></w:r></w:p><w:p><w:r><w:t>2024年投产</w:t></w:r></w:p></w:document>');const f=new File([await z.generateAsync({type:'uint8array'})],'资料.docx');expect(await extractDocumentText(f)).toContain('星澜&智造\n2024年投产');});
 it('reads PPTX slides in numeric order',async()=>{const z=new JSZip();for(const i of [10,2,1])z.file(`ppt/slides/slide${i}.xml`,`<a:p><a:t>第${i}页</a:t></a:p>`);expect(await extractDocumentText(new File([await z.generateAsync({type:'uint8array'})],'大纲.pptx'))).toMatch(/第1页[\s\S]*第2页[\s\S]*第10页/);});
 it('rejects unsupported binary formats without claiming extraction',async()=>{expect(await extractDocumentText(new File(['pdf'],'资料.pdf'))).toBe('');});
 it('rejects corrupt office packages with clear error',async()=>{await expect(extractDocumentText(new File(['invalid'],'资料.docx'))).rejects.toThrow();});
 it('stops forged-size office documents at the actual decompression limit',async()=>{
  const zip=new JSZip();zip.file('word/document.xml','x'.repeat(3_000_000));
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let i=0;i<bytes.length-28;i++){
   const signature=view.getUint32(i,true);
   if(signature===0x04034b50)view.setUint32(i+22,1,true);
   if(signature===0x02014b50)view.setUint32(i+24,1,true);
  }
  await expect(extractDocumentText(new File([bytes],'伪造尺寸.docx'))).rejects.toThrow('文档实际解压大小超过限制');
 });
 it('rejects a declared oversized document before extraction',async()=>{
  const zip=new JSZip();zip.file('word/document.xml','x'.repeat(2_000_001));
  await expect(extractDocumentText(new File([await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})],'超限.docx'))).rejects.toThrow('文档展开内容过大');
 });
 it('enforces the total expansion budget across PPTX slides',async()=>{
  const zip=new JSZip();for(let i=1;i<=5;i++)zip.file(`ppt/slides/slide${i}.xml`,`<!--${'x'.repeat(1_700_000)}-->`);
  await expect(extractDocumentText(new File([await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})],'过大.pptx'))).rejects.toThrow('文档展开内容过大');
 });
});
