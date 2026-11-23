import {useEffect,useRef,useState} from 'react';
import {Mic,Volume2} from 'lucide-react';
import {Button,Modal} from '../../components/ui';
import {useStudio} from '../../domain/store';
import {useMedia} from '../../domain/upload';
import {assetAvailableForInsertion} from '../../domain/asset-access';
import {normalizePresentationVoice,applyPresentationVoice,voiceStyles} from '../../domain/presentation-voice';
import {requestPresentationSpeech} from '../../domain/presentation-audio';
import type {Work} from '../../domain/types';
import {MaterialPicker} from '../resources/MaterialPicker';
import type {PresentationStudio} from './presentation-studio';
import {Field} from './StudioShared';
import './presentation-voice.css';
export function PresentationVoiceSettings({work,settings,onChange}:{work:Work;settings:PresentationStudio;onChange:(settings:PresentationStudio)=>void}) {
 const [open,setOpen]=useState(false),[voice,setVoice]=useState(()=>normalizePresentationVoice(settings.voice)),[rate,setRate]=useState(settings.rate),[busy,setBusy]=useState(false),[error,setError]=useState(''),[picker,setPicker]=useState(false),[authorized,setAuthorized]=useState(false);
 const assets=useStudio(state=>state.assets),sample=assets.find(asset=>asset.id===voice.cloneSample?.assetId&&asset.kind==='audio'&&assetAvailableForInsertion(asset,work.workspaceId||'personal'));
 const sampleUrl=useMedia(sample?.src),audio=useRef<HTMLAudioElement|null>(null),request=useRef<AbortController|null>(null);
 const stop=()=>{request.current?.abort();audio.current?.pause();audio.current=null;setBusy(false);};
 useEffect(()=>()=>{request.current?.abort();audio.current?.pause();},[]);
 const preview=async()=>{stop();const controller=new AbortController();request.current=controller;setBusy(true);setError('');try{const url=await requestPresentationSpeech('欢迎来到展厅。接下来，我将为您介绍核心能力与代表案例。',controller.signal,false,voice);if(controller.signal.aborted)return;const player=new Audio(url);audio.current=player;player.playbackRate=rate;player.onended=()=>setBusy(false);player.onerror=()=>{setError('试听音频无法播放，请重试。');setBusy(false);};await player.play();}catch(cause){if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:'试听失败');setBusy(false);}}};
 const close=()=>{stop();setOpen(false);setPicker(false);};
 return <section className="presentation-voice-entry"><div><strong><Mic size={14}/>语音设置</strong><small>专业讲解 · {voiceStyles.find(style=>style.value===normalizePresentationVoice(settings.voice).style)?.label} · {settings.rate}×</small></div><Button size="sm" onClick={()=>{setVoice(normalizePresentationVoice(settings.voice));setRate(settings.rate);setError('');setAuthorized(false);setOpen(true);}}>配置声音</Button>
 <Modal open={open} onClose={close} title="语音设置" description="整份作品共用声音，语音讲解与问答同步应用。" footer={<><Button onClick={close}>取消</Button><Button variant="primary" onClick={()=>{onChange(applyPresentationVoice(settings,voice,rate));close();}}>应用语音设置</Button></>}>
 <div className="presentation-voice-form"><Field label="讲解音色"><select value={voice.speaker} onChange={()=>{}}><option value="zh_male_ruyayichen_uranus_bigtts">专业讲解男声 · 当前接口音色</option></select></Field><Field label="讲解语气"><select value={voice.style} onChange={event=>{stop();setVoice({...voice,style:event.target.value as typeof voice.style});}}>{voiceStyles.map(style=><option value={style.value} key={style.value}>{style.label}</option>)}</select></Field><Field label="播放语速"><input type="range" min={.5} max={2} step={.05} value={rate} onChange={event=>{const value=Number(event.target.value);setRate(value);if(audio.current)audio.current.playbackRate=value;}}/><output>{rate.toFixed(2)}×</output></Field><Field label="音调"><select disabled value="default"><option value="default">原始音调 · 调节接口尚未接入</option></select></Field>
 <div className="voice-preview-actions"><Button disabled={busy} onClick={()=>void preview()}><Volume2 size={14}/>{busy?'正在试听…':'试听当前声音'}</Button>{busy&&<Button onClick={stop}>停止试听</Button>}</div>{error&&<p role="alert" className="form-error">{error}</p>}
 <div className="voice-clone-section"><strong>声音克隆</strong><p>可以先保存声音样本。当前尚未连接克隆服务，样本不会成为讲解音色。</p><label><input type="checkbox" checked={authorized} onChange={event=>setAuthorized(event.target.checked)}/>我使用的是本人或已获授权的声音</label><Button disabled={!authorized} onClick={()=>setPicker(true)}>选择或上传声音样本</Button>{voice.cloneSample&&<div className="voice-clone-sample"><strong>{voice.cloneSample.name}</strong><span>待接入克隆服务</span>{sample&&sampleUrl?<audio controls src={sampleUrl}/>:<p>样本已不可访问，请重新选择。</p>}<Button size="sm" onClick={()=>setVoice({...voice,cloneSample:undefined})}>移除样本引用</Button></div>}</div>
 </div></Modal><MaterialPicker open={picker} onClose={()=>setPicker(false)} workspaceId={work.workspaceId||'personal'} kinds={['audio']} title="选择声音克隆样本" onSelect={asset=>{setVoice({...voice,cloneSample:{assetId:asset.id,name:asset.name,status:'pending'}});setPicker(false);}}/>
 </section>;
}
