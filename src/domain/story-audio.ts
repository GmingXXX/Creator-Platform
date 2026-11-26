import type {Work} from './types';

export interface StoryAudioTrack {assetId:string;src:string;volume:number}
export interface StoryNodeSound {musicMode?:'inherit'|'own'|'off';inheritedVolume?:number;music?:StoryAudioTrack;narration?:StoryAudioTrack;videoVolume?:number}

export function trackVolume(value:number|undefined,fallback:number) {
  return value!==undefined&&Number.isFinite(value)?Math.min(1,Math.max(0,value)):fallback;
}
export function effectiveStoryMusic(project?:StoryAudioTrack,node?:StoryNodeSound) {
  if(node?.musicMode==='off')return;
  if(node?.musicMode==='own')return node.music;
  if(!project||node?.inheritedVolume===undefined)return project;
  return {...project,volume:trackVolume(project.volume,1)*trackVolume(node.inheritedVolume,1)};
}
export function collectStoryAudio(work:Pick<Work,'storyMusic'|'storyNodes'>) {
  return [work.storyMusic,...(work.storyNodes||[]).flatMap(node=>[node.sound?.music,node.sound?.narration])].filter((t):t is StoryAudioTrack=>!!t);
}
