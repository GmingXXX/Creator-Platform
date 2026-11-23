import type {Asset, EditTarget, SceneNode, Work} from './types';
import {uid} from './scenes';
import {isLocalRelayoutRequest,relayoutWork} from './agent-relayout';

export interface SceneRevision { ok: boolean; summary: string; work?: Work }
const reject = (summary: string): SceneRevision => ({ok: false, summary});
const success = (work: Work, summary: string): SceneRevision => ({ok: true, work, summary});
const clean = (text: string) => text.trim().replace(/^[“”「」『』"'\s]+|[“”「」『』"'。！\s]+$/g, '');
const instructions = '当前可重新排版页面或作品、调整背景、修改标题与文字、调整字号、追加时间轴节点，或用附件替换选中图片。请说明具体修改。';

// Quoted replacement text is data, even when it contains command words.
function hasMultipleOperations(prompt: string): boolean {
  const unquoted = prompt.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"|'[^']*'/g, '文字内容');
  const clauses = unquoted.split(/[，,；;。！!？?\n]|并且|同时|然后|以及|并|再(?=把|将|让|请|改|换|设|增|添|调|放|缩)|且/);
  const action = /改|换|设|变|放大|缩小|增大|减小|增加|新增|添加|追加|调整|删除|移除|移动/;
  const subject = /背景|标题|文字|文本|内容|字号|字体|节点|事件|年份|时间轴|图片|照片|组件|布局|页面/;
  return clauses.filter(clause => action.test(clause) && subject.test(clause)).length > 1;
}

function colorFrom(prompt: string): string | undefined {
  const hex = prompt.match(/#[\da-f]{6}\b|#[\da-f]{3}\b/i)?.[0];
  if (hex) return hex;
  const named: [RegExp, string][] = [
    [/暖色|暖调|暖棕|琥珀/, '#5b3528'], [/深蓝|蓝色|冷色/, '#173b5b'],
    [/红色|酒红/, '#6f2634'], [/绿色|深绿/, '#164e45'], [/紫色/, '#403357'],
    [/白色|浅色|米白/, '#f5f2ec'], [/黑色|深色/, '#16181d'], [/灰色/, '#626873'],
  ];
  return named.find(([pattern]) => pattern.test(prompt))?.[1];
}

function nodesIn(work: Work, target: EditTarget): {pageId: string; node: SceneNode}[] {
  return work.pages.filter(page => target.scope === 'work' || page.id === target.pageId)
    .flatMap(page => page.nodes.filter(node => target.scope !== 'node' || node.id === target.nodeId)
      .map(node => ({pageId: page.id, node})));
}

function patchNodes(work: Work, ids: string[], patch: (node: SceneNode) => SceneNode): Work {
  return {...work, pages: work.pages.map(page => ({...page, nodes: page.nodes.map(node => ids.includes(node.id) ? patch(node) : node)}))};
}

function titleRevision(work: Work, prompt: string, target: EditTarget): SceneRevision | undefined {
  const match = prompt.match(/(?:标题|文字|文本|内容)(?:\s*)(?:修改为|修改|改为|改成|换成|替换为|设为|设置为|变成)\s*[:：]?\s*(.+)$/);
  if (!match) return;
  const content = clean(match[1]);
  if (!content || content.length > 500) return reject('请输入 1–500 字的文字内容。');
  const candidates = nodesIn(work, target).filter(({node}) => node.type === 'text');
  const chosen = target.scope === 'node' ? candidates[0] : candidates.find(({node}) => node.name === '主标题') || [...candidates].sort((a,b)=>b.node.fontSize-a.node.fontSize)[0];
  if (!chosen) return reject('当前范围没有可修改的文字组件，请先选中文字。');
  if (chosen.node.locked) return reject('目标文字已锁定，请先解锁后再修改。');
  let next = patchNodes(work, [chosen.node.id], node => ({...node, content}));
  if (target.scope === 'work' && /标题/.test(prompt)) next = {...next, title: content.slice(0,80)};
  if (target.scope === 'page' && /标题/.test(prompt)) next = {...next, pages: next.pages.map(page => page.id === target.pageId ? {...page, name: content.slice(0,40)} : page)};
  return success(next, `已将${target.scope === 'node' ? '选中文字' : '标题'}改为「${content}」，其他内容保持不变。`);
}

function backgroundRevision(work: Work, prompt: string, target: EditTarget, attachments: Asset[]): SceneRevision | undefined {
  if (!/背景/.test(prompt)) return;
  const image = attachments.find(asset => asset.kind === 'image');
  const color = colorFrom(prompt);
  if (!color && !image) return reject('可以指定背景颜色，例如“把背景改成暖色”；也可以上传图片后要求替换背景。');
  if (target.scope === 'node') {
    const selected = nodesIn(work, target)[0].node;
    if (image && selected.type === 'image') return success(patchNodes(work,[selected.id],node=>({...node,src:image.src,assetId:image.id})), '已用附件替换选中的图片，尺寸与交互保持不变。');
    if (image) return reject('当前选择不是图片组件。替换页面背景请将范围切换为当前页面。');
    return success(patchNodes(work,[selected.id],node=>({...node,background:color!})), '已调整选中组件的背景颜色。');
  }
  const next = {...work, pages: work.pages.map(page => target.scope === 'work' || page.id === target.pageId
    ? {...page, background: color || page.background, backgroundImage: image?.src,backgroundAssetId:image?.id}
    : page)};
  return success(next, `${image ? '已应用上传的背景图片' : '已调整背景颜色'}，页面组件与交互均已保留。`);
}

function fontRevision(work: Work, prompt: string, target: EditTarget): SceneRevision | undefined {
  if (!/字号|字体|文字|文本/.test(prompt) || !/放大|缩小|增大|减小|变大|变小|字号.*\d/.test(prompt)) return;
  const selected = nodesIn(work,target).filter(({node})=>!node.locked && (target.scope==='node' ? ['text','button'].includes(node.type) : node.type==='text'));
  if (!selected.length) return reject('当前范围没有可调整字号的文字，请先选择文字组件。');
  const explicit = prompt.match(/字号[^\d]{0,12}(\d{1,3})(?!\d)/)?.[1];
  const size = explicit ? Number(explicit) : undefined;
  if (size !== undefined && (size < 8 || size > 240)) return reject('字号请使用 8–240 之间的数值。');
  const smaller = /缩小|减小|变小/.test(prompt);
  return success(patchNodes(work,selected.map(({node})=>node.id),node=>({...node,fontSize:size ?? Math.max(8,Math.min(240,Math.round(node.fontSize*(smaller?.85:1.15))))})), `已${size ? `将字号设为 ${size}` : smaller ? '缩小文字' : '放大文字'}，保留内容与位置。`);
}

function timelineRevision(work: Work, prompt: string, target: EditTarget): SceneRevision | undefined {
  if (!/增加|新增|添加|追加/.test(prompt) || !/节点|事件|年份|时间轴/.test(prompt)) return;
  const year = prompt.match(/\b((?:18|19|20|21)\d{2})\s*年?/)?.[1];
  if (!year) return reject('请提供节点年份和名称，例如“增加一个 2025 年节点：全球布局”。');
  const timeline = nodesIn(work,target).find(({node})=>node.type==='timeline'&&!node.locked);
  if (!timeline) return reject('当前范围没有可编辑的时间轴，请选择时间轴组件后再追加节点。');
  const title = clean(prompt.split(/[:：]/).slice(1).join('：')) || `${year} 年新事件`;
  if (title.length > 120) return reject('节点名称请控制在 120 字以内。');
  const item = {id:uid('item'),year,title,description:'请在内容面板补充事件说明。',category:'发展历程'};
  return success(patchNodes(work,[timeline.node.id],node=>({...node,items:[...(node.items||[]),item].sort((a,b)=>(Number(a.year)||0)-(Number(b.year)||0))})), `已在「${timeline.node.name}」中增加 ${year} 年节点「${title}」，原有节点均已保留。`);
}

function mediaRevision(work: Work, prompt: string, target: EditTarget, attachments: Asset[]): SceneRevision | undefined {
  if (!/替换|更换|换成|改用/.test(prompt) || !/图片|照片/.test(prompt)) return;
  if (target.scope !== 'node') return reject('请先选中要替换的图片组件，再上传图片。');
  const selected = nodesIn(work,target)[0].node;
  const image = attachments.find(asset=>asset.kind==='image');
  if (selected.type !== 'image') return reject('当前选择不是图片组件，请先选中目标图片。');
  if (!image) return reject('请先上传要替换的图片，再发送修改需求。');
  return success(patchNodes(work,[selected.id],node=>({...node,src:image.src,assetId:image.id})), '已替换选中图片，布局、尺寸与交互保持不变。');
}

export function reviseScene(work: Work, rawPrompt: string, target: EditTarget = {scope:'work'}, attachments: Asset[] = []): SceneRevision {
  const prompt = rawPrompt.trim();
  if (!prompt || prompt.length > 2000) return reject('请输入 1–2000 字的具体修改要求。');
  if (work.deletedAt) return reject('作品已在回收站，请恢复后再继续编辑。');
  if (target.scope !== 'work' && !work.pages.some(page=>page.id===target.pageId)) return reject('目标页面已不存在，请重新选择修改范围。');
  if (target.scope === 'node') {
    const node = nodesIn(work,target)[0]?.node;
    if (!node) return reject('目标组件已不存在，请重新选择。');
    if (node.locked) return reject('选中组件已锁定，请先解锁后再修改。');
  }
  if (isLocalRelayoutRequest(prompt)) return relayoutWork(work,target);
  if (hasMultipleOperations(prompt)) return reject('本次包含多个修改要求，请分次发送，每次调整一项；当前内容尚未修改。');
  return titleRevision(work,prompt,target) || timelineRevision(work,prompt,target) || backgroundRevision(work,prompt,target,attachments) || fontRevision(work,prompt,target) || mediaRevision(work,prompt,target,attachments) || reject(instructions);
}
