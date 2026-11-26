import type {Run,Work} from './types';

// A new image can be a background for the open exhibit or a separate deliverable.
export function isWorkBackgroundRequest(input: string, hasCurrentCandidate = false): boolean {
  const text = input.replace(/\s+/g, '');
  if (/(?:不要|不用|无需|别)(?:再|重新)?(?:生成|制作|更换|换|画|做)[^，。；！？]{0,14}(?:背景|底图|壁纸)/.test(text)) return false;
  if (/(?:生成|制作|设计|做)[^，。；！？]{0,16}(?:含|带|包含)[^，。；！？]{0,15}(?:背景|底图)[^，。；！？]{0,12}(?:页面|展项|演示|影片)/.test(text)) return false;
  if (hasCurrentCandidate && /^(?:请|帮我)?(?:再来一张|再换一版|再试一张|重新生成一张|(?:再|稍微|整体再?)(?:暗|亮|浅|深|淡|暖|冷|简洁|柔和)(?:一点|一些|点|些))([。！!]|$)/.test(text)) return true;
  if (!/背景|底图|壁纸/.test(text)) return false;
  if (/无关|不(?:要)?参考|不沿用|脱离|独立(?:的)?(?:素材|图片)|(?:单独|独立)(?:帮我)?(?:做|画|生成|制作)/.test(text)) return false;
  if (/(?:从|用|选择|挑)[^，。；！？]{0,12}(?:素材库|附件|现有图片|已上传)[^，。；！？]{0,16}(?:替换|换|设置|用作|当作|作为)[^，。；！？]{0,8}背景/.test(text)) return false;
  if (/背景(?:音乐|乐|音频|声音|视频|介绍|资料|故事|信息)|(?:介绍|分析|解释).{0,12}背景/.test(text)) return false;
  return /(?:生成|绘制|画|做|设计|制作|出|来|需要|想要|换|(?:配|加|补)(?:一[张幅个]|个))(?:[^，。；！？]{0,28})(?:背景|底图|壁纸)/.test(text)
    || /(?:背景图|背景素材|底图|壁纸).{0,12}(?:重新生成|再生成|重画|生成一张)/.test(text);
}

export function exhibitBackgroundPage(work:Work,run:Run,pageId?:string) {
  if(pageId)return work.pages.find(p=>p.id===pageId);
  const previous=run.backgroundDraft;
  return (previous?.targetWorkId===work.id&&work.pages.find(p=>p.id===previous.targetPageId))||work.pages[0];
}

export function tryWorkBackgroundRequest(run:Run,work:Work,input:string,pageId?:string) {
  if(run.status!=='complete'||work.kind!=='exhibit')return;
  const page=exhibitBackgroundPage(work,run,pageId);
  const draft=run.backgroundDraft;
  const hasCandidate=!!draft?.assetId&&draft.targetWorkId===work.id&&draft.targetPageId===page?.id;
  if(!isWorkBackgroundRequest(input,hasCandidate))return;
  if(!page)throw new Error('目标页面已不存在，请重新选择页面');
  return page;
}
