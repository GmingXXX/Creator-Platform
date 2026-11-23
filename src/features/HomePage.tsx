import {demoKnowledgePresets} from '../domain/demo-knowledge';
import {isDemoKnowledgeBinding} from '../domain/workspace-knowledge';
import { useEffect, useState } from 'react';
import {BrandMark} from '../components/BrandMark';
import { Clock3, Presentation, Film, LayoutTemplate, RefreshCw, Award, Paperclip, LoaderCircle, ChevronDown } from 'lucide-react';
import { useStudio } from '../domain/store';
import { useDocumentTitle,toast } from '../components/ui';
import {HomeTemplates} from './home/HomeTemplates';
import {demoPresets,appendDemoPrompt,addDemoInputs,type DemoPresetId} from './home/demo-presets';
import './home/demo-presets.css';
import '../styles/home-v15.css';
import { Composer } from './Composer';

const promptIcons={timeline:Clock3,presentation:Presentation,story:Film,component:LayoutTemplate,honors:Award};
let showedBrand = false;
export default function HomePage(){
 const [animateBrand] = useState(() => !showedBrand);
 useEffect(() => { showedBrand = true; }, []);
 useDocumentTitle('首页');
 const activeDraftId=useStudio(state=>state.activeDraftId);
 const demoBinding=useStudio(state=>{const draft=state.drafts.find(d=>d.id===state.activeDraftId);const binding=state.workspaceKnowledge[draft?.workspaceId||state.activeWorkspaceId];return isDemoKnowledgeBinding(binding)?binding:undefined;});
 const [group,setGroup]=useState(0),[selected,setSelected]=useState<{id:DemoPresetId;draftId:string}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const shown=demoPresets.map((_,i)=>demoPresets[(group+i)%demoPresets.length]);
 const current=selected?.draftId===activeDraftId?demoPresets.find(p=>p.id===selected.id):undefined;
 const selectPrompt=(id:DemoPresetId)=>{
  const state=useStudio.getState(),draft=state.drafts.find(d=>d.id===state.activeDraftId),preset=demoPresets.find(p=>p.id===id);if(!draft||!preset)return;
  const text=appendDemoPrompt(draft.text,demoBinding?(demoKnowledgePresets.find(p=>p.id===id)?.prompt||preset.prompt):preset.prompt);state.updateDraft({text});setSelected({id,draftId:draft.id});setError('');
  if(draft.text.trim()&&text!==draft.text)toast('已将演示需求追加到原有内容下方');
  document.querySelector<HTMLTextAreaElement>('textarea[aria-label="创作需求"]')?.focus();
 };
 const addInputs=async()=>{
  if(!selected||loading)return;const target=selected;setLoading(true);setError('');
  try{const result=await addDemoInputs(target.id,target.draftId);toast(`${result.added?`已添加 ${result.added} 份示例资料`:target.id==='story'?'无需预置素材，可直接开始策划':'示例资料已在附件中'}，配套 Skill 已加入个人技能库`);}
  catch(cause){setError(cause instanceof Error?cause.message:'示例资料添加失败，请重试');}
  finally{setLoading(false);}
 };
 const scrollToTemplates=()=>document.getElementById('home-templates-section')?.scrollIntoView({behavior:'smooth'});
 return <div className="home-workspace">
  <div className="home-page home-page-v15">
   <section className="home-creation-hero" aria-labelledby="home-creation-heading">
    <div className="home-hero-core">
     <div className="home-intro">
      <div className="home-brand-lockup"><BrandMark animate={animateBrand}/></div>
      <h1 id="home-creation-heading">您想创建什么？</h1>
     </div>
     <div className="home-composer">
      <Composer/>
      <div className="home-prompt-pills" aria-label="创作提示词">
       {shown.map(preset=>{
        const Icon=promptIcons[preset.id];
        return <button key={preset.id} title={`填入${preset.title}演示需求`} onClick={()=>selectPrompt(preset.id)}><Icon size={15}/>{preset.title}</button>;
       })}
       <button className="home-refresh-prompts" aria-label="换一组提示词" title="换一组提示词" onClick={()=>setGroup(value=>value+1)}><RefreshCw size={15}/></button>
      </div>
      {current&&!demoBinding&&<div className="home-demo-inputs" aria-label="示例资料">
       <button type="button" disabled={loading} onClick={addInputs}>
        {loading?<LoaderCircle size={14} className="home-demo-spinner"/>:<Paperclip size={14}/>}
        {loading?'正在添加…':current.files.length?'添加示例资料':'准备创作技能'}
       </button>
       {error&&<p role="alert">{error}</p>}
      </div>}
     </div>
    </div>
    <button type="button" className="home-scroll-cue" onClick={scrollToTemplates}><span>探索模板灵感</span><ChevronDown size={14}/></button>
   </section>
   <HomeTemplates/>
  </div>
 </div>;
}
