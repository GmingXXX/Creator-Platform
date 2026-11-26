import {beforeEach,expect,it} from 'vitest';
import {useStudio} from '../src/domain/store';
import {createInitialData} from '../src/domain/fixtures';
import type {Asset,Run} from '../src/domain/types';
import {findRecoverableExhibit,returnToExhibit} from '../src/domain/session-artifact-recovery';

beforeEach(()=>{
 const seed=createInitialData(),work=seed.works[0];
 const run:Run={id:'source',workId:work.id,workspaceId:'personal',prompt:'制作时间轴',model:'demo',styleId:'',skillIds:[],attachmentIds:[],status:'complete',step:5,outputKind:'exhibit',createdAt:''};
 const image:Asset={...seed.assets[0],id:'picture',name:'生成的背景',kind:'image',workspaceId:'personal',src:'/example.png',source:'generated',public:false,sourceWorkId:undefined,workSnapshot:undefined};
 const output:Run={...run,id:'image',workId:undefined,outputKind:'image',assetId:image.id};
 useStudio.setState({...seed,activeWorkspaceId:'personal',works:[{...work,kind:'exhibit',workspaceId:'personal'}],assets:[image],runs:[run,output],creationSessions:[{id:'session',workspaceId:'personal',draft:seed.drafts[0],messages:[],runId:output.id,priorRunIds:['deleted','source']}]});
});
it('restores the exhibit inside the existing session, retaining the image and navigable history',()=>{
 const state=useStudio.getState(),original=state.works[0];
 const match=findRecoverableExhibit(state,'session')!;
 returnToExhibit('session',match.source.id,match.image.id);
 const after=useStudio.getState();
 expect(after.creationSessions?.[0]).toMatchObject({id:'session',runId:'source',priorRunIds:['deleted','image']});
 expect(after.works[0]).toEqual(original);expect(after.assets).toContainEqual(match.image);expect(after.runs).toHaveLength(2);
});
it('only changes a background after adoption and keeps all original nodes',()=>{
 const state=useStudio.getState(),match=findRecoverableExhibit(state,'session')!;
 expect(state.works[0].pages[0].backgroundImage).not.toBe(match.image.src);
 returnToExhibit('session',match.source.id,match.image.id,state.works[0].pages[0].id);
 expect(useStudio.getState().works[0].pages[0]).toMatchObject({backgroundAssetId:'picture',nodes:state.works[0].pages[0].nodes});
});
it.each(['source space','work space','deleted','stale session','queued','archived','active space'])('rejects unsafe or stale history: %s',kind=>{
 const s=useStudio.getState();
 if(kind==='source space')useStudio.setState({runs:s.runs.map(r=>r.id==='source'?{...r,workspaceId:'xintai'}:r)});
 if(kind==='work space')useStudio.setState({works:s.works.map(w=>({...w,workspaceId:'xintai'}))});
 if(kind==='deleted')useStudio.setState({works:s.works.map(w=>({...w,deletedAt:new Date().toISOString()}))});
 if(kind==='archived')useStudio.setState({works:s.works.map(w=>({...w,archived:true}))});
 if(kind==='stale session')useStudio.setState({creationSessions:s.creationSessions?.map(c=>({...c,priorRunIds:[]}))});
 if(kind==='queued')useStudio.setState({creationSessions:s.creationSessions?.map(c=>({...c,queued:[{id:'pending',role:'user',text:'生成'}]}))});
 if(kind==='active space')useStudio.setState({activeWorkspaceId:'xintai'});
 expect(findRecoverableExhibit(useStudio.getState(),'session')).toBeUndefined();
 expect(()=>returnToExhibit('session','source','picture')).toThrow();
});

it('rejects adoption after the visible page or image has changed',()=>{
 const state=useStudio.getState(),original=state.works[0];
 expect(()=>returnToExhibit('session','source','picture','removed-page')).toThrow();
 expect(()=>returnToExhibit('session','source','outdated-image')).toThrow();
 expect(useStudio.getState().works[0]).toEqual(original);
 expect(useStudio.getState().creationSessions?.[0].runId).toBe('image');
});
it('applies the image to the explicitly selected page among multiple pages',()=>{
 const original=useStudio.getState().works[0];
 useStudio.setState({works:[{...original,pages:[original.pages[0],{...original.pages[0],id:'another-page'}]}]});
 returnToExhibit('session','source','picture','another-page');
 const [first,second]=useStudio.getState().works[0].pages;
 expect(first).toEqual(original.pages[0]);
 expect(second.backgroundAssetId).toBe('picture');
});
