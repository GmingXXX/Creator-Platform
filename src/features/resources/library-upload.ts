import {uploadFileKind} from '../../domain/upload';

const formats={
 image:'.png,.jpg,.jpeg,.webp,.gif,.svg,.avif',video:'.mp4,.webm,.mov',audio:'.mp3,.wav,.m4a,.ogg',
 document:'.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,.zip',component:'.zip,.html,.htm',
};
const policies={
 all:{label:'上传素材',name:'全部素材',accept:Object.values(formats).join(','),hint:'图片、视频、音频、文档与组件包，上传后按文件类型自动归类'},
 image:{label:'上传图片',name:'图片',accept:formats.image,hint:'PNG、JPG、JPEG、WebP、GIF、SVG、AVIF · 单个不超过 50 MB'},
 video:{label:'上传视频',name:'视频',accept:formats.video,hint:'MP4、WebM、MOV · 单个不超过 200 MB'},
 audio:{label:'上传音频',name:'音频',accept:formats.audio,hint:'MP3、WAV、M4A、OGG · 单个不超过 50 MB'},
 document:{label:'上传文档',name:'文档资料',accept:formats.document,hint:'PDF、Word、PPT、Excel、CSV、TXT、Markdown、JSON、普通资料 ZIP · 单个不超过 50 MB'},
 component:{label:'上传组件包',name:'组件',accept:formats.component,hint:'包含 HTML、依赖与素材的 ZIP 组件包（≤50 MB），也支持 HTML / HTM 文件（≤5 MB）'},
};
export type LibraryUploadCategory=keyof typeof policies;
export function libraryUploadPolicy(value:string){
 const category:LibraryUploadCategory=value==='html'?'component':Object.hasOwn(policies,value)?value as LibraryUploadCategory:'all';
 return {category,...policies[category]};
}
/** Inspection resolves ambiguous ZIPs before anything is persisted. Never coerce a file's kind. */
export function validateLibraryUpload(file:File,category:string,isComponent:boolean):void{
 const kind=uploadFileKind(file),target=libraryUploadPolicy(category);
 const actual=isComponent||kind==='html'?'component':kind;
 if(target.category==='all'||target.category===actual)return;
 if(target.category==='component'&&file.name.toLowerCase().endsWith('.zip'))throw new Error('这个 ZIP 中没有 HTML 入口，属于普通资料包，请到「文档资料」或「全部素材」上传。');
 const name=libraryUploadPolicy(actual).name;
 throw new Error(`当前正在上传${target.name}，此文件属于${name}。请到「${name}」或「全部素材」上传。`);
}
