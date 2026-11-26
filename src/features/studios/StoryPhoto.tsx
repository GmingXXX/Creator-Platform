import {useEffect,useState} from 'react';
import {Camera} from 'lucide-react';
import {MaterialPicker} from '../resources/MaterialPicker';
import {Button} from '../../components/ui';
import {frameGeometry,readPhotoSettings,type PhotoSettings} from '../../domain/story-photo';
import './story-photo.css';

type SettingsProps={workspaceId:string;value?:Partial<PhotoSettings>;onChange:(next:PhotoSettings)=>void};
const sample='/media/culture.svg';

export function StoryPhotoSettings({workspaceId,value,onChange}:SettingsProps){
  const [picker,setPicker]=useState<'image'|'video'>();
  const settings=readPhotoSettings(value);
  const patch=(next:Partial<PhotoSettings>)=>onChange(readPhotoSettings({...settings,...next}));
  return <section className="story-photo-settings" aria-label="拍照设置">
    <h4><Camera size={15}/>拍照设置</h4>
    <label>拍前提示<input value={settings.hint} maxLength={100} onChange={e=>patch({hint:e.target.value})}/></label>
    <label>拍摄倒计时（秒）<input type="number" min={0} max={10} value={settings.seconds} onChange={e=>patch({seconds:e.target.valueAsNumber})}/></label>
    <label className="photo-checkbox"><input type="checkbox" checked={settings.allowRetake} onChange={e=>patch({allowRetake:e.target.checked})}/>允许重拍</label>
    <details><summary>取景框</summary>
      <label>取景框形状<select value={settings.shape} onChange={e=>patch({shape:e.target.value as PhotoSettings['shape']})}>
        <option value="rect">矩形</option><option value="rounded">圆角矩形</option><option value="circle">圆形</option>
      </select></label>
      <label>取景框边框<select value={settings.outline} onChange={e=>patch({outline:e.target.value as PhotoSettings['outline']})}>
        <option value="solid">实线</option><option value="dashed">虚线</option><option value="none">无边框</option>
      </select></label>
      {([['size','取景框大小',15,80],['x','水平位置',0,100],['y','垂直位置',0,100]] as const).map(([key,label,min,max])=>
        <label key={key}>{label}<span className="photo-slider"><input aria-label={label} type="range" min={min} max={max} value={settings[key]} onChange={e=>patch({[key]:e.target.valueAsNumber})}/><output>{settings[key]}%</output></span></label>)}
    </details>
    <details><summary>换脸模板 · 样片演示</summary>
      <p>确认拍照后，后续结果控件会展示所选模板的原图或视频。拍摄样片单独保留。</p>
      {(['image','video'] as const).map(kind=>{
        const key=kind==='image'?'imageTemplate':'videoTemplate';
        const label=kind==='image'?'图片模板':'视频模板';
        return <div className="story-photo-template" key={kind}><b>{label}</b>
          {settings[key]&&<span>{settings[key].name}</span>}
          <div><Button onClick={()=>setPicker(kind)}>{settings[key]?'替换':'选择'}{label}</Button>
          {settings[key]&&<Button aria-label={'移除'+label} onClick={()=>patch({[key]:undefined})}>移除</Button>}</div>
        </div>;
      })}
    </details>
    <MaterialPicker open={!!picker} workspaceId={workspaceId} kinds={picker?[picker]:['image']} title={picker==='video'?'选择视频模板':'选择图片模板'} onClose={()=>setPicker(undefined)}
      onSelect={asset=>patch({[picker==='video'?'videoTemplate':'imageTemplate']:{assetId:asset.id,src:asset.src,name:asset.name}})}/>
  </section>;
}

export function StoryPhotoFrame({value}:{value?:Partial<PhotoSettings>}) {
  return <div className="story-photo-frame-plane" aria-hidden="true"><div className="story-photo-viewfinder" style={frameGeometry(readPhotoSettings(value))}>
    <img src={sample} alt=""/><span>取景样片</span>
  </div></div>;
}

export function StoryPhotoExperience({value,onConfirm,onSkip}:{value?:Partial<PhotoSettings>;onConfirm:(src:string)=>void;onSkip?:()=>void}) {
  const settings=readPhotoSettings(value);
  const [seconds,setSeconds]=useState<number|null>(null),[taken,setTaken]=useState(false),[confirmed,setConfirmed]=useState(false);
  useEffect(()=>{
    if(seconds===null)return;
    const timeout=window.setTimeout(()=>{
      if(seconds<=1){setSeconds(null);setTaken(true);}
      else setSeconds(seconds-1);
    },1000);
    return ()=>window.clearTimeout(timeout);
  },[seconds]);
  const shoot=()=>{setConfirmed(false);if(settings.seconds)setSeconds(settings.seconds);else setTaken(true);};
  const retake=()=>{setTaken(false);setConfirmed(false);};
  return <div className="story-photo-actions" aria-label="样片拍照">
    <small>拍照演示 · 使用样片</small>
    <strong role="status">{confirmed?'照片已确认':taken?'查看拍摄样片':seconds!==null?'拍摄倒计时 '+seconds:settings.hint}</strong>
    <div>{taken?<>{settings.allowRetake&&<Button onClick={retake}>重拍</Button>}
      {!confirmed&&<Button variant="primary" onClick={()=>{setConfirmed(true);onConfirm(sample);}}>确认照片</Button>}</>
      :seconds!==null?<Button onClick={()=>setSeconds(null)}>取消倒计时</Button>:<Button variant="primary" onClick={shoot}><Camera size={15}/>拍摄样片</Button>}
      {onSkip&&<Button onClick={()=>{setSeconds(null);onSkip();}}>跳过拍照</Button>}</div>
  </div>;
}
