import {File,Folder,X} from 'lucide-react';
import type {Asset} from '../../domain/types';
import {useMedia} from '../../domain/upload';
import '../../styles/composer-attachments.css';
function AttachmentItem({asset,onRemove,grouped=false}:{asset:Asset;onRemove:(ids:string[])=>void;grouped?:boolean}){
 const src=useMedia(asset.kind==='image'?asset.src:'');const path=asset.intake?.relativePath||asset.name;
 return <div className={`attachment-chip ${grouped?'attachment-tree-file':''}`} title={path}>{asset.kind==='image'?<img src={src} alt=""/>:<File size={16}/>}<span><span>{asset.name}</span><small>{asset.intake?.status||'已上传'}{asset.knowledgeTarget?.state==='not-connected'?' · ACP未同步':''}</small></span><button type="button" aria-label={`移除 ${path}`} onClick={()=>onRemove([asset.id])}><X size={13}/></button></div>;
}
function Directory({assets,prefix,onRemove}:{assets:Asset[];prefix:string;onRemove:(ids:string[])=>void}){
 const files=assets.filter(a=>!(a.intake!.relativePath.slice(prefix.length+1).includes('/')));
 const folders=[...new Set(assets.map(a=>a.intake!.relativePath.slice(prefix.length+1)).filter(p=>p.includes('/')).map(p=>p.split('/')[0]))];
 return <div className="attachment-tree">{folders.map(folder=><details key={folder}><summary><Folder size={14}/>{folder}</summary><Directory assets={assets.filter(a=>a.intake!.relativePath.startsWith(`${prefix}/${folder}/`))} prefix={`${prefix}/${folder}`} onRemove={onRemove}/></details>)}{files.map(asset=><AttachmentItem key={asset.id} asset={asset} onRemove={onRemove} grouped/>)}</div>;
}
export function ComposerAttachments({assets,onRemove}:{assets:Asset[];onRemove:(ids:string[])=>void}){
 const grouped=assets.filter(asset=>asset.intake?.folder);
 const keys=[...new Set(grouped.map(asset=>`${asset.intake!.batchId}:${asset.intake!.folder}`))];
 return <>{assets.filter(asset=>!asset.intake?.folder).map(asset=><AttachmentItem key={asset.id} asset={asset} onRemove={onRemove}/>)}{keys.map(key=>{const group=grouped.filter(asset=>`${asset.intake!.batchId}:${asset.intake!.folder}`===key);const folder=group[0].intake!.folder!;return <div className="attachment-folder" key={key}><details><summary><Folder size={16}/><strong>{folder}</strong><small>{group.length} 个文件 · {group.filter(a=>a.intake?.status.startsWith('已解析正文')).length} 个已解析</small></summary><Directory assets={group} prefix={folder} onRemove={onRemove}/></details><button type="button" className="attachment-folder-remove" aria-label={`移除文件夹 ${folder}`} onClick={()=>onRemove(group.map(a=>a.id))}><X size={13}/></button></div>;})}</>;
}
