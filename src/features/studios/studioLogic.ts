import type { SceneNode, ScenePage, StoryEdge, StoryNode } from '../../domain/types';

export function defaultStory(): {nodes:StoryNode[];edges:StoryEdge[]} {
 return {nodes:[
  {id:'start',type:'start',x:70,y:200,title:'旅程开始',text:'欢迎来到未来工厂。今天，你将决定这座城市的未来。'},
  {id:'intro',type:'scene',x:350,y:200,title:'走进未来工厂',text:'一束光穿过工厂的穹顶。智能制造与绿色能源在这里相遇，城市的下一步，等待你的选择。',media:'/media/industrial.svg'},
  {id:'choice',type:'choice',x:650,y:200,title:'选择探索方向',text:'你更想了解哪一种未来？'},
  {id:'green',type:'end',x:970,y:70,title:'结局 A · 绿色共生',text:'你走进了零碳园区。让每一度电更清洁，让每一次生产都与自然共生。',media:'/media/culture.svg'},
  {id:'smart',type:'end',x:970,y:360,title:'结局 B · 智慧新生',text:'你抵达了智能制造中心。数据连接每一个环节，技术让更多想象成为现实。',media:'/media/technology.svg'},
 ],edges:[{id:'edge-start',source:'start',target:'intro',label:'开始体验'},{id:'edge-intro',source:'intro',target:'choice',label:'继续探索'},{id:'edge-green',source:'choice',target:'green',label:'探索绿色能源'},{id:'edge-smart',source:'choice',target:'smart',label:'探索智能制造'}]};
}
export function validateStory(nodes:StoryNode[],edges:StoryEdge[]):string[] {
 const errors:string[]=[];const ids=new Set(nodes.map(n=>n.id));const starts=nodes.filter(n=>n.type==='start');
 if(starts.length!==1)errors.push('故事需要且只能有一个开始节点');
 if(!nodes.some(n=>n.type==='end'))errors.push('请添加至少一个结局节点');
 if(edges.some(e=>!ids.has(e.source)||!ids.has(e.target)))errors.push('存在失效连线，请重新连接');
 for(const node of nodes){const outgoing=edges.filter(e=>e.source===node.id&&ids.has(e.target));
  if(node.type==='choice'&&outgoing.length<2)errors.push(`「${node.title}」需要至少两个分支`);
  if(node.type!=='end'&&!outgoing.length)errors.push(`「${node.title}」未连接后续节点`);
  if(node.type==='end'&&outgoing.length)errors.push(`结局「${node.title}」不应连接后续节点`);
 }
 const reached=new Set<string>();const walk=(id:string)=>{if(reached.has(id))return;reached.add(id);edges.filter(e=>e.source===id&&ids.has(e.target)).forEach(e=>walk(e.target))};starts.forEach(s=>walk(s.id));
 if(nodes.some(n=>!reached.has(n.id)))errors.push('存在未连接到开始节点的内容');
 const visited=new Set<string>(),active=new Set<string>();
 const cycle=(id:string):boolean=>{if(active.has(id))return true;if(visited.has(id))return false;visited.add(id);active.add(id);const found=edges.filter(e=>e.source===id&&ids.has(e.target)).some(e=>cycle(e.target));active.delete(id);return found};
 if(nodes.some(n=>cycle(n.id)))errors.push('检测到循环连接，请让每条路径通往结局');
 return [...new Set(errors)];
}
export function nextStoryNode(nodes:StoryNode[],edges:StoryEdge[],id:string,edgeId?:string):StoryNode|undefined {
 const source=nodes.find(n=>n.id===id);if(!source||source.type==='end')return;
 const edge=edges.find(e=>e.source===id&&(!edgeId||e.id===edgeId));return nodes.find(n=>n.id===edge?.target);
}
export function reorder<T>(items:T[],index:number,delta:number):T[]{
 const target=index+delta;if(index<0||index>=items.length||target<0||target>=items.length)return [...items];
 return items.map((item,i)=>i===index?items[target]:i===target?items[index]:item);
}
const subtitle=['让内容连接人与未来','从行业变化，看见新的可能','从需求出发，构建完整的解决方案','让技术能力成为可以感知的价值','每一个实践，都是前行的答案','以清晰路径，持续创造价值','今天的创新，正在成为明天的日常','感谢同行，一起让想象发生'];
const sections=['','时代背景','核心能力','技术创新','实践案例','协作路径','未来展望','感谢聆听'];
const colors:Record<string,string>={industrial:'#f5b95f',technology:'#92dcff',government:'#e4bf85',culture:'#c9be8c',jewelry:'#f7d99e',finance:'#a8c8ff'};
export function makePresentationPages(title:string,styleId:string,titles?:string[]):ScenePage[]{
 return (titles||sections.map((s,i)=>i?s:title)).map((name,i)=>{
  const pid=crypto.randomUUID(),light=['','none','government','culture','jewelry'].includes(styleId),ink=light?'#30343b':'#ffffff',accent=light?'#927345':colors[styleId]||colors.technology;
  const node=(suffix:string,props:Partial<SceneNode>):SceneNode=>({id:`${pid}-${suffix}`,type:'text',name:'文字',x:130,y:150,w:1600,h:200,rotation:0,opacity:1,hidden:false,locked:false,content:'',color:ink,background:'transparent',fontSize:70,radius:0,...props});
  return {id:pid,name,background:light?'#f4efe6':'#111b27',backgroundImage:!styleId||styleId==='none'?undefined:`/media/${styleId}.svg`,notes:`${name}。${subtitle[i%8]}。我们将围绕${title}，从具体场景出发，介绍核心能力与实践路径，帮助观众理解其中的价值。`,nodes:[
   node('title',{name:'主标题',content:name,y:i===0?290:160,h:180,fontSize:i===0?100:76,w:1600}),
   node('chapter',{name:'章节标记',content:`ZHICHUANG STUDIO  /  ${String(i+1).padStart(2,'0')}`,y:86,h:46,fontSize:24,color:accent}),
   node('subtitle',{name:'引导语',content:subtitle[i%8],y:i===0?500:320,h:100,fontSize:36,color:light?'#72767e':'#cad4df'}),
   ...(i>0&&i<7?[node('content',{type:'card',name:'内容要点',x:130,y:510,w:1660,h:340,fontSize:32,background:light?'rgba(255,255,255,.65)':'rgba(8,17,28,.72)',radius:16,items:[{id:`${pid}-a`,title:['理解需求','协同创新','创造价值'][i%3],description:'以真实场景为起点，建立清晰、可信的内容表达。'},{id:`${pid}-b`,title:'可感知的成果',description:'让复杂能力变得直观，让每一次沟通更有说服力。'},{id:`${pid}-c`,title:'持续向前',description:'连接内容、技术与体验，让价值不断生长。'}]})]:[]),
   node('footer',{name:'页脚',content:`${title}  ·  ${String(i+1).padStart(2,'0')}`,y:984,h:40,fontSize:22,color:light?'#92969c':'#a6b5c4'})
  ]};
 });
}

export function parseBranch(label:string):{label:string;condition:string}{const parts=label.split('\n[条件] ');return {label:parts[0],condition:parts[1]||'any'}};
export function formatBranch(label:string,condition:string):string{return condition==='any'?label:`${label}\n[条件] ${condition}`;}
export function isBranchAvailable(label:string,preference:string):boolean {const {condition}=parseBranch(label);return condition==='any'||condition===preference;}
