import {useState} from 'react';
import type {SceneNode} from '../../domain/types';
import {fontOptions,nodeTypographyStyle} from '../../domain/text-style';
export function InlineTextEditor({node,zoom,finish}:{node:SceneNode;zoom:number;finish:(patch?:Partial<SceneNode>)=>void}){
 const [content,setContent]=useState(node.content),[appearance,setAppearance]=useState<Partial<SceneNode>>({});
 const current={...node,...appearance};
 const done=()=>finish(content!==node.content||Object.keys(appearance).length?{...appearance,content}:undefined);
 return <div className="inline-text-surface" onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))done()}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish()}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();done()}}}>
 <div className="inline-style-toolbar" style={{transform:'scale('+1/zoom+')'}} role="toolbar" aria-label="文字快速格式">
 <select aria-label="快速字体" value={current.fontFamily||''} onChange={e=>setAppearance({...appearance,fontFamily:e.target.value})}>{fontOptions.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select>
 <input aria-label="快速字号" type="number" value={current.fontSize} min="10" max="300" onChange={e=>setAppearance({...appearance,fontSize:Math.min(300,Math.max(10,Number(e.target.value)))})}/>
 <button title="加粗" aria-pressed={(current.fontWeight||400)>=600} onClick={()=>setAppearance({...appearance,fontWeight:(current.fontWeight||400)>=600?400:700})}><b>B</b></button>
 <input aria-label="快速文字颜色" type="color" value={/^#[a-f\d]{6}$/i.test(current.color)?current.color:'#ffffff'} onChange={e=>setAppearance({...appearance,color:e.target.value})}/>
 </div><textarea className="canvas-inline-edit" aria-label="画布文字" autoFocus value={content} onChange={e=>setContent(e.target.value)} style={{...nodeTypographyStyle(current),fontSize:current.fontSize,color:current.color}}/></div>
}
