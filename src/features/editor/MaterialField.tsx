import {ImagePlus, Music2, Play, Replace} from 'lucide-react';
import {useMedia} from '../../domain/upload';
import {Button} from '../../components/ui';

export function MaterialField({src,kind='image',label,onSelect,onClear,disabled=false}:{src?:string;kind?:string;label:string;onSelect:()=>void;onClear?:()=>void;disabled?:boolean}) {
 const url=useMedia(src);
 return <div className="editor-material-field">
  <button type="button" className="editor-material-field-preview" aria-label={`预览并${label}`} disabled={disabled} onClick={onSelect}>
   {kind==='video'?<>{url&&<video src={url} muted preload="metadata"/>}<Play size={20}/></>:kind==='audio'?<Music2 size={26}/>:url?<img src={url} alt={label}/>:<ImagePlus size={26}/>}
  </button>
  <div><Button size="sm" variant="secondary" disabled={disabled} onClick={onSelect}><Replace size={13}/>{label}</Button>{src&&onClear&&<Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>移除</Button>}</div>
 </div>;
}
