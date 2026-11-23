export interface ComponentReply {
  type: string;
  channel: string;
  requestId?: number;
  message?: string;
}

/** A sandboxed iframe has an opaque origin. Bind to its exact window AND session. */
export function isComponentReply(event: { source: unknown; data: unknown }, frame: unknown, channel: string): event is { source: unknown; data: ComponentReply } {
  if (!frame || event.source !== frame || !event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return false;
  const data = event.data as ComponentReply;
  if (data.channel !== channel) return false;
  if (['zhichuang:preview:loaded', 'zhichuang:preview:error'].includes(data.type)) return true;
  return ['zhichuang:component:ready', 'zhichuang:component:applied', 'zhichuang:component:error'].includes(data.type)
    && Number.isSafeInteger(data.requestId) && Number(data.requestId) >= 0;
}

/** Used only in the trial frame; never persist the session or monitoring script. */
export function instrumentComponentPreview(html: string, channel: string): string {
  const safeChannel = JSON.stringify(channel).replace(/</g, '\\u003c');
  const script = `<script>(()=>{const channel=${safeChannel};const report=(type,message)=>parent.postMessage({type,channel,message},'*');window.addEventListener('error',e=>{const el=e.target;report('zhichuang:preview:error',e.message||('资源未能加载：'+(el&&el.tagName||'未知资源')))},true);window.addEventListener('unhandledrejection',()=>report('zhichuang:preview:error','组件运行出现未处理的异常'));window.addEventListener('DOMContentLoaded',()=>report('zhichuang:preview:loaded','预览文档已加载'));})();</script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => match + script);
  const doctype = html.match(/^\s*<!doctype[^>]*>/i)?.[0];
  return doctype ? doctype + script + html.slice(doctype.length) : script + html;
}
