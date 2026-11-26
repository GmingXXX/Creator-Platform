import type {CSSProperties} from 'react';

export interface PhotoTemplate {assetId:string;src:string;name:string}

export type PhotoSettings = {
  shape: 'rect' | 'rounded' | 'circle';
  outline: 'solid' | 'dashed' | 'none';
  x:number; y:number; size:number;
  imageTemplate?:PhotoTemplate; videoTemplate?:PhotoTemplate;
  seconds:number; hint:string; allowRetake:boolean;
};

function inRange(value:number|undefined,min:number,max:number,fallback:number) {
  return value!==undefined&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):fallback;
}

function validTemplate(t:PhotoTemplate|undefined):t is PhotoTemplate {
  return !!t && typeof t.assetId==='string' && !!t.assetId && typeof t.src==='string' && !!t.src && typeof t.name==='string';
}

export function mapPhotoTemplates(photo:Partial<PhotoSettings>,map:(template:PhotoTemplate,kind:'image'|'video')=>PhotoTemplate) {
  const {imageTemplate,videoTemplate,...settings}=photo;
  return {...settings,...(validTemplate(imageTemplate)?{imageTemplate:map(imageTemplate,'image')}:{}),
    ...(validTemplate(videoTemplate)?{videoTemplate:map(videoTemplate,'video')}:{})};
}

export function collectStoryPhotoTemplates(work:{storyNodes?:{photo?:Partial<PhotoSettings>}[]}) {
  return (work.storyNodes||[]).flatMap(node=>[node.photo?.imageTemplate,node.photo?.videoTemplate]).filter((t):t is PhotoTemplate=>validTemplate(t));
}

export function photoSampleResults(photo:Partial<PhotoSettings>|undefined,src:string) {
  const settings=readPhotoSettings(photo);
  return {photo:src,...(settings.imageTemplate?{faceImage:settings.imageTemplate.src}:{}),
    ...(settings.videoTemplate?{faceVideo:settings.videoTemplate.src}:{})};
}

export function readPhotoSettings(value:Partial<PhotoSettings>={}):PhotoSettings {
  return {
    ...(validTemplate(value.imageTemplate)?{imageTemplate:value.imageTemplate}:{}),
    ...(validTemplate(value.videoTemplate)?{videoTemplate:value.videoTemplate}:{}),
    shape:value.shape==='rect'||value.shape==='circle'?value.shape:'rounded',
    outline:value.outline==='none'||value.outline==='dashed'?value.outline:'solid',
    x:inRange(value.x,0,100,80), y:inRange(value.y,0,100,32), size:inRange(value.size,15,80,52),
    seconds:inRange(value.seconds,0,10,0), hint:typeof value.hint==='string'?value.hint.slice(0,100):'请面向取景框',
    allowRetake:value.allowRetake!==false,
  };
}

export function frameGeometry(settings:PhotoSettings):CSSProperties {
  return {
    left:settings.x+'%',top:settings.y+'%',transform:'translate('+(-settings.x)+'%, '+(-settings.y)+'%)',
    width:'min('+settings.size+'cqw, '+settings.size+'cqh)',aspectRatio:settings.shape==='circle'?'1':'4 / 3',
    borderRadius:settings.shape==='circle'?'50%':settings.shape==='rounded'?'12%':'0',borderStyle:settings.outline,
  };
}
