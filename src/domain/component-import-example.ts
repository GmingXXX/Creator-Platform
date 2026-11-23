import JSZip from 'jszip';

export async function createExampleComponentPackage(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('component.json', JSON.stringify({
    schemaVersion: 1, name: '企业成果展示卡', description: '展示企业主题、业务介绍与成果数据，可在导入时试编辑内容和主题色。', entry: 'index.html', bridge: 'zhichuang-component-v1',
    fields: [
      { key: 'title', label: '标题', type: 'text', default: '让创新，成为看得见的成果' },
      { key: 'description', label: '内容说明', type: 'textarea', default: '从技术研发到产业应用，以持续探索回应每一个真实需求。' },
      { key: 'accent', label: '主题色', type: 'color', default: '#56b8ca' },
      { key: 'count', label: '数值', type: 'number', default: 128, min: 0, max: 99999 },
      { key: 'showCount', label: '显示成果数据', type: 'boolean', default: true },
    ],
  }, null, 2));
  zip.file('index.html', `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>企业成果展示卡</title><link rel="stylesheet" href="card.css"></head><body><main><div class="eyebrow"><span></span>ENTERPRISE / INNOVATION</div><div class="layout"><section><p class="label">以创新驱动未来</p><h1 id="title"></h1><p id="description"></p><div class="line"></div><p class="footnote">示例组件 · 内容与数值可自由替换</p></section><aside id="metric"><div class="orbit"></div><strong id="count"></strong><span>项创新成果</span></aside></div></main><script src="card.js"></script></body></html>`);
  zip.file('card.css', `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%}body{font-family:system-ui,-apple-system,"PingFang SC",sans-serif;background:#102331;color:#edf6f7;--accent:#56b8ca}main{height:100%;min-height:260px;padding:clamp(24px,5vw,70px);background:radial-gradient(ellipse at 90% 30%,#2b526244,transparent 65%);display:flex;flex-direction:column;justify-content:center}.eyebrow{display:flex;gap:10px;align-items:center;font-size:10px;letter-spacing:3px;color:#8bb1bd}.eyebrow span{width:6px;height:6px;background:var(--accent);border-radius:50%}.layout{display:flex;align-items:center;gap:8%;margin-top:7%;justify-content:space-between}section{flex:1;min-width:0}.label{color:var(--accent);font-size:12px;letter-spacing:2px}h1{font-size:clamp(22px,4vw,44px);line-height:1.4;margin:14px 0;font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere}#description{font-size:clamp(12px,1.5vw,16px);line-height:1.9;color:#acc0c9;white-space:pre-wrap;overflow-wrap:anywhere}.line{width:45px;height:2px;background:var(--accent);margin:25px 0 15px}.footnote{font-size:10px;color:#728c99}aside{position:relative;flex:0 0 30%;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:1}.orbit{position:absolute;inset:0;border:1px solid var(--accent);opacity:.25;border-radius:50%;box-shadow:0 0 0 20px #ffffff03,0 0 0 40px #ffffff02}aside strong{font-size:clamp(36px,8vw,90px);font-weight:400;color:var(--accent);letter-spacing:-3px}aside>span{font-size:12px;color:#97b1bc;margin-top:8px}aside[hidden]{display:none}@media(max-width:420px){.layout{gap:15px}aside{flex-basis:28%}.orbit{box-shadow:none}h1{font-size:22px}}`);
  zip.file('card.js', `window.ZhichuangComponent.subscribe(props=>{
document.getElementById('title').textContent=props.title;
document.getElementById('description').textContent=props.description;
document.documentElement.style.setProperty('--accent',props.accent);
document.body.style.setProperty('--accent',props.accent);
document.getElementById('count').textContent=String(props.count);
document.getElementById('metric').hidden=!props.showCount;
});`);
  zip.file('README.md', `# 智创组件包示例\n\n将本 ZIP 拖入素材库，检查后启动预览并试编辑。\n\n## 组件清单\ncomponent.json 使用 schemaVersion: 1，entry 指向已构建的 HTML，fields 声明开放参数。支持 text、textarea、color（六位十六进制）、number、boolean。\n\n## 编辑接口\n平台会在预览与保存时注入 SDK。运行脚本通过 window.ZhichuangComponent.subscribe(props => { /* 更新页面 */ }) 接收初始值和后续编辑；使用 textContent 写入文本。无需自行实现消息监听。回调需要同步更新画面；回调成功后平台才确认编辑接口连接。\n\n## 支持范围\n本版合并包内经典 JavaScript、CSS、图片、音视频和字体。请预先构建源码；ES 模块、动态本地 fetch、Worker、嵌套页面等需要先构建为自包含运行包。本版不会安装 npm 依赖。\n\nHTML 单文件未声明参数时只支持调整位置与尺寸。静态检查、页面加载和离线验证是不同的检查，正式交付需要在实际环境中验证。\n`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
