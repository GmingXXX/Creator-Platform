import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {motion} from 'motion/react';
import {ArrowRight,Heart,Eye} from 'lucide-react';
import {useStudio} from '../../domain/store';
import type {Template} from '../../domain/types';
import {Button,Modal,toast} from '../../components/ui';
import {Avatar,RuntimePreview} from '../resources/Shared';
import {MaterialWorkPreview} from '../resources/MaterialWorkPreview';
import {Artwork} from '../../components/Artwork';
import {CurrentWorkPreview} from '../conversation/CurrentWorkPreview';
import {workRoute} from '../resources/helpers';
import {rankTemplates} from './home-logic';
export function HomeTemplates(){
 const state=useStudio(),navigate=useNavigate();const [selected,setSelected]=useState<Template|null>(null);
 const ranked=rankTemplates(state.templates).slice(0,6);
 const reuse=(item:Template)=>{const work=state.cloneTemplate(item.id);if(work){navigate(workRoute(work));toast('已创建独立副本，可以开始编辑');}else toast(useStudio.getState().creationError||'模板暂时无法复用，请重试',true);};
 return <section id="home-templates-section" className="home-templates" aria-labelledby="home-template-heading"><header><div><h2 id="home-template-heading">模板精选</h2><p className="home-templates-subtitle">从代表作品出发，快速复用为独立副本继续编辑</p></div><button className="home-browse-all" onClick={()=>navigate('/community')}>前往共创社区浏览全部<ArrowRight size={14}/></button></header><div className="home-template-grid">{ranked.map((item,index)=><motion.article className="home-template-card" key={item.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.24,delay:index*0.03,ease:[0.22,1,0.36,1]}}><div role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(item);}}} className="home-template-cover" aria-label={`预览模板 ${item.title}`} onClick={()=>setSelected(item)}>{item.work.kind==='exhibit'?<CurrentWorkPreview work={item.work}/>:item.work.kind==='story'?<Artwork work={item.work}/>:<MaterialWorkPreview work={item.work}/>}<span className="home-template-glass-badge"><Eye size={14}/>预览模板</span></div><div className="home-template-info"><Avatar name={item.author}/><div><button className="home-template-title" onClick={()=>setSelected(item)}>{item.title}</button><span className="home-template-author">{item.author}</span></div><button className={`home-template-save ${state.favorites.includes(item.id)?'active':''}`} aria-label={`${state.favorites.includes(item.id)?'取消收藏':'收藏'}模板 ${item.title}`} aria-pressed={state.favorites.includes(item.id)} onClick={()=>state.toggleFavorite(item.id)}><Heart size={16} fill={state.favorites.includes(item.id)?'currentColor':'none'}/></button></div><footer><button onClick={()=>reuse(item)}>快速复用<ArrowRight size={13}/></button></footer></motion.article>)}</div>{!ranked.length&&<div className="home-template-empty">暂时还没有精选模板。</div>}<Modal open={!!selected} onClose={()=>setSelected(null)} title={selected?.title||'模板预览'} wide footer={<><Button onClick={()=>setSelected(null)}>关闭</Button><Button variant="primary" onClick={()=>selected&&reuse(selected)}>快速复用并编辑<ArrowRight size={15}/></Button></>}>{selected&&<RuntimePreview work={selected.work}/>}</Modal></section>;
}
