interface FullscreenSurface {requestFullscreen?:()=>Promise<void>}
interface FullscreenDocument {fullscreenElement:unknown;exitFullscreen?:()=>Promise<void>}
/** No state is assumed until the browser emits fullscreenchange. */
export async function togglePreviewFullscreen(surface:FullscreenSurface,doc:FullscreenDocument):Promise<void> {
 if(doc.fullscreenElement){if(!doc.exitFullscreen)throw new Error('当前浏览器不支持退出全屏，请按 Esc');await doc.exitFullscreen();return;}
 if(!surface.requestFullscreen)throw new Error('当前浏览器不支持全屏，请使用窗口预览');
 await surface.requestFullscreen();
}
