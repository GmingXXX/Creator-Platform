import {describe,expect,it} from 'vitest';
import {libraryUploadPolicy,validateLibraryUpload} from '../src/features/resources/library-upload';
describe('素材分类上传',()=>{
 it.each([['all','上传素材'],['image','上传图片'],['video','上传视频'],['audio','上传音频'],['document','上传文档'],['component','上传组件包']])('%s 显示清晰入口', (category,label)=>expect(libraryUploadPolicy(category).label).toBe(label));
 it('旧HTML分类映射组件，未知分类回退全部',()=>{expect(libraryUploadPolicy('html').category).toBe('component');expect(libraryUploadPolicy('missing').category).toBe('all');});
 it('文件选择格式与分类对应',()=>{expect(libraryUploadPolicy('image').accept).toContain('.png');expect(libraryUploadPolicy('image').accept).not.toContain('.mp4');expect(libraryUploadPolicy('component').accept).toBe('.zip,.html,.htm');});
 it('错类型与伪装MIME在保存之前被拒绝',()=>{expect(()=>validateLibraryUpload(new File(['text'],'note.txt'),'image',false)).toThrow('文档');expect(()=>validateLibraryUpload(new File(['text'],'x.png',{type:'video/mp4'}),'image',false)).toThrow('不一致');});
 it('普通ZIP仅文档和全部接受，组件ZIP仅组件和全部接受',()=>{const f=new File(['zip'],'bundle.zip');expect(()=>validateLibraryUpload(f,'document',false)).not.toThrow();expect(()=>validateLibraryUpload(f,'component',false)).toThrow('没有 HTML');expect(()=>validateLibraryUpload(f,'document',true)).toThrow('组件');expect(()=>validateLibraryUpload(f,'component',true)).not.toThrow();expect(()=>validateLibraryUpload(f,'all',true)).not.toThrow();});
 it.each([['x.png','image'],['x.mp4','video'],['x.mp3','audio'],['x.txt','document'],['x.html','component']])('正确分类接受 %s', (name,category)=>{const file=new File(['content'],name);expect(()=>validateLibraryUpload(file,category,name.endsWith('.html'))).not.toThrow();expect(()=>validateLibraryUpload(file,'all',name.endsWith('.html'))).not.toThrow();});
 it('不支持和空文件仍明确拒绝',()=>{expect(()=>validateLibraryUpload(new File(['x'],'x.exe'),'all',false)).toThrow('不支持');expect(()=>validateLibraryUpload(new File([],'x.txt'),'document',false)).toThrow('为空');});
});
