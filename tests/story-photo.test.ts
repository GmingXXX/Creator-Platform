import {describe,expect,it} from 'vitest';
import {readPhotoSettings,frameGeometry,photoSampleResults,collectStoryPhotoTemplates,mapPhotoTemplates} from '../src/domain/story-photo';

describe('拍照节点配置',()=>{
 it('旧项目沿用即时拍摄和重拍',()=>{
  expect(readPhotoSettings()).toMatchObject({seconds:0,allowRetake:true,shape:'rounded'});
 });
 it('读回不支持的枚举时使用默认形状，范围保持在取景面内',()=>{
  const raw={shape:'triangle',seconds:-12,size:991,x:-2,y:NaN,hint:123} as never;
  expect(readPhotoSettings(raw)).toMatchObject({shape:'rounded',seconds:0,size:80,x:0,y:32,hint:'请面向取景框'});
 });
 it('把取景框的边缘对齐到可视画布边缘并避免圆形变椭圆',()=>{
  expect(frameGeometry(readPhotoSettings({shape:'circle',x:100,y:0,outline:'dashed'}))).toMatchObject({
   left:'100%',top:'0%',transform:'translate(-100%, 0%)',aspectRatio:'1',borderStyle:'dashed',borderRadius:'50%',
  });
 });
 it('保留空提示和禁用重拍的作者配置',()=>{
  expect(readPhotoSettings({hint:'',seconds:3,allowRetake:false})).toMatchObject({hint:'',seconds:3,allowRetake:false});
 });
});


it('将拍摄样片与各类模板样片分别传给对应结果位置',()=>{
 const imageTemplate={assetId:'a',src:'/a.jpg',name:'图片'};
 const videoTemplate={assetId:'v',src:'/v.mp4',name:'视频'};
 expect(photoSampleResults({imageTemplate,videoTemplate},'/photo.jpg')).toEqual({photo:'/photo.jpg',faceImage:'/a.jpg',faceVideo:'/v.mp4'});
 expect(photoSampleResults({},'/photo.jpg')).toEqual({photo:'/photo.jpg'});
 const photo={imageTemplate,videoTemplate};
 expect(collectStoryPhotoTemplates({storyNodes:[{photo},{}]})).toEqual([imageTemplate,videoTemplate]);
 expect(mapPhotoTemplates(photo,(t,kind)=>({...t,src:kind}))).toEqual({
  imageTemplate:{...imageTemplate,src:'image'},videoTemplate:{...videoTemplate,src:'video'},
 });
 expect(readPhotoSettings({imageTemplate:{src:'',name:'',assetId:''}}).imageTemplate).toBeUndefined();
});

it('将模板文件收进工程包，并重写两种模板的资源路径',async()=>{
 const {createInitialData}=await import('../src/domain/fixtures');
 const {exportWork}=await import('../src/domain/export');
 const {default:JSZip}=await import('jszip');
 const imageTemplate={assetId:'img',src:'/test-template.jpg',name:'图片模板'};
 const videoTemplate={assetId:'vid',src:'/test-template.mp4',name:'视频模板'};
 const baseline=createInitialData().works.find(work=>work.kind==='story')!;
 const work={...baseline,cover:undefined,storyNodes:[{id:'shoot',type:'photo' as const,title:'留真',text:'',x:0,y:0,photo:{imageTemplate,videoTemplate}}]};
 const {blob}=await exportWork(work,'browser',{loadMedia:async src=>new Blob([src],{type:src.endsWith('.mp4')?'video/mp4':'image/jpeg'})});
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const {photo}=JSON.parse(await zip.file('scene.json')!.async('string')).storyNodes[0];
 for(const [template,saved] of [[imageTemplate,photo.imageTemplate],[videoTemplate,photo.videoTemplate]]){
  expect(saved.assetId).toBe(template.assetId);
  expect(await zip.file(saved.src)!.async('string')).toBe(template.src);
 }
});
