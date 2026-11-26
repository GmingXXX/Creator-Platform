import {useEffect,useRef,useState} from 'react';
import {Button} from '../../components/ui';
import {aiChat} from '../../domain/ai-client';
import {parsePresentationPlan,presentationSystemPrompt,type PresentationSection} from '../../domain/presentation-generation';
import {assertAIWorkspaceWrite} from '../../domain/workspace-ai-access';
type Section=PresentationSection&{reviewId?:string;imagePrompt?:string};
export function PresentationRewrite({sections,onChange,workspaceId,model,source}:{sections:Section[];onChange:(v:Section[])=>void;workspaceId:string;model:string;source:string}){
 const [scope,setScope]=useState('all'),[prompt,setPrompt]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[proposal,setProposal]=useState<Section[]>(),[previous,setPrevious]=useState<Section[]>();
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{setProposal(undefined);setPrevious(undefined);controller.current?.abort();setBusy(false)},[sections]);
 const rewrite=async()=>{
  if(!prompt.trim()||busy)return;const selected=sections.filter((_,i)=>scope==='all'||i===Number(scope));if(!selected.length)return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setError('');
  try{
   assertAIWorkspaceWrite(workspaceId);let revised:Section[];let origins:(string|undefined)[]=selected.map(s=>s.reviewId);
   if(model==='demo'){
    if(/案例/.test(prompt)){
     const detail=source.split(/[。！？\n]/).find(line=>line.includes('案例'))||'待补充有来源的案例。';
     const extra={title:'案例分析',bullets:[detail],narration:detail,layout:'bullets' as const};
     revised=scope==='all'?[...selected,extra]:[{...selected[0],bullets:[...selected[0].bullets.slice(0,5),detail]}];if(scope==='all')origins.push(undefined);
    }else if(/问题|方案|收益/.test(prompt)){
     const rank=(s:Section)=>/问题|挑战|背景/.test(s.title)?0:/收益|成果/.test(s.title)?2:1;
     revised=[...selected].sort((a,b)=>rank(a)-rank(b));origins=revised.map(s=>s.reviewId);
    }else if(/精简|缩短|数据/.test(prompt)){
     revised=selected.map(s=>({...s,bullets:/数据/.test(prompt)?[...s.bullets].sort((a,b)=>Number(/\d/.test(b))-Number(/\d/.test(a))):s.bullets.slice(0,2),narration:/数据/.test(prompt)?s.narration:(s.narration.match(/^.*?[。！？]/)?.[0]||s.narration)}));
    }else throw new Error('离线演示可体验下方四项改写，自由指令请选择在线模型。');
   }else{
    const context=JSON.stringify({指令:prompt,原大纲:selected.map(({imageAssetId,imagePrompt,...s})=>s),参考资料:source.slice(0,24000)});
    const result=await aiChat(model,[{role:'system',content:presentationSystemPrompt+('原有页必须回传原 reviewId，新增页不传。'+(scope==='all'?'可按用户要求增减或重排页。':'只返回这一个页面。')+'保留事实，缺少案例或数据时标记待补。')},...Array.from({length:Math.ceil(context.length/10000)},(_,i)=>({role:'user' as const,content:context.slice(i*10000,(i+1)*10000)}))],abort.signal);
    revised=parsePresentationPlan(result.content).sections;
    const raw=JSON.parse(result.content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));origins=raw.sections.map((item:{reviewId?:string;title?:string},i:number)=>selected.some(s=>s.reviewId===item.reviewId)&&item.reviewId?item.reviewId:selected.find(s=>s.title===item.title)?.reviewId||(revised.length===selected.length?selected[i]?.reviewId:undefined));
   }
   if(abort.signal.aborted)return;assertAIWorkspaceWrite(workspaceId);
   if(revised.length>60||(!revised.length)||(scope!=='all'&&revised.length!==1))throw new Error('改写页数超出当前范围，原稿已保留。');
   const seen=new Set<string>();
   const next=revised.map((value,i)=>{const id=origins[i],previous=id&&!seen.has(id)?selected.find(s=>s.reviewId===id):undefined;if(id)seen.add(id);return {...previous,...value,reviewId:previous?.reviewId||crypto.randomUUID(),imageAssetId:previous?.imageAssetId,imagePrompt:previous?.imagePrompt}});
   setProposal(scope==='all'?next:sections.map((s,i)=>i===Number(scope)?next[0]:s));
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'改写失败')}finally{if(!abort.signal.aborted)setBusy(false)}
 };
 const undo=useRef<{next:Section[];prior:Section[]}|null>(null);
 useEffect(()=>{if(undo.current?.next===sections)setPrevious(undo.current.prior)},[sections]);
 return <section className="presentation-rewrite"><div><select aria-label="改写范围" value={scope} onChange={e=>{setScope(e.target.value);setProposal(undefined)}}><option value="all">整份大纲</option>{sections.map((s,i)=><option key={s.reviewId||i} value={i}>第 {i+1} 页</option>)}</select><input aria-label="大纲改写要求" placeholder="告诉 AI 怎么改这份大纲" value={prompt} onChange={e=>{setPrompt(e.target.value);setProposal(undefined)}}/><Button disabled={busy||!prompt.trim()} onClick={()=>void rewrite()}>{busy?'正在改写…':'让 AI 改写'}</Button></div><div>{['再精简一些','增加一章案例分析','更突出数据与成果','调整为问题、方案、收益的逻辑'].map(v=><button key={v} onClick={()=>{setPrompt(v);setProposal(undefined)}}>{v}</button>)}</div>{proposal&&<details open><summary>改写预览 · {sections.length} 页 → {proposal.length} 页</summary>{proposal.map((s,i)=>s===sections[i]?null:<div key={s.reviewId||i}><strong>{i+1}. {s.title}</strong><p>{s.bullets.join(' · ')}</p><small>{s.narration}</small></div>)}<Button onClick={()=>{undo.current={next:proposal,prior:sections};onChange(proposal)}}>采用改写</Button><Button onClick={()=>setProposal(undefined)}>放弃</Button></details>}{previous&&<Button onClick={()=>{undo.current=null;onChange(previous)}}>撤销改写</Button>}{error&&<p role="alert">{error}</p>}</section>
}
