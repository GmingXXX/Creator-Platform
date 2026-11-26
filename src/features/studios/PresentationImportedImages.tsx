import {useEffect,useRef,useState} from 'react';
import {type Asset} from '../../domain/types';
import {imageRoles,readPptImages} from '../../domain/pptx-illustrations';
import {readMediaBlob} from '../../domain/upload';
import {importWorkspaceFile} from '../../domain/workspace-upload';
import {useStudio} from '../../domain/store';
import {StudioImage} from './StudioShared';

export const roleOf=(a:Asset)=>a.tags.some(t=>t.startsWith('PPT来源-'))?imageRoles.find(role=>a.tags.includes(role)):undefined;
export const pptSources=(a:Asset)=>a.tags.filter(t=>/^来源页-\d+$/.test(t)).map(t=>Number(t.slice(4)));
export function PresentationImportedImages({files,workspaceId,images,onImages,onBusy,onReady}:{files:Asset[];workspaceId:string;images:Asset[];onImages:(images:Asset[])=>void;onBusy:(busy:boolean)=>void;onReady:(key:string)=>void}){
 const sourceKey=JSON.stringify(files.filter(a=>/\.pptx$/i.test(a.name)).map(a=>a.id)),[error,setError]=useState('');
 const latest=useRef({files,onImages,onBusy,onReady,images});latest.current={files,onImages,onBusy,onReady,images};
 useEffect(()=>{let active=true;const docs=latest.current.files.filter(a=>/\.pptx$/i.test(a.name));setError('');
  async function load(){
   latest.current.onBusy(true);
   try{const results:Asset[]=[];for(const asset of docs){
    const existing=useStudio.getState().assets.filter(a=>a.workspaceId===workspaceId&&a.tags.includes('PPT来源-'+asset.id)&&!a.deletedAt);
    if(existing.length){results.push(...existing);continue}
    const blob=asset.src.startsWith('idb:')?await readMediaBlob(asset.src):asset.src.startsWith('/')&&!asset.src.startsWith('//')&&!asset.src.includes('\\')?await fetch(asset.src).then(r=>r.ok?r.blob():undefined):undefined;
    if(!blob||!active)continue;
    const list=await readPptImages(new File([blob],asset.name));
    const imported:Asset[]=[], binaries=new Map<File,Asset>();
    for(const item of list){if(!active)return;let raw=binaries.get(item.file);if(raw)raw={...raw,id:crypto.randomUUID()};else{raw=await importWorkspaceFile(item.file,workspaceId);binaries.set(item.file,raw)}
     imported.push({...raw,tags:[...raw.tags,'PPT来源-'+asset.id,...(item.box?['原页位置-'+[item.box.x,item.box.y,item.box.w,item.box.h].map(n=>Math.round(n*1000)/10).join(',')]:[]),item.role,...item.pages.map(n=>'来源页-'+n)],description:asset.name+' · '+(item.pages.length?'第 '+item.pages.join('、')+' 页':'母版／版式')});
    }
    if(active){for(const item of imported)useStudio.getState().addAsset(item);results.push(...imported)}
   }
   if(active)latest.current.onImages([...latest.current.images.filter(a=>!a.tags.some(t=>t.startsWith('PPT来源-'))),...results]);
   }catch(e){if(active)setError(e instanceof Error?e.message:'内嵌图片未能读取，可手动选图')}finally{if(active){latest.current.onReady(sourceKey);latest.current.onBusy(false)}}
  }
  if(docs.length||latest.current.images.some(a=>roleOf(a)))void load();else latest.current.onReady(sourceKey);
  return()=>{active=false;latest.current.onBusy(false)};
 },[sourceKey,workspaceId]);
 const [batch,setBatch]=useState(false);
 const updateRole=(asset:Asset,role:string)=>{const source=asset.tags.find(t=>t.startsWith('PPT来源-'));const affected=images.map(a=>a.id===asset.id||(batch&&source&&a.name===asset.name&&a.tags.includes(source))?{...a,tags:[...a.tags.filter(t=>!imageRoles.includes(t as typeof imageRoles[number])),role]}:a);for(const [i,a] of affected.entries()){if(a!==images[i])useStudio.getState().addAsset(a)}onImages(affected)};
 const sourceThumbnail=(asset:Asset)=>{const box=asset.tags.find(t=>t.startsWith('原页位置-'))?.slice(5).split(',').map(Number);if(!box||box.length!==4)return <StudioImage src={asset.src} alt={asset.name}/>;
  return <div className="ppt-original-position" aria-label={asset.name+'在原页的位置'}><div style={{left:box[0]+'%',top:box[1]+'%',width:box[2]+'%',height:box[3]+'%'}}><StudioImage src={asset.src} alt={asset.name}/></div></div>};
 const inferred=images.filter(a=>roleOf(a));
 if(!inferred.length&&!error)return null;
 return <details className="ppt-image-review"><summary>核对导入图片 · {inferred.length}</summary><label><input type="checkbox" checked={batch} onChange={e=>setBatch(e.target.checked)}/>同步修改同一文件内的相同图片</label>{inferred.map(a=><div key={a.id}>{sourceThumbnail(a)}<span>{a.name}<small>{a.description}</small></span><select aria-label={a.name+'的用途'} value={roleOf(a)} onChange={e=>updateRole(a,e.target.value)}>{imageRoles.map(r=><option key={r}>{r}</option>)}</select></div>)}{error&&<p role="alert">{error}</p>}</details>
}
