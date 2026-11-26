import {useEffect,useRef,useState} from 'react';
import {Music2,Volume2,VolumeX,X} from 'lucide-react';
import {Button} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {useMedia} from '../../domain/upload';
import {effectiveStoryMusic,trackVolume,type StoryNodeSound,type StoryAudioTrack} from '../../domain/story-audio';
import {MaterialPicker} from '../resources/MaterialPicker';
import './story-sound.css';

interface TrackFieldProps {
  label:string; track?:StoryAudioTrack; workspaceId:string; initialVolume?:number; disabled?:boolean;
  onChange:(value:StoryAudioTrack|undefined)=>void;
}
export function TrackField({label,track,workspaceId,initialVolume=.65,disabled,onChange}:TrackFieldProps){
  const [open,setOpen]=useState(false);
  const name=useStudio(s=>s.assets.find(a=>a.id===track?.assetId)?.name);
  return <div className="story-sound-field">
    <strong>{label}</strong>
    <div className="story-sound-actions">
      <Button size="sm" disabled={disabled} aria-label={`选择${label}`} onClick={()=>setOpen(true)}><Music2 size={14}/>{track?(name||'更换音频'):'选择音频'}</Button>
      {track&&<Button size="sm" disabled={disabled} aria-label={`移除${label}`} onClick={()=>onChange(undefined)}><X size={14}/></Button>}
    </div>
    {track&&<Volume label={label+'音量'} value={track.volume} disabled={disabled} onChange={volume=>onChange({...track,volume})}/>}
    <MaterialPicker open={open} onClose={()=>setOpen(false)} workspaceId={workspaceId} kinds={['audio']} title={'选择'+label} onSelect={asset=>onChange({src:asset.src,assetId:asset.id,volume:track?.volume??initialVolume})}/>
  </div>;
}
function Volume({value,label,disabled,onChange}:{value:number;label:string;disabled?:boolean;onChange:(v:number)=>void}){
  const percent=Math.round(trackVolume(value,1)*100);
  return <label className="story-sound-volume"><span>{label}</span><input type="range" aria-label={label} min={0} max={100} step={1} disabled={disabled} value={percent} onChange={e=>onChange(Number(e.target.value)/100)}/><output>{percent}%</output></label>;
}
interface SoundProps {sound?:StoryNodeSound;projectMusic?:StoryAudioTrack;isVideo:boolean;workspaceId:string;disabled?:boolean;onChange:(value:StoryNodeSound)=>void}
export function StorySoundSettings({sound={},projectMusic,isVideo,workspaceId,disabled,onChange}:SoundProps){
  const name=useStudio(s=>s.assets.find(a=>a.id===projectMusic?.assetId)?.name);
  return <details className="story-sound-settings"><summary>声音与旁白</summary>
    {isVideo&&<Volume label="背景视频音量" value={sound.videoVolume??.5} disabled={disabled} onChange={videoVolume=>onChange({...sound,videoVolume})}/>}
    <label>背景音乐<select aria-label="节点背景音乐" disabled={disabled} value={sound.musicMode||'inherit'} onChange={e=>onChange({...sound,musicMode:e.target.value as StoryNodeSound['musicMode']})}>
      <option value="inherit">沿用项目配乐</option><option value="own">使用本节点配乐</option><option value="off">本节点静音（配乐）</option>
    </select></label>
    {(!sound.musicMode||sound.musicMode==='inherit')&&<small>{projectMusic?`项目配乐 · ${name||'已配置'}`:'项目暂未设置配乐'}</small>}
    {projectMusic&&(!sound.musicMode||sound.musicMode==='inherit')&&<Volume label="本节点配乐比例" value={sound.inheritedVolume??1} disabled={disabled} onChange={inheritedVolume=>onChange({...sound,inheritedVolume})}/>}
    {sound.musicMode==='own'&&<TrackField label="节点配乐" workspaceId={workspaceId} track={sound.music} disabled={disabled} onChange={music=>onChange({...sound,music})}/>}
    <TrackField label="节点旁白" workspaceId={workspaceId} track={sound.narration} initialVolume={.8} disabled={disabled} onChange={narration=>onChange({...sound,narration})}/>
  </details>;
}
function AudioChannel({track,loop,enabled,onError}:{track:StoryAudioTrack;loop?:boolean;enabled:boolean;onError:()=>void}){
  const src=useMedia(track.src),element=useRef<HTMLAudioElement>(null);
  useEffect(()=>{if(element.current)element.current.volume=trackVolume(track.volume,1);},[track.volume,src]);
  useEffect(()=>{
    const player=element.current;if(!player||!src)return;
    let active=true;
    if(enabled)void player.play().catch((e:Error)=>{if(active&&e.name!=='AbortError')onError();});
    else player.pause();
    return ()=>{active=false;player.pause();};
  },[enabled,src]);
  return <audio ref={element} src={src||undefined} loop={loop} preload="none"/>;
}
export function StorySoundPlayer({projectMusic,sound,nodeId,restart}:{projectMusic?:StoryAudioTrack;sound?:StoryNodeSound;nodeId:string;restart:number}){
  const music=effectiveStoryMusic(projectMusic,sound),narration=sound?.narration;
  const [enabled,setEnabled]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{setFailed(false);},[nodeId,restart,music?.src,narration?.src]);
  const error=()=>{setFailed(true);setEnabled(false);};
  return <>{(music||narration)&&<Button size="sm" variant="ghost" aria-pressed={enabled} onClick={()=>{setFailed(false);setEnabled(!enabled);}}>{enabled?<Volume2 size={15}/>:<VolumeX size={15}/>} {failed?'重试配乐与旁白':enabled?'关闭配乐与旁白':'播放配乐与旁白'}</Button>}
    {music&&<AudioChannel key={'music-'+restart+'-'+music.src} track={music} loop enabled={enabled} onError={error}/>}
    {narration&&<AudioChannel key={'voice-'+restart+'-'+nodeId} track={narration} enabled={enabled} onError={error}/>}
  </>;
}
