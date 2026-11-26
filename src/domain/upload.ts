import { get, set } from 'idb-keyval';
import {isWorkBackgroundSample} from './work-background';
import { useEffect, useState } from 'react';
import type { Asset, AssetKind, AssetMetadata } from './types';
import { now, uid } from './scenes';
const MB = 1024 * 1024;
const mediaCache = new Map<string, string>();
const pendingMedia = new Map<string, Promise<string>>();
const extensionKinds: Record<string, AssetKind> = {
    png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', svg: 'image', avif: 'image',
    mp4: 'video', webm: 'video', mov: 'video', mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
    html: 'html', htm: 'html', pdf: 'document', doc: 'document', docx: 'document', ppt: 'document', pptx: 'document',
    xls: 'document', xlsx: 'document', txt: 'document', md: 'document', csv: 'document', json: 'document', zip: 'document',
};
export function uploadFileKind(file: File): AssetKind {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const kind = extensionKinds[extension];
    if (!kind)
        throw new Error('暂不支持此文件格式，请上传图片、视频、音频或常用文档。');
    if (!file.size)
        throw new Error('文件为空，请选择包含内容的文件。');
    const maxMB = kind === 'video' ? 200 : 50;
    if (file.size > maxMB * MB)
        throw new Error(`文件过大，${kind === 'video' ? '视频' : '文件'}请控制在 ${maxMB} MB 以内。`);
    if (file.type && ['image', 'video', 'audio'].includes(kind) && !file.type.startsWith(`${kind}/`) && file.type !== 'application/octet-stream')
        throw new Error('文件扩展名与内容格式不一致。');
    return kind;
}
export async function importFile(file: File): Promise<Asset> {
    const kind = uploadFileKind(file);
    if (file.name.toLowerCase().endsWith('.svg')) {
        const content = await file.text();
        if (/<\s*(script|foreignObject|iframe)|\bon\w+\s*=|javascript\s*:|<\s*!DOCTYPE/i.test(content))
            throw new Error('此 SVG 含有可执行内容，请导出为静态 SVG 或 PNG 后上传。');
    }
    const facts=await extractFileFacts(file,kind);
    const id = uid('upload');
    try {
        await set(`zhichuang-media:${id}`, file);
    }
    catch {
        throw new Error('无法保存上传文件，浏览器存储空间可能不足。请清理空间后重试。');
    }
    const src = `idb:${id}`;
    return {
        id, name: file.name, kind, src, preview: kind === 'image' ? src : '/media/technology.svg', description: `本地上传 · ${(file.size / MB).toFixed(2)} MB`, tags: ['本地上传'], author: '纪鸣', createdAt: now(), source: 'uploaded', public: false,
        metadata:{facts,analysis:{status:'needs-description',summary:'已读取文件属性。尚未进行内容识别，可补充业务说明帮助查找；文件名不作为客户身份依据。',tags:[],basis:'file'}}
    };
}

type FileFacts=NonNullable<AssetMetadata['facts']>;
const positive=(value:number)=>Number.isFinite(value)&&value>0;

/** Native file parsing only. No image meaning, brand, approval or rights are inferred. */
export async function extractFileFacts(file:File,kind:AssetKind,timeoutMs=1800):Promise<FileFacts> {
    const basic:FileFacts={mime:file.type||'application/octet-stream',bytes:file.size};
    try {
        if(kind==='image'&&file.name.toLowerCase().endsWith('.png')){
            const bytes=new Uint8Array(await file.slice(0,24).arrayBuffer());
            if(bytes.length===24&&[137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte)){
                const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
                if(positive(width)&&positive(height))return {...basic,width,height};
            }
        }
        if(kind==='image'&&file.name.toLowerCase().endsWith('.svg')){
            const text=await file.text(),root=text.match(/<svg\b[^>]*>/i)?.[0]||'';
            const numeric=(name:string)=>Number(root.match(new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)(?:px)?["']`,'i'))?.[1]);
            const viewBox=root.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
            const width=numeric('width')||(viewBox?.length===4?viewBox[2]:0),height=numeric('height')||(viewBox?.length===4?viewBox[3]:0);
            if(positive(width)&&positive(height))return {...basic,width,height};
        }
        if(!['image','video','audio'].includes(kind)||typeof document==='undefined')return basic;
        return {...basic,...await browserMediaFacts(file,kind,timeoutMs)};
    } catch {return basic;}
}

function browserMediaFacts(file:File,kind:AssetKind,timeoutMs:number):Promise<FileFacts> {
    return new Promise(resolve=>{
        const media=document.createElement(kind==='image'?'img':kind==='video'?'video':'audio');
        const src=URL.createObjectURL(file);
        let completed=false;
        const finish=(facts:FileFacts={})=>{
            if(completed)return;completed=true;clearTimeout(timer);
            media.onload=null;media.onerror=null;
            if(media instanceof HTMLMediaElement){media.onloadedmetadata=null;media.removeAttribute('src');media.load();}
            URL.revokeObjectURL(src);resolve(facts);
        };
        const timer=setTimeout(()=>finish(),Math.max(1,timeoutMs));
        media.onerror=()=>finish();
        if(media instanceof HTMLImageElement){
            media.onload=()=>finish(positive(media.naturalWidth)&&positive(media.naturalHeight)?{width:media.naturalWidth,height:media.naturalHeight}:{});
        } else {
            media.preload='metadata';
            media.onloadedmetadata=()=>finish({...(positive(media.duration)?{duration:media.duration}:{}),...(media instanceof HTMLVideoElement&&positive(media.videoWidth)&&positive(media.videoHeight)?{width:media.videoWidth,height:media.videoHeight}:{})});
        }
        media.src=src;
    });
}
export async function readMediaBlob(src: string): Promise<Blob> {
    if (!src.startsWith('idb:'))
        throw new Error('该资源不是本地导入文件。');
    let blob: Blob | undefined;
    try {
        blob = await get<Blob>(`zhichuang-media:${src.slice(4)}`);
    }
    catch {
        throw new Error('浏览器无法读取本地素材，请重试。');
    }
    if (!blob)
        throw new Error('未找到本地素材，可能已清理浏览器数据。请重新上传。');
    return blob;
}
function permittedMediaUrl(src:string):boolean {
    return !/^(javascript|vbscript|data):/i.test(src.trim()) || isWorkBackgroundSample(src);
}
export async function resolveMedia(src: string): Promise<string> {
    if (!src.startsWith('idb:')) {
        if (!permittedMediaUrl(src))
            throw new Error('不支持此媒体地址。');
        return src;
    }
    const cached = mediaCache.get(src);
    if (cached)
        return cached;
    const pending = pendingMedia.get(src);
    if (pending)
        return pending;
    const promise = readMediaBlob(src).then(blob => {
        const url = URL.createObjectURL(blob);
        mediaCache.set(src, url);
        return url;
    }).finally(() => pendingMedia.delete(src));
    pendingMedia.set(src, promise);
    return promise;
}
export function clearMediaCache(): void {
    mediaCache.forEach(url => URL.revokeObjectURL(url));
    mediaCache.clear();
    pendingMedia.clear();
}
export function useMedia(src?: string): string {
    const [resolved, setResolved] = useState(() => src?.startsWith('idb:') ? mediaCache.get(src) || '' : src && permittedMediaUrl(src) ? src : '');
    useEffect(() => {
        let active = true;
        if (!src) {
            setResolved('');
            return;
        }
        if (!src.startsWith('idb:')) {
            setResolved(permittedMediaUrl(src) ? src : '');
            return;
        }
        setResolved(mediaCache.get(src) || '');
        resolveMedia(src).then(value => {
            if (active)
                setResolved(value);
        }).catch(() => {
            if (active)
                setResolved('');
        });
        return () => {
            active = false;
        };
    }, [src]);
    return resolved;
}
