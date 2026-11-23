import JSZip from 'jszip';
import {extractDocumentText} from './document-intake';
import {readComponentArchive} from './component-import-archive';
import {parseSkillPackage} from './skill-package';
import type {Asset} from './types';

export type AttachmentFile={file:File;relativePath:string};
const MAX_FILES=200,MAX_BYTES=300*1024*1024;
const ignored=(path:string)=>path.split('/').some(part=>['.DS_Store','__MACOSX','.git','node_modules'].includes(part)||part.startsWith('._'));
function validatePath(path:string){if(!path||path.startsWith('/')||path.includes('\\')||path.includes('\0')||/^[a-z]:/i.test(path)||path.split('/').some(part=>part==='..'||part==='.'||!part))throw new Error('文件路径无效，请检查资料目录。');if(path.split('/').length>20)throw new Error('目录层级过深，最多支持 20 层。');}
function validateEntries(entries:AttachmentFile[]):AttachmentFile[]{const paths=new Set<string>();let size=0;return entries.filter(({file,relativePath})=>{validatePath(relativePath);if(ignored(relativePath))return false;if(paths.has(relativePath))throw new Error(`存在重复文件路径：${relativePath}`);paths.add(relativePath);size+=file.size;if(paths.size>MAX_FILES||size>MAX_BYTES)throw new Error('每次最多添加 200 个文件，总大小不超过 300 MB。');return true;});}
export function filesWithPaths(files:Iterable<File>):AttachmentFile[]{return validateEntries([...files].map(file=>({file,relativePath:file.webkitRelativePath||file.name})));}

type Entry={isFile:boolean;isDirectory:boolean;name:string;file?:(ok:(file:File)=>void,fail:(error:DOMException)=>void)=>void;createReader?:()=>{readEntries:(ok:(entries:Entry[])=>void,fail:(error:DOMException)=>void)=>void}};
export async function collectDroppedFiles(transfer:DataTransfer):Promise<AttachmentFile[]>{
 // Capture handles during the drop event: browser data-transfer access closes after it returns.
 const roots=[...transfer.items].map(item=>item.webkitGetAsEntry?.() as Entry|null).filter((entry):entry is Entry=>!!entry);
 const fallback=[...transfer.files];if(!roots.length)return filesWithPaths(fallback);
 let result:AttachmentFile[]=[];let visited=0;
 const walk=async(entry:Entry,parent=''):Promise<void>=>{
  const path=parent?`${parent}/${entry.name}`:entry.name;validatePath(path);if(ignored(path))return;
  if(++visited>1000)throw new Error('目录项过多，请分批添加。');
  if(entry.isFile&&entry.file){const file=await new Promise<File>((resolve,reject)=>entry.file!(resolve,reject));result=validateEntries([...result,{file,relativePath:path}]);return;}
  if(entry.isDirectory&&entry.createReader){const reader=entry.createReader();while(true){const children=await new Promise<Entry[]>((resolve,reject)=>reader.readEntries(resolve,reject));if(!children.length)break;for(const child of children)await walk(child,path);}}
 };
 for(const root of roots)await walk(root);return result;
}

/** Component/skill directories are packaged whole; ordinary folders remain individual source documents. */
export async function prepareFolderPackages(input:AttachmentFile[]):Promise<AttachmentFile[]>{
 const entries=validateEntries(input);const roots=[...new Set(entries.filter(e=>e.relativePath.includes('/')).map(e=>e.relativePath.split('/')[0]))];
 const packages:AttachmentFile[]=[];const packed=new Set<string>();
 for(const root of roots){const group=entries.filter(e=>e.relativePath.startsWith(`${root}/`));
  if(!group.some(e=>new RegExp(`^(?:component\\.json|SKILL\\.md|index\\.html?)$`,'i').test(e.relativePath.slice(root.length+1))))continue;
  if(group.reduce((total,entry)=>total+entry.file.size,0)>40*1024*1024)throw new Error('组件或技能文件夹请控制在 40 MB 以内，保留必要依赖后重试。');
  const zip=new JSZip();for(const entry of group)zip.file(entry.relativePath.slice(root.length+1),await entry.file.arrayBuffer());
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});packages.push({file:new File([bytes as Uint8Array<ArrayBuffer>],`${root}.zip`,{type:'application/zip'}),relativePath:`${root}.zip`});packed.add(root);
 }
 return [...entries.filter(e=>!packed.has(e.relativePath.split('/')[0])),...packages];
}

export async function describeAttachment(file:File):Promise<Pick<NonNullable<Asset['intake']>,'status'|'packageKind'>>{
 if(/\.zip$/i.test(file.name)){
  if(file.size>50*1024*1024)throw new Error('ZIP 文件请控制在 50 MB 以内。');
  const bytes=new Uint8Array(await file.arrayBuffer());const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files);
  if(entries.length>1000)throw new Error('ZIP 文件目录过多，请精简后上传。');
  for(const entry of entries){const original=(entry as typeof entry&{unsafeOriginalName?:string}).unsafeOriginalName||entry.name;validatePath(original.replace(/\/$/,''));}
  if(entries.some(entry=>/(^|\/)SKILL\.md$/i.test(entry.name))){await parseSkillPackage(bytes,file.name);return{packageKind:'skill',status:'已识别技能包 · 完整保留，未启用'};}
  if(entries.some(entry=>/\.html?$/i.test(entry.name)||/(^|\/)component\.json$/i.test(entry.name))){await readComponentArchive(file);return{packageKind:'component',status:'已识别组件包 · 依赖完整保留'};}
  return{packageKind:'archive',status:'已保留压缩包 · 未解析包内正文'};
 }
 if(/\.(txt|md|csv|json|docx|pptx|pdf|doc|ppt|xls|xlsx)$/i.test(file.name)){
  try{const text=await extractDocumentText(file);return{status:text.trim()?`已解析正文${text.length>=24000?' · 已截取前 24000 字':''}`:'已上传 · 此格式暂不支持正文解析'};}
  catch(error){return{status:`解析未完成：${error instanceof Error?error.message:'请检查文件'}`};}
 }
 return{status:'已上传素材 · 待匹配用途'};
}
