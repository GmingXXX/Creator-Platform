import {beforeEach,it,expect,vi} from 'vitest';
import {createInitialData} from '../src/domain/fixtures';
import {useStudio} from '../src/domain/store';
import {advanceBackground,applyBackground,beginWorkBackground} from '../src/domain/background-generation';
const api=vi.hoisted(()=>({aiRequest:vi.fn()}));vi.mock('../src/domain/ai-client',async original=>({...await original<object>(),...api}));
function arrange(){
 const seed=createInitialData(),original=seed.works[0],base=original.pages[0],page={...base,id:'target',name:'试验线成长史',background:'#334455',nodes:[{...base.nodes[0],type:'timeline' as const,name:'鱼骨发展历程',items:[{id:'v',title:'技术中心启用'}]}]};
 const work={...original,workspaceId:'personal',title:'更名后的荣誉时间轴',width:1440,height:900,pages:[base,page]};
 useStudio.setState({...seed,works:[work],runs:[{id:'r',model:'deepseek-flash',prompt:'旧主题',styleId:'',skillIds:[],attachmentIds:[],status:'complete',step:5,outputKind:'exhibit',workId:work.id,createdAt:''}]});return work;
}
beforeEach(()=>api.aiRequest.mockReset());
it('uses current work, confirmed layout and selected page at submit and adoption',async()=>{
 const work=arrange();beginWorkBackground('r','背景温暖一些','target');
 api.aiRequest.mockResolvedValue({status:'succeeded',id:'t1',url:'/api/ai/media/t1.png'});await advanceBackground('r');
 const body=api.aiRequest.mock.calls[0][1];expect(body.size).toBe('1440*900');
 for(const expected of [work.title,'试验线成长史','时间轴','技术中心启用','#334455','背景温暖一些'])expect(body.prompt).toContain(expected);
 const draft=useStudio.getState().runs[0].backgroundDraft!;
 expect(draft.targetPageId).toBe('target');expect(draft.targetWorkId).toBe(work.id);
 expect(useStudio.getState().works[0]).toEqual(work);
 applyBackground('r',draft.assetId!);
 expect(useStudio.getState().works[0].pages[0]).toEqual(work.pages[0]);expect(useStudio.getState().works[0].pages[1].backgroundAssetId).toBe(draft.assetId);
});
it('does not bill in demo, binds the local candidate to its original page, and refuses a removed target',()=>{
 const work=arrange();beginWorkBackground('r','生成一张背景素材','target',[],'demo');const s=useStudio.getState(),d=s.runs[0].backgroundDraft!;
 expect(d.status).toBe('ready');expect(api.aiRequest).not.toHaveBeenCalled();expect(s.assets.find(a=>a.id===d.assetId)?.src).toMatch(/^data:image\/svg/);
 useStudio.setState({works:[{...work,pages:work.pages.slice(0,1)}]});expect(()=>applyBackground('r',d.assetId!)).toThrow('页面');
});
it('rejects inaccessible attachments before starting any generation',()=>{
 arrange();expect(()=>beginWorkBackground('r','制作背景','target',['missing'])).toThrow('参考');expect(useStudio.getState().runs[0].backgroundDraft).toBeUndefined();
});
it('keeps recent visual instructions for the same page only and renders the requested adjustment in demo',()=>{
 const work=arrange();
 beginWorkBackground('r','做成暖色背景，给左侧留白','target',[],'demo');
 const previous=useStudio.getState().runs[0].backgroundDraft!;
 const img1=useStudio.getState().assets.find(a=>a.id===previous.assetId)!.src;
 beginWorkBackground('r','再暗一点','target',[],'demo');
 const next=useStudio.getState().runs[0].backgroundDraft!;
 expect(next.generationPrompt).toContain('给左侧留白');expect(next.generationPrompt).toContain('再暗一点');
 expect(useStudio.getState().assets.find(a=>a.id===next.assetId)!.src).not.toBe(img1);
 expect(next.generationPrompt!.match(/华院展项制作约定/g)).toHaveLength(1);
 beginWorkBackground('r','用水墨背景',work.pages[0].id,[],'demo');
 expect(useStudio.getState().runs[0].backgroundDraft!.generationPrompt).not.toContain('给左侧留白');
});
it('records the original request and drops a late result if its work moved to another space',async()=>{
 const work=arrange();beginWorkBackground('r','留白','target',[],'demo');
 const s=useStudio.getState(),asset=s.assets.find(a=>a.id===s.runs[0].backgroundDraft!.assetId)!;
 expect(asset.package?.params.userPrompt).toBe('留白');
 expect(asset.package?.params.targetWorkId).toBe(work.id);
 beginWorkBackground('r','另一张','target');let done!:(value:unknown)=>void;
 api.aiRequest.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
 const waiting=advanceBackground('r');
 useStudio.setState({works:[{...work,workspaceId:'dongguan'}]});
 done({id:'late',status:'succeeded',url:'/api/ai/media/late.png'});await waiting;
 expect(useStudio.getState().assets).toHaveLength(s.assets.length);
});
it('resolves the original offline sample for previews and declines changed SVG or other data payloads',async()=>{
 const {resolveMedia}=await import('../src/domain/upload');
 arrange();beginWorkBackground('r','生成背景','target',[],'demo');
 const s=useStudio.getState(),sample=s.assets.find(a=>a.id===s.runs[0].backgroundDraft!.assetId)!.src;
 await expect(resolveMedia(sample)).resolves.toBe(sample);
 await expect(resolveMedia(sample.replace('%3Crect','%3CforeignObject'))).rejects.toThrow();
 await expect(resolveMedia('data:text/plain,test')).rejects.toThrow();
});
it.each([true,false])('includes the applied background description only when allowed (%s)',allowed=>{
 const work=arrange(),s=useStudio.getState();
 const source={...s.assets[0],id:'current-bg',name:'原来的靛蓝背景',description:'边角用铜色线条勾勒',metadata:{business:{note:'',subject:'',usage:'reusable' as const,confirmed:true,allowAi:allowed}}};
 useStudio.setState({assets:[...s.assets,source],works:[{...work,pages:work.pages.map(p=>p.id==='target'?{...p,backgroundAssetId:source.id}:p)}]});
 beginWorkBackground('r','做成第二稿','target',[],'demo');
 const prompt=useStudio.getState().runs[0].backgroundDraft!.generationPrompt||'';
 expect(prompt.includes('原来的靛蓝背景')).toBe(allowed);expect(prompt.includes('边角用铜色线条勾勒')).toBe(allowed);
});
it('uses the scene composition when adapting samples for page notes, hidden nodes, and requested quiet areas',async()=>{
 const {buildWorkBackgroundPrompt,isWorkBackgroundSample,makeWorkBackgroundSample}=await import('../src/domain/work-background');
 const work=arrange(),page=work.pages[1],node=page.nodes[0];
 const scene={...work,pages:[{...page,background:'transparent',notes:'迎宾厅的开场',nodes:[{...node,timelineLayout:'fishbone' as const},{...node,hidden:true,name:'隐藏内容'}]}]};
 const text=buildWorkBackgroundPrompt(scene,page.id,'轻一点');
 expect(text).toContain('迎宾厅的开场');expect(text).toContain('鱼骨时间轴');expect(text).not.toContain('隐藏内容');
 for(const quiet of ['右侧留白','上部留白','下方留白']){
  const sample=makeWorkBackgroundSample(scene,page.id,undefined,'绿色，浅一点，'+quiet);
  expect(isWorkBackgroundSample(sample)).toBe(true);expect(decodeURIComponent(sample)).toContain('#7cad91');
 }
 expect(()=>buildWorkBackgroundPrompt(scene,'missing','背景')).toThrow('页面');
 expect(isWorkBackgroundSample('data:image/svg+xml;charset=utf-8,')).toBe(false);
 expect(isWorkBackgroundSample('data:image/svg+xml;charset=utf-8,%3C!--bg_0_900_85_85_abc_fff_dark--%3E')).toBe(false);
});
it('can adopt a local background into a work with a resource package',async()=>{
 const {assetDependencyError}=await import('../src/domain/resource-permissions');
 arrange();beginWorkBackground('r','请制作背景','target',[],'demo');
 const s=useStudio.getState(),asset=s.assets.find(a=>a.id===s.runs[0].backgroundDraft!.assetId)!;
 expect(assetDependencyError(s.assets,asset,'personal')).toBeUndefined();
 applyBackground('r',asset.id);expect(useStudio.getState().works[0].pages[1].backgroundImage).toBe(asset.src);
});
it('does not apply a previous candidate to a different work after replacing the active exhibit',()=>{
 const work=arrange();beginWorkBackground('r','时间线背景','target',[],'demo');
 const s=useStudio.getState(),run=s.runs[0],assetId=run.backgroundDraft!.assetId!;
 useStudio.setState({runs:[{...run,workId:'new-work'}],works:[{...work,id:'new-work'},work]});
 expect(()=>applyBackground('r',assetId)).toThrow('作品');
 expect(useStudio.getState().works[0].pages[0]).toEqual(work.pages[0]);
});
