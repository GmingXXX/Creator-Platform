import JSZip from 'jszip';
import type {Asset} from './types';
import {readMediaBlob} from './upload';
export interface SourceFile {asset:Asset;text:string;status:string}
const MAX_TEXT=24000;
const MAX_ENTRY_BYTES=2_000_000;
const MAX_EXPANDED_BYTES=8_000_000;
const entities=(text:string)=>text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,key:string)=>{
 if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[key]||'';
});
function xmlText(xml:string){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('文档含不支持的 XML 声明');
 return xml.split(/<\/(?:\w+:)?p\s*>/).map(paragraph=>[...paragraph.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t\s*>/g)].map(match=>entities(match[1].replace(/<[^>]*>/g,''))).join('')).filter(Boolean).join('\n');
}
export function readBoundedEntry(entry:JSZip.JSZipObject,maxBytes:number):Promise<Uint8Array>{
 const stream=(entry as JSZip.JSZipObject & {internalStream:(type:'uint8array')=>JSZip.JSZipStreamHelper<Uint8Array>}).internalStream('uint8array');
 return new Promise((resolve,reject)=>{
  const chunks:Uint8Array[]=[];
  let total=0,settled=false;
  stream.on('data',chunk=>{
   if(settled)return;
   total+=chunk.length;
   if(total>maxBytes){settled=true;stream.pause();reject(new Error('文档实际解压大小超过限制，请拆分后读取'));return;}
   chunks.push(chunk);
  }).on('error',()=>{
   if(!settled){settled=true;reject(new Error('文档压缩内容损坏，请重新上传'));}
  }).on('end',()=>{
   if(settled)return;
   settled=true;
   const result=new Uint8Array(total);let offset=0;
   for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
   resolve(result);
  }).resume();
 });
}
export async function extractDocumentText(file:File):Promise<string>{
 if(file.size>20*1024*1024)throw new Error('文档超过 20 MB，请拆分后读取');
 if(/\.(txt|md|csv|json)$/i.test(file.name))return (await file.text()).slice(0,MAX_TEXT);
 if(!/\.(docx|pptx)$/i.test(file.name))return '';
 const zip=await JSZip.loadAsync(await file.arrayBuffer());
 const paths=Object.keys(zip.files).filter(path=>/^(word\/document\.xml|ppt\/slides\/slide\d+\.xml)$/.test(path)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 if(!paths.length)throw new Error('文档没有可读取的正文');
 if(paths.length>100)throw new Error('文档超过 100 页，请拆分后读取');
 let expanded=0,result='';
 for(const path of paths){
  const entry=zip.file(path)!;const size=(entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
  if(typeof size!=='number'||!Number.isSafeInteger(size)||size<0||size>MAX_ENTRY_BYTES||expanded+size>MAX_EXPANDED_BYTES)throw new Error('文档展开内容过大，请拆分后读取');
  const bytes=await readBoundedEntry(entry,Math.min(MAX_ENTRY_BYTES,MAX_EXPANDED_BYTES-expanded));
  expanded+=bytes.byteLength;
  const xml=new TextDecoder().decode(bytes);
  result+=`${path.startsWith('ppt/')?`[第 ${path.match(/slide(\d+)/)?.[1]} 页]\n`:''}${xmlText(xml)}\n`;
  if(result.length>=MAX_TEXT)break;
 }
 return result.trim().slice(0,MAX_TEXT);
}
export async function readAssetSource(asset:Asset):Promise<SourceFile>{
 if(!['document','presentation'].includes(asset.kind))return {asset,text:'',status:asset.package?.params.knowledgeCatalogId?'知识引用素材 · 请核对对应关系':'已上传素材 · 请核对对应关系'};
 try{
  const blob=asset.src.startsWith('idb:')?await readMediaBlob(asset.src):await readLocalResource(asset.src);
  const text=await extractDocumentText(new File([blob],asset.name,{type:blob.type}));
  return {asset,text,status:text?text.length>=MAX_TEXT?'已解析 · 已截取前 24000 字，请核对范围':'已解析正文':'此格式暂不支持正文解析，请提供 TXT、CSV、DOCX 或 PPTX'};
 }catch(error){return {asset,text:'',status:`解析未完成：${error instanceof Error?error.message:'请重新上传'}`};}
}
async function readLocalResource(src:string):Promise<Blob>{
 if(!src.startsWith('/')||src.startsWith('//'))throw new Error('参考文档需要先上传到素材库');
 const response=await fetch(src);if(!response.ok)throw new Error('参考文档读取失败');return response.blob();
}
export async function readAssetSources(assets:Asset[]):Promise<SourceFile[]>{
 const result:SourceFile[]=[];for(const asset of assets)result.push(await readAssetSource(asset));return result;
}
