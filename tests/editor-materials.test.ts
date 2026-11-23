import {describe, expect, it} from 'vitest';
import type {Asset, Work} from '../src/domain/types';
import {createSceneWork} from '../src/domain/scenes';
import {createHistory, pushHistory, undoHistory} from '../src/features/editor/editor-domain';
import {insertMaterial, replaceNodeMaterial, replacePageBackground, replaceItemImage, materialNodeKind} from '../src/features/editor/editor-materials';

const image:Asset={id:'photo',workspaceId:'personal',name:'工厂实拍',kind:'image',src:'/media/industrial.svg',preview:'/media/industrial.svg',description:'',tags:[],author:'纪鸣',createdAt:'2026-11-06',source:'uploaded'};
const scene=():Work=>({...createSceneWork({title:'替换测试',type:'时间演进型',width:1920,height:1080,styleId:'industrial'}),workspaceId:'personal'});

describe('editor material insertion and replacement',()=>{
 it('inserts a separate instance and preserves original work',()=>{
  const work=scene(),pageId=work.pages[0].id;
  const next=insertMaterial(work,pageId,image,{x:200,y:120});
  expect(next.pages[0].nodes).toHaveLength(work.pages[0].nodes.length+1);
  expect(next.pages[0].nodes.at(-1)).toMatchObject({type:'image',src:image.src,assetId:image.id,x:200,y:120});
  expect(work.pages[0].nodes.some(n=>n.assetId===image.id)).toBe(false);
 });
 it('replaces only resource fields and keeps geometry, events, and undo history',()=>{
  const work=scene(),first=insertMaterial(work,work.pages[0].id,image);
  const node=first.pages[0].nodes.at(-1)!;
  const prior={...first,pages:[{...first.pages[0],nodes:first.pages[0].nodes.map(n=>n.id===node.id?{...n,rotation:30,interactions:[{id:'click',event:'click' as const,action:'detail' as const}]}:n)}]};
  const next=replaceNodeMaterial(prior,prior.pages[0].id,node.id,{...image,id:'other',src:'/media/technology.svg'});
  const changed=next.pages[0].nodes.at(-1)!;
  expect(changed).toEqual({...prior.pages[0].nodes.at(-1)!,src:'/media/technology.svg',assetId:'other'});
  expect(undoHistory(pushHistory(createHistory(prior),next)).present).toEqual(prior);
 });
 it('rejects locked nodes, mismatched media, private other-space media and unsupported components',()=>{
  const work=scene(),first=insertMaterial(work,work.pages[0].id,image),node=first.pages[0].nodes.at(-1)!;
  const locked={...first,pages:[{...first.pages[0],nodes:first.pages[0].nodes.map(n=>n.id===node.id?{...n,locked:true}:n)}]};
  expect(replaceNodeMaterial(locked,locked.pages[0].id,node.id,image)).toBe(locked);
  expect(replaceNodeMaterial(first,first.pages[0].id,node.id,{...image,kind:'video'})).toBe(first);
  expect(insertMaterial(work,work.pages[0].id,{...image,workspaceId:'xintai'})).toBe(work);
  expect(materialNodeKind({...image,kind:'component',componentType:undefined})).toBeUndefined();
  expect(insertMaterial(work,work.pages[0].id,{...image,kind:'component',componentType:undefined})).toBe(work);
 });
 it('never inserts an engineering work as a video file and treats HTML as an embed',()=>{
  const work=scene();
  expect(insertMaterial(work,work.pages[0].id,{...image,kind:'video',sourceWorkId:'video-work'})).toBe(work);
  expect(materialNodeKind({...image,kind:'html'})).toBe('html');
  expect(materialNodeKind({...image,kind:'component',componentType:'bubble'})).toBe('bubble');
 });
 it('updates one page background and one content image without damaging other content',()=>{
  const work=scene(),page=work.pages[0];
  const next=replacePageBackground(work,page.id,image);
  expect(next.pages[0]).toEqual({...page,backgroundImage:image.src,backgroundAssetId:image.id});
  const node=page.nodes.find(n=>n.items?.length)!;
  const item=node.items![0];
  const replaced=replaceItemImage(work,page.id,node.id,item.id,image);
  expect(replaced.pages[0].nodes.find(n=>n.id===node.id)?.items?.[0]).toEqual({...item,image:image.src,assetId:image.id});
  expect(replaced.pages[0].nodes.filter(n=>n.id!==node.id)).toEqual(page.nodes.filter(n=>n.id!==node.id));
 });
 it('ignores deleted, public-unadopted or unknown targets and clamps insert positions',()=>{
  const work=scene();
  expect(insertMaterial(work,work.pages[0].id,{...image,public:true})).toBe(work);
  expect(replacePageBackground(work,'missing',image)).toBe(work);
  expect(replacePageBackground(work,work.pages[0].id,{...image,kind:'audio'})).toBe(work);
  expect(insertMaterial(work,work.pages[0].id,{...image,deletedAt:'2026-11-06'})).toBe(work);
  const next=insertMaterial(work,work.pages[0].id,image,{x:9999,y:-50});
  expect(next.pages[0].nodes.at(-1)!.x).toBeLessThan(work.width);
  expect(next.pages[0].nodes.at(-1)!.y).toBe(0);
 });
 it('reads only native component text and safe item fields from matching schema',()=>{
  const work=scene(),schema={type:'timeline',content:'真实生成内容',x:99999,w:99999,script:'alert(1)',items:[{id:'foreign',title:'1998年',description:'企业创立',year:'1998',x:9999,image:'javascript:alert(1)',value:5}]};
  const asset:Asset={...image,kind:'component',componentType:'timeline',package:{id:'pack',version:'1',prompt:'',skillIds:[],params:{},complete:true,files:[{name:'component.schema.json',type:'component',content:JSON.stringify(schema)}]}};
  const node=insertMaterial(work,work.pages[0].id,asset).pages[0].nodes.at(-1)!;
  expect(node.content).toBe('真实生成内容');expect(node.x).not.toBe(99999);expect(node.w).not.toBe(99999);
  expect(node.items?.[0]).toMatchObject({title:'1998年',description:'企业创立',year:'1998'});
  expect(node.items?.[0].id).not.toBe('foreign');expect(node.items?.[0].image).toBeUndefined();expect(node.items?.[0].x).toBeUndefined();
  for(const content of ['{bad',JSON.stringify({...schema,type:'html'}),JSON.stringify(null)]){
   const bad={...asset,package:{...asset.package!,files:[{name:'component.schema.json',type:'component',content}]}};
   expect(insertMaterial(work,work.pages[0].id,bad).pages[0].nodes.at(-1)?.content).not.toBe('真实生成内容');
  }
 });

});
