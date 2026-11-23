import type { ContentItem, SceneNode, Work } from './types';
import fishboneStyles from '../styles/fishbone.css?raw';

// This function deliberately has no runtime imports: its source is the offline bundle.
function mountRuntime() {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const scene = JSON.parse(byId('scene-data').textContent || '{}') as Work;
  const stage = byId('stage');
  const viewport = byId('viewport');
  const nav = byId('page-nav');
  const dialog = byId<HTMLDialogElement>('detail');
  const result = byId('command-result');
  let pageId = scene.pages[0].id;
  let generation = 0;
  let animations: Animation[] = [];
  const elements = new Map<string, HTMLElement>();
  const stateNames = ['待机', '聆听', '思考', '播报'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) => {
    const item = document.createElement(tag); item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const button = (label: string, action: () => void, className = '') => {
    const item = el('button', className, label); item.type = 'button';
    item.addEventListener('click', event => { event.stopPropagation(); action(); });
    return item;
  };
  const image = (src: string, alt = '') => {
    const img = el('img'); img.src = src; img.alt = alt; img.draggable = false;
    return img;
  };
  function showDetail(item: ContentItem) {
    const body = byId('detail-body'); body.replaceChildren();
    if (item.image) body.append(image(item.image, item.title));
    const copy = el('div', 'detail-copy');
    if (item.year) copy.append(el('small', '', item.year));
    copy.append(el('h2', '', item.title), el('p', '', item.description));
    copy.append(button('返回浏览', () => dialog.close()));
    body.append(copy); dialog.showModal();
  }
  function act(node: SceneNode, action: string, targetId?: string) {
    const target = elements.get(targetId || node.id);
    if (action === 'navigate') { if (scene.pages.some(page => page.id === targetId)) render(targetId!); return; }
    if (['show', 'hide', 'toggle'].includes(action)) {
      if (target) target.hidden = action === 'hide' ? true : action === 'show' ? false : !target.hidden;
      return;
    }
    if (action === 'play') {
      const media = target?.querySelector<HTMLMediaElement>('video, audio');
      if (media) { if (media.paused) void media.play().catch(() => { result.textContent = '请点击媒体播放按钮开始播放'; }); else media.pause(); }
      return;
    }
    if (action === 'state' && target) {
      const state = stateNames[(stateNames.indexOf(target.dataset.state || '待机') + 1) % 4];
      target.dataset.state = state;
      const label = target.querySelector('.bubble-label');
      if (label) label.textContent = `${state} · ${target.dataset.content || ''}`;
      return;
    }
    showDetail({id: node.id, title: node.name, description: node.content, image: node.type === 'image' ? node.src : node.items?.[0]?.image});
  }
  function runInteractions(node: SceneNode, event: 'click' | 'videoStart') {
    (node.interactions || []).filter(item => item.event === event).forEach(item => act(node, item.action, item.targetId));
  }
  function media(node: SceneNode) {
    if (node.type === 'image') {
      const picture=image(node.src || '',node.name);
      picture.style.objectFit=node.mediaFit==='contain'?'contain':'cover';
      return picture;
    }
    const item = el(node.type === 'audio' ? 'audio' : 'video');
    item.style.objectFit=node.mediaFit==='contain'?'contain':'cover';
    const mediaGeneration = generation;
    item.src = node.src || ''; item.controls = true; item.preload = 'metadata';
    if (item instanceof HTMLVideoElement) item.playsInline = true;
    item.addEventListener('play', () => {
      if (mediaGeneration !== generation) return;
      runInteractions(node, 'videoStart');
      if (mediaGeneration === generation) animations.forEach(animation => animation.play());
    });
    const pause = () => { if (mediaGeneration === generation) animations.forEach(animation => animation.pause()); };
    item.addEventListener('pause', pause); item.addEventListener('ended', pause);
    return item;
  }
  function contentCard(item: ContentItem, timeline = false) {
    const card = button('', () => showDetail(item), timeline ? 'event-card' : 'content-card');
    if (item.image) card.append(image(item.image, item.title));
    const copy = el('div', 'card-copy');
    if (item.category) copy.append(el('small', '', item.category));
    copy.append(el('h3', '', item.title), el('p', '', item.description), el('span', 'more', '探索更多 ↗'));
    card.append(copy); return card;
  }
  function fishbone(node: SceneNode) {
    const root=el('div','fishbone');
    root.style.setProperty('--fishbone-card-height',`${Math.max(90,Math.min(240,(node.h-130)/2))}px`);
    root.style.setProperty('--fishbone-size',`${Math.max(16,Math.min(30,node.fontSize))}px`);
    const viewport=el('div','fishbone-viewport');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','企业鱼骨时间轴');
    const track=el('div','fishbone-track');
    (node.items||[]).forEach((item,index)=>{
      const event=el('div',`fishbone-event ${index%2?'is-lower':'is-upper'}`);
      const card=button('',()=>showDetail(item),'fishbone-card');card.setAttribute('aria-label',`${item.year||''} ${item.title}`);
      if(item.image){const picture=image(item.image,item.title);picture.addEventListener('error',()=>picture.replaceWith(el('span','fishbone-missing','暂无配图')));card.append(picture);}else card.append(el('span','fishbone-missing','暂无配图'));
      const copy=el('span','fishbone-copy');copy.append(el('strong','',item.title),el('p','',item.description),el('small','','查看事件详情 ↗'));card.append(copy);
      event.append(el('span','fishbone-stem'),el('span','fishbone-dot'),el('strong','fishbone-year',item.year||'日期待补'),card);track.append(event);
    });
    viewport.append(track);
    let drag:{id:number;x:number;left:number;scale:number;moved:boolean}|null=null,suppress=false;
    viewport.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.stopPropagation();suppress=false;drag={id:event.pointerId,x:event.clientX,left:viewport.scrollLeft,scale:viewport.getBoundingClientRect().width/viewport.clientWidth||1,moved:false};});
    viewport.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const delta=(event.clientX-drag.x)/drag.scale;if(Math.abs(delta)>7){drag.moved=true;suppress=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');}if(drag.moved){event.preventDefault();event.stopPropagation();viewport.scrollLeft=drag.left-delta;}});
    const end=(event:PointerEvent)=>{if(drag?.id!==event.pointerId)return;drag=null;viewport.classList.remove('is-dragging');if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);window.setTimeout(()=>{suppress=false;},0);};
    viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
    viewport.addEventListener('click',event=>{if(suppress){event.preventDefault();event.stopPropagation();suppress=false;}},true);
    const scroll=(direction:number)=>viewport.scrollBy({left:direction*Math.max(310,viewport.clientWidth*.65),behavior:reduced?'instant':'smooth'});
    viewport.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();scroll(event.key==='ArrowLeft'?-1:1);}});
    const controls=el('div','fishbone-controls'),previous=button('←',()=>scroll(-1)),next=button('→',()=>scroll(1));previous.setAttribute('aria-label','向前浏览时间轴');next.setAttribute('aria-label','向后浏览时间轴');controls.append(previous,el('span','','拖动浏览 · 点击事件查看详情'),next);root.append(viewport,controls);return root;
  }
  function timeline(node: SceneNode) {
    if(node.timelineLayout==='fishbone')return fishbone(node);
    const root = el('div', 'timeline'); root.style.gap = `${node.gap ?? 24}px`;
    (node.items || []).forEach(item => {
      const event = el('div', 'timeline-event');
      event.append(el('strong', 'event-year', item.year || ''), el('span', 'event-dot'), contentCard(item, true)); root.append(event);
    });
    return root;
  }
  function graph(node: SceneNode) {
    const root = el('div', 'graph');
    root.append(el('strong', 'graph-root', node.content));
    const children = el('div', 'graph-children');
    const items = node.items || [];
    const ids = new Set(items.map(item => item.id));
    const placed = new Set<string>();
    const branch = (item: ContentItem): HTMLElement => {
      placed.add(item.id);
      const section = el('div', 'graph-branch'); section.append(contentCard({...item, image: undefined}));
      const nested = items.filter(child => child.parentId === item.id && !placed.has(child.id));
      if (nested.length) {
        const descendants = el('div', 'graph-descendants');
        nested.forEach(child => { if (!placed.has(child.id)) descendants.append(branch(child)); });
        section.append(descendants);
      }
      return section;
    };
    items.filter(item => !item.parentId || !ids.has(item.parentId)).forEach(item => children.append(branch(item)));
    items.filter(item => !placed.has(item.id)).forEach(item => { if (!placed.has(item.id)) children.append(branch(item)); });
    root.append(el('div', 'graph-lines'), children); return root;
  }
  function map(node: SceneNode) {
    const root = el('div', 'map');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 550');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', 'M130 160L205 133 232 66 300 89 351 139 414 95 452 140 511 126 561 68 617 80 657 130 702 127 733 188 811 176 838 224 890 248 857 304 791 315 773 371 702 400 661 468 607 429 555 436 520 481 479 443 447 380 376 362 339 320 269 336 227 294 168 279 127 226Z');
    svg.append(path); root.append(svg);
    (node.items || []).forEach((item, index) => {
      const point = button(`● ${item.title}`, () => showDetail(item), 'map-point');
      point.style.left = `${item.x ?? 32 + index * 21}%`; point.style.top = `${item.y ?? 42 + index % 2 * 24}%`; root.append(point);
    }); return root;
  }
  function flow(node: SceneNode) {
    const root = el('div', 'flow');
    (node.items || []).forEach((item, index) => {
      if (index) root.append(el('span', 'flow-arrow', '→'));
      const step = contentCard({...item, image: undefined});
      step.prepend(el('strong', 'flow-number', String(index + 1).padStart(2, '0'))); root.append(step);
    }); return root;
  }
  function chart(node: SceneNode) {
    const root = el('div', 'chart'); root.append(el('h3', '', node.content));
    const bars = el('div', 'chart-bars');
    const max = Math.max(1, ...(node.items || []).map(item => item.value ?? 0));
    (node.items || []).forEach(item => {
      const bar = button('', () => showDetail(item), 'chart-column');
      const fill = el('div', 'chart-fill'); fill.style.height = `${Math.max(0, (item.value ?? 0) / max * 100)}%`;
      bar.append(el('strong', '', String(item.value ?? 0)), fill, el('span', '', item.title)); bars.append(bar);
    }); root.append(bars); return root;
  }
  function bubble(node: SceneNode) {
    const root = el('div', 'bubble'); root.append(el('span', 'bubble-orb', '✦'));
    const copy = el('div'); copy.append(el('strong', 'bubble-label', node.state && node.state !== '待机' ? `${node.state} · ${node.content}` : node.content), el('small', '', 'AI 展厅讲解助手'));
    root.append(copy); const bars = el('div', 'voice-bars');
    for (let i = 0; i < 5; i++) { const bar = el('i'); bar.style.animationDelay = `${i * .12}s`; bars.append(bar); }
    root.append(bars); return root;
  }
  function controlledHtml(node: SceneNode) {
    if (node.src && /^assets\/[\w.-]+\.html$/i.test(node.src)) {
      const frame=el('iframe');
      frame.setAttribute('sandbox','allow-scripts');
      frame.setAttribute('referrerpolicy','no-referrer');
      frame.setAttribute('title',node.name||'交互程序');
      frame.setAttribute('src',node.src);
      Object.assign(frame.style,{width:'100%',height:'100%',border:'0',display:'block'});
      return frame;
    }
    const root = el('div', 'html-program'); root.append(el('span', 'html-orbit'), el('small', '', '互动探索'), el('h2', '', node.content || '触摸灵感，探索未来'), el('p', '', '选择一个方向，发现更多内容'));
    const items = node.items?.length ? node.items : ['创新技术', '应用场景', '未来愿景'].map(title => ({id: title, title, description: '融合数字技术与真实场景，让每一个想法成为可以体验的未来。'}));
    const links = el('div', 'html-links'); items.forEach(item => links.append(button(`${item.title} ↗`, () => showDetail(item))));
    root.append(links); return root;
  }
  function renderContent(node: SceneNode) {
    if (['image', 'video', 'audio'].includes(node.type)) return node.src ? media(node) : el('div');
    if (node.type === 'text') return el('div', 'text', node.content);
    if (node.type === 'button') return el('div', 'scene-button', `${node.content} →`);
    if (node.type === 'shape') return el('div', 'shape');
    if (node.type === 'timeline') return timeline(node);
    if (node.type === 'graph') return graph(node);
    if (node.type === 'map') return map(node);
    if (node.type === 'flow') return flow(node);
    if (node.type === 'chart') return chart(node);
    if (node.type === 'bubble') return bubble(node);
    if (node.type === 'html') return controlledHtml(node);
    const root = el('div', 'gallery'); root.style.gridTemplateColumns = `repeat(${node.type === 'card' ? 1 : Math.max(1, node.columns || 3)}, 1fr)`; root.style.gap = `${node.gap ?? 24}px`;
    (node.items?.length ? node.items : [{id: node.id, title: node.content, description: '', image: node.src}]).forEach(item => root.append(contentCard(item))); return root;
  }
  function motion(element: HTMLElement, node: SceneNode) {
    const config = node.motion;
    if (!config || config.preset === '无动效' || reduced || !element.animate) return;
    const presets: Record<string, Keyframe[]> = {
      '淡入': [{opacity: 0}, {opacity: 1}], '淡出': [{opacity: 1}, {opacity: 0}],
      '向上移入': [{transform: 'translateY(60px)', opacity: 0}, {transform: 'translateY(0)', opacity: 1}],
      '向下移入': [{transform: 'translateY(-60px)', opacity: 0}, {transform: 'translateY(0)', opacity: 1}],
      '向左移入': [{transform: 'translateX(60px)', opacity: 0}, {transform: 'translateX(0)', opacity: 1}],
      '向右移入': [{transform: 'translateX(-60px)', opacity: 0}, {transform: 'translateX(0)', opacity: 1}],
      '缩放进入': [{transform: 'scale(.8)', opacity: 0}, {transform: 'scale(1)', opacity: 1}],
      '缩放退出': [{transform: 'scale(1)', opacity: 1}, {transform: 'scale(.8)', opacity: 0}],
      '轻弹进入': [{transform: 'scale(.7)', opacity: 0}, {transform: 'scale(1.04)', opacity: 1}, {transform: 'scale(1)'}],
      '旋转进入': [{transform: 'rotate(-12deg)', opacity: 0}, {transform: 'rotate(0deg)', opacity: 1}],
      '模糊显现': [{filter: 'blur(16px)', opacity: 0}, {filter: 'blur(0px)', opacity: 1}],
      '强调脉冲': [{transform: 'scale(1)'}, {transform: 'scale(1.06)'}, {transform: 'scale(1)'}],
      '呼吸高亮': [{filter: 'brightness(1)'}, {filter: 'brightness(1.5)'}, {filter: 'brightness(1)'}],
      '左右摇摆': [{transform: 'translateX(0)'}, {transform: 'translateX(-12px)'}, {transform: 'translateX(12px)'}, {transform: 'translateX(0)'}],
      '页面推进': [{transform: 'translateX(100%)'}, {transform: 'translateX(0)'}],
      '翻页转场': [{transform: 'perspective(1000px) rotateY(-90deg)', opacity: 0}, {transform: 'perspective(1000px) rotateY(0deg)', opacity: 1}],
    };
    const duration = Math.max(.1, Math.min(120, config.duration));
    const frames = config.keyframes?.length ? [...config.keyframes].sort((a, b) => a.time - b.time).map(frame => ({offset: Math.max(0, Math.min(1, frame.time / duration)), transform: `translateX(${frame.x}px)`, opacity: frame.opacity})) : presets[config.preset] || presets['淡入'];
    const animation = element.animate(frames, {duration: duration * 1000, delay: Math.max(0, config.delay) * 1000, easing: ['linear','ease','ease-in','ease-out','ease-in-out'].includes(config.easing) ? config.easing : 'ease-out', fill: config.hold ? 'forwards' : 'backwards'});
    animations.push(animation);
  }
  function fit() {
    const scale = Math.min(viewport.clientWidth / scene.width, viewport.clientHeight / scene.height);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  function applyTypography(root:HTMLElement,node:SceneNode) {
    const apply=(element:HTMLElement,style:Partial<SceneNode>)=>{
      if(style.fontFamily)element.style.fontFamily=style.fontFamily;
      if(Number.isFinite(style.fontSize)&&style.fontSize!>0)element.style.fontSize=`${style.fontSize}px`;
      if(Number.isFinite(style.fontWeight)&&style.fontWeight!>=100&&style.fontWeight!<=900)element.style.fontWeight=String(style.fontWeight);
      if(['left','center','right','justify'].includes(style.textAlign||''))element.style.textAlign=style.textAlign!;
      if(Number.isFinite(style.lineHeight)&&style.lineHeight!>0)element.style.lineHeight=String(style.lineHeight);
      if(style.color)element.style.color=style.color;
    };
    const common={fontFamily:node.fontFamily,fontWeight:node.fontWeight,textAlign:node.textAlign,lineHeight:node.lineHeight};
    apply(root,common);
    root.querySelectorAll<HTMLElement>('h2,h3,b,strong,.text,.scene-text,.scene-button,.map-point').forEach(element=>apply(element,{...common,...(node.type==='text'||node.type==='button'?{}:node.titleStyle)}));
    root.querySelectorAll<HTMLElement>('p,small,.chart-column>span').forEach(element=>apply(element,{...common,...node.bodyStyle}));
  }
  function render(nextPageId: string) {
    generation++;
    stage.querySelectorAll<HTMLMediaElement>('video, audio').forEach(item => item.pause());
    animations.forEach(animation => animation.cancel()); animations = []; elements.clear();
    if (dialog.open) dialog.close(); stage.replaceChildren(); nav.replaceChildren(); pageId = nextPageId;
    const page = scene.pages.find(item => item.id === pageId)!;
    stage.style.width = `${scene.width}px`; stage.style.height = `${scene.height}px`;
    stage.style.background = page.background; stage.style.backgroundImage = page.backgroundImage ? `url("${page.backgroundImage}")` : '';
    page.nodes.forEach(node => {
      const root = el('div', `node node-${node.type}`); root.dataset.nodeId = node.id; root.dataset.state = node.state || '待机'; root.dataset.content = node.content; root.hidden = node.hidden;
      Object.assign(root.style, {left: `${node.x}px`, top: `${node.y}px`, width: `${node.w}px`, height: `${node.h}px`, transform: `rotate(${node.rotation}deg)`, opacity: String(node.opacity), color: node.color, background: node.background, fontSize: `${node.fontSize}px`, borderRadius: `${node.radius}px`});
      const content = el('div', 'node-inner'); content.append(renderContent(node)); root.append(content);applyTypography(root,node);
      if (node.interactions?.some(item => item.event === 'click')) {
        root.tabIndex = 0; root.setAttribute('role', 'button'); root.setAttribute('aria-label', node.name);
        root.addEventListener('click', () => runInteractions(node, 'click'));
        root.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === root) { event.preventDefault(); runInteractions(node, 'click'); } });
      }
      elements.set(node.id, root); stage.append(root); motion(content, node);
    });
    scene.pages.forEach((item, index) => { const link = button(`${index + 1} · ${item.name}`, () => render(item.id)); link.setAttribute('aria-current', String(item.id === pageId)); nav.append(link); });
    nav.hidden = scene.pages.length < 2; fit();
  }
  const normalize = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  byId<HTMLFormElement>('command-form').addEventListener('submit', event => {
    event.preventDefault(); const input = normalize(byId<HTMLInputElement>('command-input').value);
    if (!input) { result.textContent = '请输入要测试的口令'; return; }
    const matches = scene.pages.flatMap(page => page.nodes.flatMap(node => (node.commands || []).filter(command => command.enabled && (command.scope === 'global' || page.id === pageId) && [command.phrase, ...command.aliases.split(/[,，;；]/)].some(phrase => normalize(phrase) === input)).map(command => ({node, command})))).sort((a, b) => Number(a.command.scope === 'global') - Number(b.command.scope === 'global'));
    if (!matches.length) { result.textContent = '未匹配口令，请检查当前页面的命令'; return; }
    const {node, command} = matches[0]; act(node, command.action, command.targetId); result.textContent = `已匹配「${command.phrase}」`;
  });
  byId('command-toggle').addEventListener('click', () => { byId('command-panel').classList.toggle('open'); byId('command-input').focus(); });
  byId('close-detail').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  byId('fullscreen').addEventListener('click', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => { result.textContent = '当前浏览器未启用全屏'; }); });
  window.addEventListener('resize', fit); render(pageId);
}

export const exportRuntime = () => `(${mountRuntime.toString()})();`;

export const exportStyles = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080b12;color:#eef3fa;font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}button,input{font:inherit}button{cursor:pointer;color:inherit}button:focus-visible,[tabindex]:focus-visible{outline:3px solid #6bbdff;outline-offset:4px}button{border:0}button:disabled{cursor:default}[hidden]{display:none!important}#viewport{position:absolute;inset:0 0 44px;overflow:hidden}#stage{position:absolute;left:50%;top:50%;transform-origin:center;background-size:cover;background-position:center;overflow:hidden}.node{position:absolute}.node-inner{width:100%;height:100%;border-radius:inherit;overflow:hidden}.node img,.node video{width:100%;height:100%;object-fit:cover;display:block}.node-audio .node-inner{display:flex;align-items:center;justify-content:center}.node audio{width:90%;margin:0}.text{white-space:pre-wrap;width:100%;height:100%;display:flex;align-items:center;font-weight:600;line-height:1.4}.shape{width:100%;height:100%}.scene-button{display:flex;align-items:center;justify-content:center;width:100%;height:100%;gap:20px}.gallery{display:grid;height:100%}.content-card,.event-card{padding:0;text-align:left;border:1px solid #ffffff18;background:#0a1c2eb3;color:inherit;border-radius:12px;overflow:hidden;position:relative;transition:background .18s,transform .18s}.content-card:hover,.event-card:hover{background:#16364dd9;transform:translateY(-3px)}.content-card img{height:50%;min-height:100px}.card-copy{padding:24px}.card-copy h3{font-size:1.05em;margin:8px 0 12px}.card-copy p{font-size:.7em;line-height:1.6;opacity:.66;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.card-copy small{font-size:.52em;text-transform:uppercase;letter-spacing:.12em;color:#74bdff}.more{display:block;font-size:.55em;margin-top:18px;color:#8fc7ff}.timeline{height:100%;display:flex;align-items:flex-start;position:relative;padding-top:30px}.timeline:before{content:"";height:2px;background:#79bdff66;position:absolute;left:0;right:0;top:105px}.timeline-event{flex:1;min-width:0;position:relative}.event-year{font-size:1.8em;display:block;font-weight:400;color:#b0d7ff}.event-dot{display:block;width:15px;height:15px;border:3px solid #b3d9ff;background:#236f9c;border-radius:50%;margin:18px 0 24px;box-shadow:0 0 18px #64b7ff66}.event-card{width:100%;height:calc(100% - 100px)}.event-card img{height:160px}.graph{height:100%;display:flex;align-items:center;flex-direction:column;padding:24px;position:relative}.graph-root{padding:28px 40px;background:#16476c;border:1px solid #75c3ff70;border-radius:16px;z-index:1}.graph-lines{width:75%;height:80px;border:2px solid #7fbce05c;border-bottom:0;margin-top:48px;position:relative}.graph-lines:before{content:"";position:absolute;left:50%;top:-50px;height:50px;border-left:2px solid #7fbce05c}.graph-children{display:flex;gap:24px;align-self:stretch}.graph-children>*{flex:1;min-width:0}.graph-branch{display:flex;flex-direction:column;align-items:center;flex:1;min-width:0}.graph-branch>.content-card{width:100%;flex-shrink:0}.graph-descendants{display:flex;gap:16px;width:100%;margin-top:28px;position:relative;padding-top:12px;border-top:1px solid #7fbce05c}.graph-descendants:before{content:"";position:absolute;left:50%;height:28px;top:-28px;border-left:1px solid #7fbce05c}.map{height:100%;position:relative;background-image:linear-gradient(#6bafff10 1px,transparent 1px),linear-gradient(90deg,#6bafff10 1px,transparent 1px);background-size:35px 35px}.map svg{width:100%;height:100%;fill:#58a8d533;stroke:#a7dfff;stroke-opacity:.5;stroke-width:2}.map-point{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;background:#102b46cc;border:1px solid #77c5ff66;border-radius:30px;padding:12px 18px;font-size:.7em;box-shadow:0 0 20px #61adfa25}.map-point:hover{background:#205484}.flow{display:flex;gap:22px;align-items:center;height:100%;padding:24px}.flow>.content-card{flex:1;min-width:0}.flow-number{font-size:2.7em;display:block;padding:24px 24px 0;color:#7fc6ff;font-weight:300}.flow-arrow{opacity:.5}.chart{height:100%;padding:32px 45px;display:flex;flex-direction:column}.chart h3{font-size:1.2em;font-weight:400;margin:0 0 25px}.chart-bars{flex:1;display:flex;align-items:flex-end;gap:35px;min-height:0;border-bottom:1px solid #ffffff30}.chart-column{flex:1;background:none;height:85%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:12px}.chart-column>strong{font-size:1.2em;font-weight:400}.chart-column>span{font-size:.65em;white-space:nowrap}.chart-fill{background:linear-gradient(#6fc8fa,#236290);width:70%;min-height:3px;border-radius:6px 6px 0 0;max-height:82%}.bubble{display:flex;align-items:center;gap:22px;padding:24px;height:100%}.bubble-orb{font-size:2.2em;color:#9fe7ff;background:#2a5dbd30;border:1px solid #abdbff55;border-radius:50%;width:70px;height:70px;display:grid;place-items:center;flex-shrink:0}.bubble strong{display:block;font-size:.8em;line-height:1.5}.bubble small{display:block;font-size:.5em;opacity:.5;margin-top:8px}.voice-bars{display:flex;gap:4px;align-items:center;height:40px;margin-left:auto}.voice-bars i{display:block;width:4px;height:18px;background:#7dcaff;border-radius:3px;animation:wave 1.2s infinite ease-in-out}.html-program{height:100%;position:relative;display:flex;flex-direction:column;justify-content:center;padding:50px;background:radial-gradient(ellipse at 85% 30%,#348ec144,transparent 65%)}.html-program small{font-size:.55em;letter-spacing:.2em;color:#8ed5ff}.html-program h2{font-size:1.4em;margin:18px 0}.html-program p{font-size:.7em;opacity:.6}.html-links{display:flex;gap:15px;margin-top:20px}.html-links button{padding:15px 20px;border:1px solid #ffffff2a;border-radius:8px;background:#ffffff0b;font-size:.65em}.html-links button:hover{background:#58a8d52b}#page-nav{position:absolute;bottom:0;left:0;right:0;height:44px;display:flex;align-items:center;justify-content:center;gap:8px;background:#080b12}#page-nav button{background:transparent;color:#92a1b5;font-size:12px;padding:7px 14px;border-radius:6px}#page-nav button[aria-current=true]{background:#203e5c;color:#eef5ff}#fullscreen,#command-toggle{position:fixed;background:#101c2be6;border:1px solid #ffffff26;border-radius:8px;padding:9px 13px;font-size:12px;z-index:4}#fullscreen{right:16px;top:16px;font-size:20px}#command-toggle{bottom:8px;right:16px}#command-panel{display:none;position:fixed;right:16px;bottom:52px;z-index:5;width:320px;padding:20px;background:#101c2bf2;border:1px solid #ffffff26;border-radius:12px;font-size:13px;box-shadow:0 18px 50px #0008}#command-panel.open{display:block}#command-form{display:flex;margin:12px 0;gap:6px}#command-form input{width:100%;min-width:0;background:#ffffff10;color:white;border:1px solid #ffffff26;border-radius:5px;padding:9px}#command-form button{background:#246b9f;white-space:nowrap;border-radius:5px;padding:8px}#command-result{display:block;font-size:12px;line-height:1.6;color:#acd4f7}dialog{padding:0;border:1px solid #ffffff25;border-radius:18px;background:#102033;color:#f4f7ff;max-width:850px;width:min(850px,85vw);max-height:85vh;box-shadow:0 30px 150px #000b}dialog::backdrop{background:#030915b9;backdrop-filter:blur(8px)}#detail-body>img{display:block;width:100%;max-height:42vh;object-fit:cover}.detail-copy{padding:32px 40px}.detail-copy h2{font-size:28px;margin:12px 0}.detail-copy p{font-size:16px;line-height:1.9;opacity:.7;white-space:pre-wrap}.detail-copy small{color:#84c8ff}.detail-copy button{background:#1c5380;padding:12px 25px;border-radius:7px}#close-detail{position:absolute;right:15px;top:15px;width:36px;height:36px;border-radius:50%;background:#081522bb;color:white;font-size:24px;z-index:1}@keyframes wave{50%{height:34px;opacity:.55}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}` + fishboneStyles;
