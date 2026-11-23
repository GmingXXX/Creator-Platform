import {resolveFontFamily} from './text-style';
import type {TextAppearance,Work} from './types';
import {resolveMedia} from './upload';
const hex=(value:string,fallback='FFFFFF')=>/^#[a-f\d]{6}$/i.test(value)?value.slice(1):fallback;
export async function presentationImageData(src:string):Promise<string>{
 const url=await resolveMedia(src),response=await fetch(url);if(!response.ok)throw new Error('无法读取演示中的图片，请检查素材');
 const blob=await response.blob();if(blob.size>20*1024*1024)throw new Error('演示图片过大，请压缩后导出');
 if(blob.type==='image/svg+xml'||/\.svg(?:\?|$)/i.test(src)){
  const temporary=URL.createObjectURL(blob);
  try{return await new Promise<string>((resolve,reject)=>{const image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=Math.min(2560,image.naturalWidth||1920);canvas.height=Math.max(1,Math.round(canvas.width*(image.naturalHeight||1080)/(image.naturalWidth||1920)));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片转换不可用');ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/png'));}catch{reject(new Error('无法转换演示图片，请更换为 PNG 或 JPEG'));}};image.onerror=()=>reject(new Error('演示图片无法解码'));image.src=temporary;});}finally{URL.revokeObjectURL(temporary);}
 }
 if(!['image/png','image/jpeg','image/gif'].includes(blob.type))throw new Error('PPTX 配图请使用 PNG、JPEG、GIF 或 SVG 格式');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob);});
}
function pptxTextAppearance(style:TextAppearance,scale:number) {
 return {fontFace:resolveFontFamily(style.fontFamily)?.split(',')[0].replace(/["']/g,'').trim()||'Microsoft YaHei',
  fontSize:Math.max(8,(style.fontSize||32)*scale*72),bold:(style.fontWeight||400)>=600,
  align:style.textAlign||'left' as const,...(style.lineHeight?{lineSpacingMultiple:style.lineHeight}:{}),color:hex(style.color||'','242830')};
}
/** Text and images stay editable in PowerPoint; platform runtime Q&A is not embedded. */
export async function buildPresentationPptx(work:Work,loadImage=presentationImageData):Promise<Uint8Array>{
 if(work.kind!=='presentation'||!work.pages.length)throw new Error('没有可导出的演示页面');
 const {default:PptxGenJS}=await import('pptxgenjs');const pptx=new PptxGenJS();
 const width=13.333333,height=width*work.height/work.width,sx=width/work.width,sy=height/work.height;
 pptx.defineLayout({name:'ZHICHUANG',width,height});pptx.layout='ZHICHUANG';pptx.author='智创平台';pptx.subject='智能演示';pptx.title=work.title;pptx.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei'};
 const loaded=new Map<string,string>();const image=async(src:string)=>{if(!loaded.has(src))loaded.set(src,await loadImage(src));return loaded.get(src)!;};
 for(const page of work.pages){
  const slide=pptx.addSlide();slide.background={color:hex(page.background)};slide.addNotes(page.notes||'');
  if(page.backgroundImage)slide.addImage({data:await image(page.backgroundImage),x:0,y:0,w:width,h:height});
  for(const node of page.nodes.filter(node=>!node.hidden)){
   const box={x:node.x*sx,y:node.y*sy,w:node.w*sx,h:node.h*sy,rotate:node.rotation,transparency:Math.round((1-node.opacity)*100)};
   if(node.type==='image'&&node.src){slide.addImage({data:await image(node.src),...box});continue;}
   if(['video','audio','html'].includes(node.type))throw new Error(`「${node.name}」为动态素材，请移除或改为图片后导出 PPTX；动态内容请在平台播放`);
   const text=node.items?.length?node.items.flatMap(item=>[
    {text:`${item.year?item.year+'  ':''}${item.title}\n`,options:pptxTextAppearance({...node,...node.titleStyle},sx)},
    {text:`${item.description||''}\n\n`,options:pptxTextAppearance({...node,...node.bodyStyle},sx)},
   ]):node.content;
   if(text)slide.addText(text,{...box,...pptxTextAppearance(node,sx),margin:0,breakLine:false,valign:'top',fit:'shrink',...(node.background.startsWith('#')?{fill:{color:hex(node.background)}}:{})});
  }
 }
 return new Uint8Array(await pptx.write({outputType:'arraybuffer',compression:true}) as ArrayBuffer);
}
export async function downloadPresentationPptx(work:Work){
 const bytes=await buildPresentationPptx(work),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`${work.title.replace(/[\\/:*?"<>|]/g,'_')}.pptx`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
