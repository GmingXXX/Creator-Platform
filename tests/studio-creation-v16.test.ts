import {describe,it,expect} from 'vitest';
import {parseStoryDraft,parseOutlineDraft,resolveCreationSize,createBlankStory,storyMediaKind,sourcePackage,creationMessages} from '../src/features/studios/creationLogic';
describe('studio creation V1.6',()=>{
 it('allows a genuinely empty story with no required script',()=>expect(createBlankStory()).toEqual({nodes:[],edges:[]}));
 it('validates custom resolution and respects ultrawide values',()=>{expect(resolveCreationSize('2520×1080',1,1)).toEqual({width:2520,height:1080});expect(()=>resolveCreationSize('custom',100,1080)).toThrow();});
 it('rejects model edges targeting nonexistent nodes',()=>expect(()=>parseStoryDraft(JSON.stringify({nodes:[{id:'a',type:'start',title:'开始',text:''}],edges:[{source:'a',target:'missing',label:'继续'}]}))).toThrow());
 it('normalizes safe model nodes and unique edge ids without accepting media URLs',()=>{const draft=parseStoryDraft(JSON.stringify({nodes:[{id:'a',type:'start',title:'开场',text:'进入',media:'javascript:bad'},{id:'b',type:'end',title:'结束',text:'完成'}],edges:[{source:'a',target:'b',label:'继续'}]}));expect(draft.nodes[0].media).toBeUndefined();expect(draft.nodes[1].x).toBeGreaterThan(0);expect(draft.edges).toHaveLength(1);});
 it('rejects duplicate model node ids',()=>expect(()=>parseStoryDraft(JSON.stringify({nodes:[{id:'a',type:'start',title:'开始'},{id:'a',type:'end',title:'结束'}],edges:[]}))).toThrow());
 it('reads titles and narration with bounded model output',()=>{expect(parseOutlineDraft('{"sections":[{"title":"企业概况","narration":"内容介绍"}]}')[0]).toEqual({title:'企业概况',narration:'内容介绍'});expect(()=>parseOutlineDraft('{"sections":[]}')).toThrow();});
 it('detects HTML only by asset metadata or supported local extension',()=>{expect(storyMediaKind({media:'/demo.html'})).toBe('html');expect(storyMediaKind({media:'idb:x'},[{id:'x',kind:'html',src:'idb:x'}] as never)).toBe('html');expect(storyMediaKind({media:'/demo.mp4'})).toBe('video');});
 it('handles fenced JSON and rejects invalid payloads before creating nodes',()=>{
  expect(parseOutlineDraft('```json\n{"sections":[{"title":"概要"}]}\n```')[0].narration).toBe('');
  for(const payload of ['null','[]','{"nodes":[],"edges":[]}','{"nodes":[null],"edges":[]}','{"nodes":[{"id":"x","type":"script","title":"X"}],"edges":[]}'])expect(()=>parseStoryDraft(payload)).toThrow();
  expect(()=>parseStoryDraft('{"nodes":[{"id":"x","type":"start","title":"X"}],"edges":[null]}')).toThrow();
  for(const payload of ['{"sections":[null]}','{"sections":[{"title":""}]}'])expect(()=>parseOutlineDraft(payload)).toThrow();
 });
 it('keeps package asset references and does not mutate the source asset',()=>{
  const a={id:'asset-1',name:'脚本.txt',kind:'document',src:'idb:asset-1'} as never;
  const pack=sourcePackage('需求',[a],{experience:'开始→结束'});expect(pack.files).toEqual([{name:'脚本.txt',type:'document',src:'idb:asset-1'}]);expect(JSON.parse(pack.params.referenceAssetIds)).toEqual(['asset-1']);expect(pack.params.experience).toBe('开始→结束');
 });
 it('handles empty/image sources and boundary resolutions',()=>{
  expect(storyMediaKind({})).toBe('image');expect(storyMediaKind({media:'/photo.png'})).toBe('image');expect(resolveCreationSize('custom',320,16384)).toEqual({width:320,height:16384});expect(()=>resolveCreationSize('custom',1920.5,1080)).toThrow();
 });

 it('splits long script references within the server message limit',()=>{const messages=creationMessages('返回JSON',{topic:'企业介绍'},'长篇策划脚本'.repeat(4000));expect(messages.every(m=>m.content.length<=12000)).toBe(true);expect(messages.filter(m=>m.role==='user').length).toBeGreaterThan(2);expect(messages.at(-1)?.content).toContain('长篇');});

});
