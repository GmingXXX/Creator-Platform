import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { exportRuntime } from '../src/domain/export-runtime';
import type { SceneNode, Work } from '../src/domain/types';

// A small DOM contract harness exercises the shipped script; real browser/media
// layout verification remains a separate E2E task in docs/开发验收清单.md.
type Handler = (event: {target: ElementStub; stopPropagation: () => void; preventDefault: () => void; key?: string}) => void;
class ElementStub {
  tagName:string; className=''; textContent=''; value=''; style:Record<string,string|((key:string,value:string)=>void)>={setProperty:(key:string,value:string)=>{this.style[key]=value}}; dataset:Record<string,string>={};
  attributes:Record<string,string>={}; children:ElementStub[]=[]; events:Record<string,Handler[]>={}; hidden=false; open=false; tabIndex=-1;
  clientWidth=1920; clientHeight=1080; namespaceURI='http://www.w3.org/2000/svg';
  classList={toggle: (_name:string) => true};
  constructor(tag:string){this.tagName=tag.toLowerCase();}
  append(...children:ElementStub[]){this.children.push(...children);}
  prepend(...children:ElementStub[]){this.children.unshift(...children);}
  replaceChildren(...children:ElementStub[]){this.children=[...children];}
  setAttribute(name:string,value:string){this.attributes[name]=value;}
  addEventListener(name:string,handler:Handler){this.events[name]=[...(this.events[name]||[]),handler];}
  fire(name:string,extra:Partial<Parameters<Handler>[0]>={}){for(const handler of this.events[name]||[])handler({target:this,stopPropagation(){},preventDefault(){},...extra});}
  all():ElementStub[]{return this.children.flatMap(child=>[child,...child.all()]);}
  querySelectorAll<T=ElementStub>(selector:string):T[]{return this.all().filter(child=>selector.split(',').some(piece=>piece.trim().startsWith('.')?child.className.split(' ').includes(piece.trim().slice(1)):child.tagName===piece.trim())) as T[];}
  querySelector<T=ElementStub>(selector:string):T|null{return this.querySelectorAll<T>(selector)[0]||null;}
  showModal(){this.open=true;} close(){this.open=false;} focus(){}
}
const node=(patch:Partial<SceneNode>={}):SceneNode=>({id:'title',type:'text',name:'标题',content:'离线文本',x:10,y:20,w:700,h:100,color:'#fff',background:'transparent',fontSize:32,radius:8,rotation:0,opacity:1,hidden:false,locked:false,...patch});
const work=(nodes:SceneNode[]):Work=>({id:'w',projectId:'p',title:'测试展项',kind:'exhibit',type:'时间演进型',width:1920,height:1080,styleId:'technology',pages:[{id:'home',name:'首页',background:'#123',nodes}],revision:1,createdAt:'2026-11-06',updatedAt:'2026-11-06'});
function harness(scene:Work){
  const pending:(()=>void)[]=[];
  const animations:{state:string;frames:unknown;options:unknown;play:()=>void;pause:()=>void;cancel:()=>void}[]=[];
  class MediaStub extends ElementStub {
    paused=true;
    play(){this.paused=false;this.fire('play');return Promise.resolve();}
    pause(){if(!this.paused){this.paused=true;pending.push(()=>this.fire('pause'));}}
  }
  class VideoStub extends MediaStub {}
  const create=(tag:string)=>{
    const element=tag==='video'?new VideoStub(tag):tag==='audio'?new MediaStub(tag):new ElementStub(tag);
    Object.assign(element,{animate:(frames:unknown,options:unknown)=>{const animation={state:'running',frames,options,play(){this.state='running';},pause(){this.state='paused';},cancel(){this.state='cancelled';}};animations.push(animation);return animation;}});
    return element;
  };
  const ids=['scene-data','stage','viewport','page-nav','detail','detail-body','command-result','command-panel','command-form','command-input','command-toggle','close-detail','fullscreen'];
  const elements=Object.fromEntries(ids.map(id=>[id,create(id==='detail'?'dialog':'div')]));
  elements['scene-data'].textContent=JSON.stringify(scene);
  const document={getElementById:(id:string)=>elements[id],createElement:create,createElementNS:(_ns:string,tag:string)=>create(tag),documentElement:create('html')};
  runInNewContext(exportRuntime(),{document,window:{matchMedia:()=>({matches:false}),addEventListener(){}},HTMLVideoElement:VideoStub});
  const findNode=(id:string)=>elements.stage.children.find(child=>child.dataset.nodeId===id)!;
  return {elements,findNode,animations,flush:()=>{while(pending.length)pending.shift()!();},media:(id:string)=>findNode(id).querySelector<MediaStub>('video, audio')!};
}

describe('offline runtime behavior',()=>{
  it('exports alternating fishbone events, full detail and explicit missing-image state',()=>{
    const app=harness(work([node({id:'fish',type:'timeline',timelineLayout:'fishbone',h:620,items:[
      {id:'a',year:'2012',title:'企业成立',description:'首个研发中心正式建立。',image:'assets/a.png'},
      {id:'b',year:'2016',title:'新品量产',description:'完整的事件正文，不应被摘要替代。'},
    ]})]));
    const timeline=app.findNode('fish').querySelector('.fishbone');
    expect(timeline).not.toBeNull();
    const events=timeline!.querySelectorAll('.fishbone-event');
    expect(events.map(e=>e.className)).toEqual(['fishbone-event is-upper','fishbone-event is-lower']);
    expect(timeline!.querySelectorAll('.fishbone-year').map(e=>e.textContent)).toEqual(['2012','2016']);
    expect(timeline!.querySelector('.fishbone-missing')?.textContent).toBe('暂无配图');
    timeline!.querySelectorAll('.fishbone-card')[1].fire('click');
    expect(app.elements.detail.open).toBe(true);
    expect(app.elements['detail-body'].querySelector('p')?.textContent).toBe('完整的事件正文，不应被摘要替代。');
  });

  it('does not emit broken media controls for unfilled editor containers',()=>{
    const app=harness(work([
      node({id:'photo',type:'image'}),
      node({id:'movie',type:'video'}),
      node({id:'sound',type:'audio'}),
    ]));
    expect(app.elements.stage.querySelectorAll('img, video, audio')).toHaveLength(0);
  });

  it('keeps image and video fit settings in the exported runtime',()=>{
    const app=harness(work([
      node({id:'photo',type:'image',src:'assets/photo.png',mediaFit:'contain'}),
      node({id:'movie',type:'video',src:'assets/movie.mp4',mediaFit:'contain'}),
      node({id:'cover',type:'image',src:'assets/cover.png'}),
    ]));
    expect(app.findNode('photo').querySelector('img')?.style.objectFit).toBe('contain');
    expect(app.findNode('movie').querySelector('video')?.style.objectFit).toBe('contain');
    expect(app.findNode('cover').querySelector('img')?.style.objectFit).toBe('cover');
  });

  it('embeds a supplied HTML program in an isolated frame instead of replacing its contents',()=>{
    const app=harness(work([node({id:'program',type:'html',src:'assets/program.html',name:'互动程序'})]));
    const frame=app.findNode('program').querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.attributes.sandbox).toBe('allow-scripts');
    expect(frame?.attributes.src).toBe('assets/program.html');
    expect(frame?.attributes.title).toBe('互动程序');
    expect(app.findNode('program').querySelector('.html-links')).toBeNull();
  });

  it('renders all controlled component kinds without fetching resources or inserting user HTML',()=>{
    const kinds:SceneNode['type'][]=['text','image','video','audio','shape','card','timeline','gallery','graph','map','flow','chart','bubble','button','html'];
    const nodes=kinds.map((type,index)=>node({id:`node-${index}`,type,src:'assets/local.png',items:[{id:'item',title:'事件',description:'说明',image:'assets/local.png',value:0,x:0,y:0}]}));
    nodes[0].content='<script>alert("bad")</script>';
    const app=harness(work(nodes));
    expect(app.elements.stage.children).toHaveLength(kinds.length);
    expect(app.findNode('node-0').querySelector('.text')?.textContent).toBe(nodes[0].content);
    expect(app.elements.stage.querySelector('script')).toBeNull();
    expect(app.findNode('node-11').querySelector('.chart-column')?.children[0].textContent).toBe('0');
  });

  it('switches a target bubble state without replacing its text with the trigger button text',()=>{
    const app=harness(work([
      node({id:'trigger',type:'button',content:'开始讲解',interactions:[{id:'state',event:'click',action:'state',targetId:'bubble'}]}),
      node({id:'bubble',type:'bubble',content:'欢迎来到创新展厅'}),
    ]));
    app.findNode('trigger').fire('click');
    expect(app.findNode('bubble').dataset.state).toBe('聆听');
    expect(app.findNode('bubble').querySelector('.bubble-label')?.textContent).toBe('聆听 · 欢迎来到创新展厅');
  });

  it('ignores queued old media pause events after navigation',()=>{
    const scene=work([node({id:'movie',type:'video',src:'assets/movie.mp4'})]);
    scene.pages.push({id:'next',name:'下一页',background:'#234',nodes:[node({id:'animated',motion:{preset:'淡入',duration:1,delay:0,easing:'linear',hold:true}})]});
    const app=harness(scene);
    app.media('movie').play();
    app.elements['page-nav'].children[1].fire('click');
    app.flush();
    expect(app.animations.at(-1)?.state).toBe('running');
    expect(app.findNode('animated')).toBeDefined();
  });

  it('preserves parent-child nesting in tree graph items',()=>{
    const app=harness(work([node({id:'tree',type:'graph',items:[
      {id:'technology',title:'技术',description:'一级'},
      {id:'vision',parentId:'technology',title:'机器视觉',description:'二级'},
      {id:'inspection',parentId:'vision',title:'工业质检',description:'三级'},
    ]})]));
    const tree=app.findNode('tree');
    const branches=tree.querySelectorAll('.graph-branch');
    expect(branches).toHaveLength(3);
    expect(branches[0].querySelectorAll('.graph-branch')).toHaveLength(2);
    expect(branches[1].querySelectorAll('.graph-branch')).toHaveLength(1);
  });

  it('runs details, visibility, page navigation and scoped text commands',()=>{
    const scene=work([
      node({id:'toggle',type:'button',interactions:[{id:'toggle-action',event:'click',action:'toggle',targetId:'title'}]}),
      node({id:'title',commands:[{id:'cmd',phrase:'前往下一页',aliases:'下一页，继续',action:'navigate',targetId:'next',enabled:true,scope:'page'}]}),
      node({id:'timeline',type:'timeline',items:[{id:'event',title:'<img onerror=bad>',description:'真实详情'}]}),
    ]);
    scene.pages.push({id:'next',name:'下一页',background:'#234',nodes:[node({id:'next-text'})]});
    const app=harness(scene);
    app.findNode('toggle').fire('click'); expect(app.findNode('title').hidden).toBe(true);
    app.findNode('toggle').fire('click'); expect(app.findNode('title').hidden).toBe(false);
    app.findNode('timeline').querySelector('.event-card')!.fire('click');
    expect(app.elements.detail.open).toBe(true);
    expect(app.elements['detail-body'].querySelector('h2')?.textContent).toBe('<img onerror=bad>');
    app.elements['close-detail'].fire('click'); expect(app.elements.detail.open).toBe(false);
    app.elements['command-input'].value='下一页！'; app.elements['command-form'].fire('submit');
    expect(app.findNode('next-text')).toBeDefined();
    expect(app.elements['command-result'].textContent).toContain('已匹配');
    app.elements['command-form'].fire('submit');
    expect(app.elements['command-result'].textContent).toContain('未匹配');
  });
});
