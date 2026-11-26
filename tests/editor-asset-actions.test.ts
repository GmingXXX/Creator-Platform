import {expect,it} from 'vitest';
import {editorAssetSample,insertStoryAsset} from '../src/features/editor/editor-asset-actions';
import type {Work} from '../src/domain/types';
const project={workspaceId:'space-a',storyNodes:[{id:'photo',type:'photo',x:600,y:500,title:'留影',text:''}]} as Work;
it('keeps a standalone sample in its originating space, until the author selects a node',()=>{
 const asset=editorAssetSample(project,'component','留影按钮');
 expect(asset.workspaceId).toBe('space-a');expect(asset.name).toContain('演示样稿');expect(asset.kind).toBe('html');
 expect(insertStoryAsset(project,'gone',asset)).toBe(project);
 const inserted=insertStoryAsset(project,'photo',asset);
 expect(inserted.storyNodes?.[0].layers?.[0]).toMatchObject({assetId:asset.id,kind:'html'});expect(project.storyNodes?.[0].layers).toBeUndefined();
 expect(insertStoryAsset(project,'photo',{...asset,workspaceId:'space-b'})).toBe(project);
 expect(()=>editorAssetSample(project,'video',' ')).toThrow();
});
import {assetRequestKind} from '../src/features/editor/editor-asset-intent';
it('distinguishes standalone asset requests from revisions and direct replacement',()=>{
 expect(assetRequestKind('请生成一张数学家肖像图片')).toBe('image');expect(assetRequestKind('帮我制作一个数字人组件')).toBe('component');
 expect(assetRequestKind('请生成一段宣传视频')).toBe('video');expect(assetRequestKind('把首页的图片替换成最新图片')).toBeUndefined();
 expect(assetRequestKind('给当前页面添加一个标题')).toBeUndefined();
});
import {applyEditorBackground,editorBackgroundContext} from '../src/features/editor/editor-background';
import {createInitialData} from '../src/domain/fixtures';
it('captures the requested page and applies its background without adding or changing layers',()=>{
 const work=createInitialData().works[0],page=work.pages[0],other={...page,id:'second',name:'获奖历程'};
 const two={...work,pages:[page,other]},context=editorBackgroundContext(two,'second');
 expect(assetRequestKind('生成一张背景素材')).toBe('image');
 expect(context?.work.pages.find(p=>p.id===context.targetId)?.name).toBe('获奖历程');
 const asset=editorAssetSample(work,'image','背景');
 const next=applyEditorBackground(two,context!.targetId,asset);
 expect(next.pages[0]).toBe(page);expect(next.pages[1]).toMatchObject({backgroundAssetId:asset.id,nodes:other.nodes});
 expect(applyEditorBackground(work,'second',asset)).toBe(work);
 expect(editorBackgroundContext(work,'removed')).toBeUndefined();
});
it('uses the selected story node and preserves its controls and branches on adoption',()=>{
 const work={...project,kind:'story' as const,pages:[],storyEdges:[]};
 const context=editorBackgroundContext(work,'photo');
 expect(context?.work.pages[0].name).toBe('留影');
 const asset=editorAssetSample(work,'image','背景'),updated=applyEditorBackground(work,'photo',asset);
 expect(updated.storyNodes?.[0]).toMatchObject({...work.storyNodes![0],media:asset.src,mediaAssetId:asset.id});
 expect(updated.storyEdges).toBe(work.storyEdges);
});
it('recognizes refinements only when the editor has a background candidate for that page',()=>{
 expect(assetRequestKind('再暗一点')).toBeUndefined();expect(assetRequestKind('再暗一点',true)).toBe('image');
});
