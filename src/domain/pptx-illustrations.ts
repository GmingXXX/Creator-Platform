import JSZip from 'jszip';
import {readBoundedEntry} from './document-intake';

export const imageRoles=['正文配图','品牌标识','图标／标记','背景装饰'] as const;
type Role=typeof imageRoles[number];
export type PptBox={x:number;y:number;w:number;h:number};
export type PptImage={file:File;pages:number[];role:Role;box?:PptBox};
const imageTypes:Record<string,string>={png:'image/png',jpeg:'image/jpeg',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
const nodes=(doc:Document|Element,local:string)=>Array.from(doc.getElementsByTagNameNS('*',local));
export function inferPptImageRole(name:string,area:number,repeat:boolean,master:boolean):Role{
 if(/logo|品牌|标识|商标/i.test(name))return '品牌标识';
 if(/背景|background/i.test(name)||area>.85)return '背景装饰';
 if(/icon|图标|标记/i.test(name))return '图标／标记';
 if((repeat||master)&&area>0&&area<.12)return '品牌标识';
 if(area>0&&area<.025)return '图标／标记';
 return master?'背景装饰':'正文配图';
}
export async function readPptImages(file:File):Promise<PptImage[]>{
 if(!/\.pptx$/i.test(file.name))return [];
 if(file.size>20*1024*1024)throw new Error('PPTX 超过 20 MB，请拆分读取');
 const zip=await JSZip.loadAsync(await file.arrayBuffer());let total=0;
 const read=async(path:string,limit:number)=>{const entry=zip.file(path);if(!entry)return;const size=(entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;if(!size||size>limit||total+size>36_000_000)throw new Error('图片资料过大，请拆分 PPTX');const bytes=await readBoundedEntry(entry,Math.min(limit,36_000_000-total));total+=bytes.byteLength;return bytes;};
 const parser=new DOMParser(),xml=async(path:string)=>{const bin=await read(path,2_000_000);if(!bin)return undefined;const source=new TextDecoder().decode(bin);if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('文档含不支持的 XML 声明');const doc=parser.parseFromString(source,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('PPTX 图片关系无法解析，请重新保存后导入');return doc};
 const dimensions=await xml('ppt/presentation.xml'),size=dimensions&&nodes(dimensions,'sldSz')[0],width=Number(size?.getAttribute('cx'))||12192000,height=Number(size?.getAttribute('cy'))||6858000,area=width*height;
 const pages=Object.keys(zip.files).filter(p=>/^ppt\/(?:slides\/slide|slideMasters\/slideMaster|slideLayouts\/slideLayout)\d+\.xml$/.test(p));
 if(pages.length>200)throw new Error('页面和母版数量过多，请拆分 PPTX');
 const resolve=(source:string,target:string)=>{const path=target.startsWith('/')?target.slice(1):source.slice(0,source.lastIndexOf('/')+1)+target;const parts:string[]=[];for(const component of path.split('/')){if(component==='..')parts.pop();else if(component&&component!=='.')parts.push(component)}return parts.join('/')};
 const presRel=await xml('ppt/_rels/presentation.xml.rels');
 const slideOrder=new Map<string,number>();
 if(presRel&&dimensions){const map=new Map(nodes(presRel,'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')||'']));nodes(dimensions,'sldId').forEach((el,i)=>{const id=el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');if(id&&map.has(id))slideOrder.set(resolve('ppt/presentation.xml',map.get(id)!),i+1)})}
 const inherited=new Map<string,string[]>();const pageIndexes=new Map<string,number>();
 const uses:{path:string;source:string;page:number;name:string;area:number;master:boolean;box?:PptBox}[]=[];
 for(const path of pages){
  const master=!path.includes('/slides/'),page=master?0:(slideOrder.get(path)||Number(path.match(/(\d+)\.xml$/)?.[1])),doc=await xml(path);
  if(!doc)continue;const rel=await xml(path.replace(/\/([^/]+)$/,'/_rels/$1.rels'));if(!rel)continue;
  if(!master)pageIndexes.set(path,page);
  inherited.set(path,nodes(rel,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External'&&/\/(slideLayout|slideMaster)$/.test(r.getAttribute('Type')||'')).map(r=>resolve(path,r.getAttribute('Target')||'')));
  const relationships=new Map(nodes(rel,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  for(const pic of nodes(doc,'pic')){
   const id=nodes(pic,'blip')[0]?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');
   const target=id&&relationships.get(id);if(!target)continue;const media=resolve(path,target);if(!/^ppt\/media\/[\w. -]+\.(png|jpe?g|webp|gif)$/i.test(media))continue;
   const prop=nodes(pic,'cNvPr')[0],extent=nodes(pic,'ext').find(e=>e.hasAttribute('cx'));
   const offset=nodes(pic,'off')[0],box=extent&&offset?{x:Number(offset.getAttribute('x'))/width,y:Number(offset.getAttribute('y'))/height,w:Number(extent.getAttribute('cx'))/width,h:Number(extent.getAttribute('cy'))/height}:undefined;
   uses.push({box,path:media,source:path,page,name:[prop?.getAttribute('name'),prop?.getAttribute('descr'),media].join(' '),area:Number(extent?.getAttribute('cx'))*Number(extent?.getAttribute('cy'))/area,master});
  }
 }
 const grouped=new Map<string,{path:string;pages:Set<number>;role:Role;box?:PptBox}>();
 for(const use of uses){
  const repeated=uses.some(v=>v.path===use.path&&v.source!==use.source&&Math.abs(v.area-use.area)<.005);
  const role=inferPptImageRole(use.name,use.area,repeated,use.master),key=use.source+'|'+use.path+'|'+JSON.stringify(use.box)+'|'+role;
  const record=grouped.get(key)||{path:use.path,pages:new Set<number>(),role,box:use.box};if(use.page)record.pages.add(use.page);else for(const [slide,index] of pageIndexes){const parents=inherited.get(slide)||[];if(parents.includes(use.source)||parents.some(parent=>inherited.get(parent)?.includes(use.source)))record.pages.add(index)}
  if(record.pages.size)grouped.set(key,record);
 }
 const result:PptImage[]=[];
 if(grouped.size>60)throw new Error('内嵌图片超过 60 项，请拆分资料');
 const mediaFiles=new Map<string,File>();
 for(const {path,pages:sourcePages,role,box} of grouped.values()){
  let file=mediaFiles.get(path);if(!file){const data=await read(path,8_000_000);if(!data)continue;const name=path.split('/').pop()!;file=new File([new Uint8Array(data).buffer],name,{type:imageTypes[name.split('.').pop()!.toLowerCase()]});mediaFiles.set(path,file)}
  result.push({file,pages:[...sourcePages].sort((a,b)=>a-b),role,box});
 }
 return result;
}
