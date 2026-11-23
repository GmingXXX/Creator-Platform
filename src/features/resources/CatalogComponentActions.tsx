import {useState} from 'react';
import JSZip from 'jszip';
import {Download,SlidersHorizontal} from 'lucide-react';
import type {Asset} from '../../domain/types';
import {useStudio} from '../../domain/store';
import {importFile} from '../../domain/upload';
import {inspectComponentFile,type ComponentInspection} from '../../domain/component-import';
import {Button,downloadBlob,toast} from '../../components/ui';
import {ComponentImportDialog} from './ComponentImportDialog';

/** Trial uses the exact ZIP also offered for download, never an unrelated demo. */
export function CatalogComponentActions({asset}:{asset:Asset}){
 const [inspection,setInspection]=useState<ComponentInspection|null>(null),[busy,setBusy]=useState(false);
 const slug=asset.package?.params.catalogSlug;
 if(!slug||!['floating-card','milestone-timeline'].includes(slug))return null;
 const load=async()=>{
  const response=await fetch(`${import.meta.env.BASE_URL}components-catalog/${slug}/component.zip`);
  if(!response.ok)throw new Error('组件包读取失败，请刷新后重试');
  const blob=await response.blob();
  if(asset.package?.params.catalogEdited==='true'&&asset.componentImport){
   const html=asset.package.files.find(item=>item.name==='index.html')?.content;
   if(!html)throw new Error('当前组件配置缺失，请重新打开原组件');
   const zip=await JSZip.loadAsync(await blob.arrayBuffer());
   zip.file('index.html',html);
   zip.file('component.json',JSON.stringify({schemaVersion:1,name:asset.name,description:asset.description,entry:'index.html',bridge:'zhichuang-component-v1',fields:asset.componentImport.fields.map(field=>({...field,default:asset.componentImport!.values[field.key]}))}));
   return new File([new Uint8Array(await zip.generateAsync({type:'uint8array'}))],`${asset.name}.zip`,{type:'application/zip'});
  }
  return new File([blob],`${asset.name}.zip`,{type:'application/zip'});
 };
 const prepare=async(trial:boolean)=>{
  if(busy)return;setBusy(true);
  try{const file=await load();if(trial){const checked=await inspectComponentFile(file);if(!checked?.canPreview)throw new Error('组件包未通过检查');setInspection(checked);}else downloadBlob(file,file.name);}
  catch(cause){toast(cause instanceof Error?cause.message:'组件包读取失败',true);}finally{setBusy(false);}
 };
 return <><Button disabled={busy} onClick={()=>void prepare(true)}><SlidersHorizontal size={14}/>预览与试编辑</Button><Button disabled={busy} onClick={()=>void prepare(false)}><Download size={14}/>下载组件 ZIP</Button>
 {inspection&&<ComponentImportDialog inspection={inspection} title="组件参数试编辑" description="修改的是独立副本，原组件保持不变。" workspaceLabel="个人素材库" saveLabel="保存为个人副本" allowReplace={false} onCancel={()=>setInspection(null)} onReplace={async()=>{}} onEntryChange={async()=>{}} onSave={async result=>{
  const file=new File([result.html],`${result.name}.html`,{type:'text/html'}),imported=await importFile(file);
  const saved:Asset={...imported,kind:'component',componentType:'html',name:result.name,description:result.description,workspaceId:'personal',public:false,source:'generated',componentImport:result.componentImport,
   package:{...structuredClone(asset.package!),id:crypto.randomUUID(),params:{...asset.package!.params,catalogEdited:'true'},files:[...asset.package!.files.filter(item=>item.name!=='index.html'),{name:'index.html',type:'html',src:imported.src,content:result.html}]}};
  useStudio.getState().addAsset(saved);setInspection(null);toast('已保存为个人组件副本，可从素材库插入画布');
 }}/>}</>;
}
