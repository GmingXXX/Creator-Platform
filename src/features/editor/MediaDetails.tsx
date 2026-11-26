import type {SceneNode} from '../../domain/types';
import {useMedia} from '../../domain/upload';
export function MediaDetails({node,patch}:{node:SceneNode;patch:(p:Partial<SceneNode>)=>void}){
 const url=useMedia(node.src);
 return <div className="caprule">{url&&(node.type==='video'?<video controls preload="metadata" src={url} style={{width:'100%'}}/>:<audio controls src={url} style={{width:'100%'}}/>)}<label>音量 {Math.round((node.mediaVolume??1)*100)}%<input aria-label="媒体音量" type="range" min="0" max="100" value={(node.mediaVolume??1)*100} onChange={e=>patch({mediaVolume:Number(e.target.value)/100})}/></label>
 {([['mediaAutoplay','自动播放'],['mediaLoop','循环播放'],['mediaControls','显示播放控件']] as const).map(([key,label])=><label key={key}><span><input type="checkbox" checked={node[key]??key==='mediaControls'} onChange={e=>patch({[key]:e.target.checked})}/> {label}</span></label>)}</div>;
}
