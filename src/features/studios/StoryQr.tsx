import {useMemo} from 'react';
import {QrCode} from 'lucide-react';
import {buildStoryQr} from '../../domain/story-qr';
export function StoryQr({value}:{value?:string}){
 const code=useMemo(()=>buildStoryQr(value),[value]);
 return code.status==='ready'?<svg role="img" aria-label="可扫描二维码" viewBox={`0 0 ${code.size} ${code.size}`} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d={code.path} fill="#17202a"/></svg>:<span className="story-qr-placeholder" role="status"><QrCode/><small>{code.status==='empty'?'填写扫码内容':'扫码内容过长，请缩短至 512 字以内'}</small></span>;
}
