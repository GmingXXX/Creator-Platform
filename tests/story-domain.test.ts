import { describe, expect, it } from 'vitest';
import { defaultStory, validateStory, nextStoryNode, reorder, makePresentationPages, parseBranch, formatBranch, isBranchAvailable } from '../src/features/studios/studioLogic';

describe('story graph', () => {
  it('validates the default branching story and resolves different endings', () => {
    const {nodes,edges}=defaultStory();
    expect(validateStory(nodes,edges)).toEqual([]);
    expect(nextStoryNode(nodes,edges,'choice','edge-green')?.id).toBe('green');
    expect(nextStoryNode(nodes,edges,'choice','edge-smart')?.id).toBe('smart');
    expect(nodes.filter(n=>n.type==='end')).toHaveLength(2);
  });
  it('rejects missing start, broken targets and inaccessible endings', () => {
    const {nodes,edges}=defaultStory();
    expect(validateStory(nodes.filter(n=>n.type!=='start'),edges).some(e=>e.includes('开始'))).toBe(true);
    expect(validateStory(nodes,[...edges,{id:'broken',source:'intro',target:'missing',label:''}]).some(e=>e.includes('失效'))).toBe(true);
    expect(validateStory(nodes,edges.filter(e=>e.source!=='intro')).some(e=>e.includes('未连接'))).toBe(true);
  });
  it('rejects cycles and a branch with only one outgoing choice', () => {
    const {nodes,edges}=defaultStory();
    expect(validateStory(nodes,[...edges,{id:'cycle',source:'green',target:'intro',label:''}]).some(e=>e.includes('循环'))).toBe(true);
    expect(validateStory(nodes,edges.filter(e=>e.id!=='edge-smart')).some(e=>e.includes('至少两个'))).toBe(true);
  });
  it('never follows an unrelated or missing edge', () => {
    const {nodes,edges}=defaultStory();
    expect(nextStoryNode(nodes,edges,'intro','edge-green')).toBeUndefined();
    expect(nextStoryNode(nodes,edges,'green')).toBeUndefined();
  });
});

describe('studio authoring', () => {
  it('reorders immutably and guards out-of-range moves', () => {
    const original=['a','b','c'];
    expect(reorder(original,0,1)).toEqual(['b','a','c']);
    expect(original).toEqual(['a','b','c']);
    expect(reorder(original,0,-1)).toEqual(original);
    expect(reorder(original,4,1)).toEqual(original);
  });
  it('produces editable slides with unique stable references and narration', () => {
    const pages=makePresentationPages('企业创新之旅','technology');
    expect(pages).toHaveLength(8);
    expect(new Set(pages.map(p=>p.id)).size).toBe(8);
    expect(new Set(pages.flatMap(p=>p.nodes.map(n=>n.id))).size).toBe(pages.flatMap(p=>p.nodes).length);
    expect(pages.every(p=>p.nodes.some(n=>n.type==='text') && p.notes)).toBe(true);
    expect(pages[0].nodes[0].content).toContain('企业创新之旅');
  });
});

describe('story validation boundaries',()=>{
 it('requires an ending and rejects duplicate starts',()=>{
  const {nodes,edges}=defaultStory();
  expect(validateStory(nodes.filter(n=>n.type!=='end'),edges)).toContain('请添加至少一个结局节点');
  expect(validateStory([...nodes,{...nodes[0],id:'second-start'}],edges)).toContain('故事需要且只能有一个开始节点');
 });
 it('handles absent nodes, ending nodes and the default continuation',()=>{
  const {nodes,edges}=defaultStory();
  expect(nextStoryNode(nodes,edges,'start')?.id).toBe('intro');
  expect(nextStoryNode(nodes,edges,'missing')).toBeUndefined();
  expect(nextStoryNode(nodes,edges,'smart')).toBeUndefined();
 });
 it('preserves a user-edited outline, including inserted and removed chapters',()=>{
  const titles=['新开场','新章节','总结'];
  const pages=makePresentationPages('主题','unknown',titles);
  expect(pages.map(p=>p.name)).toEqual(titles);
  expect(pages.map(p=>p.nodes[0].content)).toEqual(titles);
  expect(reorder(titles,2,1)).toEqual(titles);
  expect(reorder(titles,-1,1)).toEqual(titles);
 });
});

describe('conditional story choices',()=>{
 it('round-trips display labels and evaluates a selected exploration preference',()=>{
  const encoded=formatBranch('进入绿色工厂','green');
  expect(parseBranch(encoded)).toEqual({label:'进入绿色工厂',condition:'green'});
  expect(isBranchAvailable(encoded,'green')).toBe(true);
  expect(isBranchAvailable(encoded,'technology')).toBe(false);
  expect(formatBranch('继续','any')).toBe('继续');
  expect(isBranchAvailable('继续','technology')).toBe(true);
 });
});

it('selects readable foreground colors for light and dark presentation styles',()=>{
 const light=makePresentationPages('政务讲解','government');
 const dark=makePresentationPages('科技讲解','technology');
 expect(light[0].nodes[0].color).toBe('#30343b');
 expect(dark[0].nodes[0].color).toBe('#ffffff');
 expect(light[1].nodes.find(n=>n.type==='card')?.background).toContain('255,255,255');
});
