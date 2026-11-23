import {describe,it,expect,vi} from 'vitest';
import {togglePreviewFullscreen} from '../src/components/preview-fullscreen-domain';
describe('preview fullscreen capability',()=>{
 it('enters and leaves the requested surface',async()=>{
 const enter=vi.fn(async()=>{}),exit=vi.fn(async()=>{}),surface={requestFullscreen:enter},doc={fullscreenElement:null,exitFullscreen:exit};
 await togglePreviewFullscreen(surface,doc);expect(enter).toHaveBeenCalledTimes(1);
 await togglePreviewFullscreen(surface,{...doc,fullscreenElement:surface});expect(exit).toHaveBeenCalledTimes(1);
 });
 it('reports missing capability or rejected browser request instead of claiming success',async()=>{
 await expect(togglePreviewFullscreen({}, {fullscreenElement:null})).rejects.toThrow('不支持');
 await expect(togglePreviewFullscreen({requestFullscreen:async()=>{throw Error('blocked')}},{fullscreenElement:null})).rejects.toThrow('blocked');
 await expect(togglePreviewFullscreen({}, {fullscreenElement:{}})).rejects.toThrow('不支持');
 });
});
