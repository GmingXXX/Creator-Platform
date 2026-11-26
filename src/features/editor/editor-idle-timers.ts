/** Each rule counts its own remaining idle interval. Only visitor input starts a new interval. */
export function startIdleTimers<T extends {seconds?:number;pauseDuringMedia?:boolean}>(rules:T[],fire:(rule:T)=>void){
 let playing=false;
 const timers=rules.map(rule=>{
  const duration=Math.max(1,rule.seconds??60)*1000;
  let remaining=duration,started=0,fired=false,handle:ReturnType<typeof setTimeout>|undefined;
  function clear(){if(handle!==undefined)clearTimeout(handle);handle=undefined}
  function schedule(){
   if(fired||handle!==undefined||(playing&&rule.pauseDuringMedia))return;
   started=Date.now();handle=setTimeout(()=>{handle=undefined;fired=true;fire(rule)},remaining);
  }
  function changePlayback(){
   if(!rule.pauseDuringMedia)return;
   if(playing&&handle!==undefined){remaining=Math.max(0,remaining-(Date.now()-started));clear()}
   else schedule();
  }
  schedule();
  return {changePlayback,clear,activity(){clear();fired=false;remaining=duration;schedule()}};
 });
 return {activity:()=>timers.forEach(t=>t.activity()),media(next:boolean){if(playing===next)return;playing=next;timers.forEach(t=>t.changePlayback())},dispose:()=>timers.forEach(t=>t.clear())};
}
