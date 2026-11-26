import type {ReactNode} from 'react';
import type {StoryLayer} from '../../domain/story-canvas';
import {fitStoryLayer,storyFontPixels,storyFontRatio} from '../../domain/story-layer-editing';
import {fontOptions} from '../../domain/text-style';
import {Button} from '../../components/ui';
import {Field} from './StudioShared';
import {Copy,Trash2,Replace} from 'lucide-react';

export function StoryFieldGroup({title,children,open=true}:{title:string;children:ReactNode;open?:boolean}){
 return <details className="story-inspector-group" open={open}><summary>{title}</summary><div>{children}</div></details>;
}
function Percent({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){
 return <label className="story-value-slider"><span>{label}</span><input aria-label={label} type="range" min="0" max="100" value={Math.round(value*100)} onChange={e=>onChange(Number(e.target.value)/100)}/><output>{Math.round(value*100)}%</output></label>
}
interface Props{layer:StoryLayer;canvasWidth:number;onPatch:(v:Partial<StoryLayer>)=>void;onReplace:()=>void;onDelete:()=>void;onCopy:()=>void}
export function StoryLayerInspector({layer:l,canvasWidth,onPatch,onReplace,onDelete,onCopy}:Props){
 const changeNumber=(k:'x'|'y'|'width'|'height',v:number)=>onPatch(fitStoryLayer({...l,[k]:v},false));
 const text=!l.variant&&['text','button'].includes(l.kind),media=!l.variant&&['image','video','html'].includes(l.kind);
 return <>
 {l.locked&&<Button onClick={()=>onPatch({locked:false})}>已锁定 · 解锁控件</Button>}
 <fieldset disabled={l.locked} className="story-layer-fields">
 <StoryFieldGroup title={l.variant==='qr'?'二维码内容':media?'素材与播放':l.variant==='mask'?'蒙版样式':'内容与文字'}>
  {text&&<><Field label="内容"><textarea value={l.text} onChange={e=>onPatch({text:e.target.value})}/></Field>
   <Field label="字体"><select value={l.fontFamily||''} onChange={e=>onPatch({fontFamily:e.target.value||undefined})}>{fontOptions.map(f=><option key={f.value} value={f.value}>{f.value?f.label:'沿用作品字体'}</option>)}</select></Field>
   <div className="story-input-pair"><Field label="字号（px）"><input type="number" min="1" max={canvasWidth} step="1" value={storyFontPixels(l.size,canvasWidth)} onChange={e=>onPatch({size:storyFontRatio(Number(e.target.value),canvasWidth)})}/></Field>
   <Field label="字重"><select value={l.weight||400} onChange={e=>onPatch({weight:Number(e.target.value)})}><option value={400}>常规</option><option value={600}>半粗</option><option value={700}>粗体</option></select></Field></div>
   <div className="story-input-pair"><Field label="文字颜色"><input type="color" value={l.color||'#ffffff'} onChange={e=>onPatch({color:e.target.value})}/></Field>
   <Field label="对齐"><select value={l.align||'center'} onChange={e=>onPatch({align:e.target.value as StoryLayer['align']})}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></Field></div></>}
  {l.variant==='qr'&&<Field label="扫码内容" hint="填写链接或文字，画布同步生成二维码"><textarea maxLength={512} value={l.qrText||''} onChange={e=>onPatch({qrText:e.target.value})}/></Field>}
  {(l.kind==='button'||l.variant==='mask')&&<div className="story-input-pair"><Field label="填充颜色"><input type="color" value={l.background||(l.variant==='mask'?'#101624':'#275c99')} onChange={e=>onPatch({background:e.target.value})}/></Field><Field label="圆角"><input type="number" min={0} max={150} value={l.radius??6} onChange={e=>onPatch({radius:Math.max(0,Math.min(150,Number(e.target.value)))})}/></Field></div>}
  {media&&<>{l.resultSource&&<Field label="结果来源"><select value={l.resultSource} onChange={e=>onPatch({resultSource:e.target.value as StoryLayer['resultSource']})}>{l.kind==='video'?<option value="faceVideo">换脸视频结果</option>:<><option value="photo">本次拍摄照片</option><option value="faceImage">换脸图片结果</option></>}</select></Field>}
   <Button size="sm" onClick={onReplace}><Replace size={14}/>{l.resultSource?'选择备用素材':'替换素材'}</Button>
   {l.kind!=='html'&&<Field label="画面适配"><select value={l.fit||'contain'} onChange={e=>onPatch({fit:e.target.value as StoryLayer['fit']})}><option value="contain">完整显示</option><option value="cover">裁切填满</option><option value="fill">拉伸至边缘</option></select></Field>}
   {l.kind==='video'&&<><Percent label="视频音量" value={l.volume??1} onChange={volume=>onPatch({volume})}/><label><input type="checkbox" checked={l.autoplay!==false} onChange={e=>onPatch({autoplay:e.target.checked})}/> 进入时播放</label><label><input type="checkbox" checked={!!l.loop} onChange={e=>onPatch({loop:e.target.checked})}/> 循环播放</label></>}
  </>}
  <Percent label="不透明度" value={l.opacity??1} onChange={opacity=>onPatch({opacity})}/>
 </StoryFieldGroup>
 <StoryFieldGroup title="位置与大小" open={false}><div className="story-input-pair">{(['x','y','width','height'] as const).map(k=><Field key={k} label={{x:'左边距 %',y:'上边距 %',width:'宽度 %',height:'高度 %'}[k]}><input type="number" min="0" max="100" value={l[k]} onChange={e=>changeNumber(k,Number(e.target.value))}/></Field>)}</div>
 <div className="story-button-pair"><Button size="sm" onClick={()=>onPatch({x:(100-l.width)/2})}>水平居中</Button><Button size="sm" onClick={()=>onPatch({y:(100-l.height)/2})}>垂直居中</Button></div></StoryFieldGroup>
 <Field label="控件名称"><input value={l.name} onChange={e=>onPatch({name:e.target.value})}/></Field>
 <label><input type="checkbox" checked={!!l.hidden} onChange={e=>onPatch({hidden:e.target.checked})}/> 初始隐藏</label>
 </fieldset>
 <div className="story-button-pair"><Button size="sm" onClick={onCopy}><Copy size={13}/>复制控件</Button><Button size="sm" disabled={l.locked} onClick={onDelete}><Trash2 size={13}/>删除控件</Button></div>
 </>;
}
