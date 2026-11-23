import {describe,it,expect} from 'vitest';
import {createSceneWork,createNode} from '../src/domain/scenes';
import {isLocalRelayoutRequest,relayoutWork} from '../src/domain/agent-relayout';
import type {SceneNode} from '../src/domain/types';
const fixture=()=>{const work=createSceneWork({title:'保留素材',type:'时间演进型',width:1920,height:1080});return {...work,pages:[{...work.pages[0],nodes:[createNode('text',{name:'主标题',content:'企业发展',x:0,y:0,w:800,h:160}),createNode('text',{name:'正文要点',content:'保留的正文',x:0,y:0,w:800,h:160}),createNode('image',{name:'图片',src:'/demo.jpg',assetId:'a',x:0,y:0,w:800,h:160})]}, {...work.pages[0],id:'other',nodes:[createNode('text',{content:'另一页',x:0,y:0})]}]};};
const overlaps=(a:SceneNode,b:SceneNode)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
describe('safe deterministic layout',()=>{
 it.each(['重新排版','请帮我重新排版整个页面','重新排版整份作品','重新布局当前页面','优化页面布局'])('recognizes only a simple layout operation: %s',prompt=>expect(isLocalRelayoutRequest(prompt)).toBe(true));
 it.each(['把标题改为“重新排版”','重新排版并删掉图片','重新排版，文字改为新内容','每个配张图','不要重新排版','重新排版后生成图片'])('does not swallow additional or negated requests: %s',prompt=>expect(isLocalRelayoutRequest(prompt)).toBe(false));
 it('lays out a whole page without overlaps and preserves content/resources/ids and other pages',()=>{
 const work=fixture(),snapshot=structuredClone(work),result=relayoutWork(work,{scope:'page',pageId:work.pages[0].id});expect(result.ok).toBe(true);expect(result.summary).toContain('本地规则');const out=result.work!;
 expect(work).toEqual(snapshot);expect(out.pages[1]).toBe(work.pages[1]);expect(out.pages[0].nodes.map(n=>[n.id,n.content,n.src,n.assetId])).toEqual(work.pages[0].nodes.map(n=>[n.id,n.content,n.src,n.assetId]));
 out.pages[0].nodes.forEach((n,i,all)=>{expect(n.x).toBeGreaterThanOrEqual(0);expect(n.y+n.h).toBeLessThanOrEqual(work.height);expect(n.x+n.w).toBeLessThanOrEqual(work.width);all.slice(i+1).forEach(other=>expect(overlaps(n,other)).toBe(false));});
 });
 it('supports all pages, composites and opaque HTML containers without rewriting internal content',()=>{
 const work=fixture();work.pages[0].nodes=[createNode('timeline',{timelineLayout:'fishbone'}),createNode('html',{src:'idb:html',content:'<script>opaque</script>'})];const result=relayoutWork(work,{scope:'work'});expect(result.ok).toBe(true);expect(result.work!.pages[0].nodes[1].src).toBe('idb:html');expect(result.work!.pages[0].nodes[1].content).toContain('opaque');expect(result.work!.pages[1].nodes[0].x).not.toBe(0);
 });
 it('avoids locked objects and leaves hidden and background shapes unchanged',()=>{
 const work=fixture(),locked=createNode('image',{locked:true,x:0,y:0,w:1920,h:200}),hidden=createNode('text',{hidden:true,x:20,y:20}),shape=createNode('shape',{x:0,y:0,w:1920,h:1080});work.pages[0].nodes=[locked,hidden,shape,...work.pages[0].nodes];const result=relayoutWork(work,{scope:'page',pageId:work.pages[0].id});expect(result.ok).toBe(true);expect(result.work!.pages[0].nodes.slice(0,3)).toEqual([locked,hidden,shape]);result.work!.pages[0].nodes.slice(3).forEach(n=>expect(overlaps(n,locked)).toBe(false));
 });
 it('refuses node scope, missing pages, deleted works, unsupported story and unfit locked pages without changes',()=>{
 const work=fixture();expect(relayoutWork(work,{scope:'node',pageId:work.pages[0].id,nodeId:work.pages[0].nodes[0].id}).ok).toBe(false);expect(relayoutWork(work,{scope:'page',pageId:'missing'}).ok).toBe(false);expect(relayoutWork({...work,deletedAt:'now'},{scope:'work'}).ok).toBe(false);expect(relayoutWork({...work,kind:'story'},{scope:'work'}).ok).toBe(false);
 work.pages[0].nodes=[createNode('image',{locked:true,x:0,y:0,w:1920,h:1080}),...work.pages[0].nodes];expect(relayoutWork(work,{scope:'page',pageId:work.pages[0].id}).ok).toBe(false);
 });
 it('does not create fake revisions when already arranged or empty',()=>{const work=fixture(),first=relayoutWork(work,{scope:'work'});expect(relayoutWork(first.work!,{scope:'work'}).ok).toBe(false);expect(relayoutWork({...work,pages:[]},{scope:'work'}).ok).toBe(false);});
 it('keeps a rotated object fixed and avoids its rotated visual bounds',()=>{
  const work=fixture(),fixed=createNode('image',{rotation:45,x:700,y:100,w:300,h:100}),page={...work.pages[0],nodes:[fixed,...work.pages[0].nodes]};
  const result=relayoutWork({...work,pages:[page]},{scope:'work'});expect(result.ok).toBe(true);expect(result.work!.pages[0].nodes[0]).toBe(fixed);
  const size=(300+100)/Math.sqrt(2),bounds={...fixed,x:850-size/2,y:150-size/2,w:size,h:size};result.work!.pages[0].nodes.slice(1).forEach(node=>expect(overlaps(node,bounds)).toBe(false));
 });
 it('gives the exhibit timeline full width beneath its semantic heading and introduction',()=>{
  const work=createSceneWork({title:'企业鱼骨时间轴',type:'时间演进型',width:1920,height:1080}),result=relayoutWork(work,{scope:'work'}),nodes=result.work!.pages[0].nodes;
  expect(result.ok).toBe(true);expect(nodes.find(node=>node.type==='timeline')!.w).toBeGreaterThan(1700);
  nodes.filter(node=>node.type==='text').forEach(node=>expect(node.h).toBeGreaterThanOrEqual(node.fontSize*(node.lineHeight||1.5)));
 });
 it('preserves narration while rearranging every presentation page',()=>{
  const work=createSceneWork({title:'智能演示',type:'卡片浏览型',kind:'presentation',width:1920,height:1080}),result=relayoutWork(work,{scope:'work'});
  expect(result.ok).toBe(true);expect(result.work!.pages.map(page=>page.notes)).toEqual(work.pages.map(page=>page.notes));expect(result.work!.pages.every((page,index)=>page!==work.pages[index])).toBe(true);
 });
 it('rejects insufficient dimensions or oversized text without clipping or partial changes',()=>{
  const work=fixture();expect(relayoutWork({...work,width:200},{scope:'work'}).ok).toBe(false);
  const crowded={...work,pages:[{...work.pages[0],nodes:work.pages[0].nodes.map(node=>node.type==='text'?{...node,content:'很多内容'.repeat(1000)}:node)}]};expect(relayoutWork(crowded,{scope:'work'}).ok).toBe(false);
 });
});
