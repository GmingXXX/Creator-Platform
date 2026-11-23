from pathlib import Path
import json,csv,zipfile,shutil,html
from pptx import Presentation
from pptx.util import Inches,Pt
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'output/智创真实演示资料_20261116'
OUT.mkdir(parents=True,exist_ok=True)
def docx(path,title,paragraphs):
 p=lambda t:'<w:p><w:r><w:t xml:space="preserve">'+html.escape(t)+'</w:t></w:r></w:p>'
 body=''.join(p(t) for t in [title,*paragraphs])
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  z.writestr('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr/></w:body></w:document>')
def skill(folder,name,steps):
 text='# '+name+'\n\n用于智创演示的内容编排能力，所有企业事实以用户资料为准。\n\n## 输入\n用户需求、企业资料、上传素材和设计风格。\n\n## 步骤\n'+'\n'.join(f'{i+1}. {s}' for i,s in enumerate(steps))
 with zipfile.ZipFile(folder/(name+'.zip'),'w',zipfile.ZIP_DEFLATED) as z:z.writestr('SKILL.md',text)
def save_prompt(folder,text): (folder/'演示提示词.txt').write_text(text,encoding='utf8')
company='星澜智造科技有限公司（虚构演示企业）'
notice='本资料所有企业名称、事件、数据均为虚构演示内容；配图为用户已有模板中的示意素材，不构成企业事实证明。'
history=[('2012','从一间实验室出发','星澜智造在苏州成立，初始团队18人，专注工业设备状态采集。'),('2014','首套边缘采集终端发布','自主研发边缘采集终端X-Link，完成首个示范车间部署。'),('2016','联合研发中心启用','成立工业感知联合研发中心，研发团队扩展至60人。'),('2018','数字化示范产线投运','首条柔性装配示范产线投运，过程数据可追溯覆盖率达到85%。'),('2020','工业数据平台上线','星澜云枢平台上线，将设备、质量和能源数据接入统一数据底座。'),('2021','绿色能源管理试点','在示范工厂开展能源优化试点，同口径单位产品能耗较2020年下降12%。'),('2022','数字孪生应用落地','完成首个产线数字孪生试点，支持设备状态可视化和维修培训。'),('2023','华南服务中心成立','在东莞设立华南服务中心，形成苏州研发、东莞服务双节点布局。'),('2024','新一代储能监测方案交付','储能监测方案X-Energy完成试点交付，采集间隔由5秒缩短至1秒。'),('2025','向协同制造迈进','截至2025年底，累计服务120家演示客户，研发人员占比35%，下一阶段聚焦跨工厂协同。')]
f=OUT/'01_企业大事件';f.mkdir(exist_ok=True);images=f/'素材';images.mkdir(exist_ok=True)
src=Path('/Users/ming/Desktop/unidt/project/展项模板/企业大事记/模板一/public/milestones');photos=sorted(src.glob('*'))
rows=[]
for i,(year,title,detail) in enumerate(history):
 photo=photos[i%len(photos)];name=f'{year}_事件配图{photo.suffix}';shutil.copy2(photo,images/name);rows.append({'year':year,'title':title,'description':detail,'image':name})
paras=[notice,'企业定位：面向工业客户的设备感知、数据平台和数字孪生解决方案。','展示要求：横向鱼骨图时间轴，节点上下交错；可拖动浏览，点击查看详情；图片按下列文件名绑定。']
for row in rows:paras.extend([f"{row['year']}｜{row['title']}",row['description'],'对应图片：'+row['image']])
docx(f/'星澜智造_企业大事件.docx','星澜智造 · 从感知到协同',paras)
with (f/'企业事件表.csv').open('w',encoding='utf-8-sig',newline='') as h:
 w=csv.DictWriter(h,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
skill(f,'鱼骨时间轴编排',['从正文提取日期、事件标题、摘要与完整详情，按时间排序，不补造事件。','采用鱼骨时间轴，上下交错；标题控制在18字以内。','逐一匹配文档明确指定的图片文件名，缺项留待用户确认。','保留年份、事件、图片可编辑；生成前确认事件和素材。'])
save_prompt(f,'根据上传的星澜智造企业大事件资料制作一个1920×1080的鱼骨图时间轴展项。完整保留10个事件，按文档中的图片文件名绑定配图，上下交错，支持横向拖动和点击详情。请先让我确认事件与配图，然后生成可编辑的交互页面。')
f=OUT/'02_智能演示';f.mkdir(exist_ok=True)
slides=[('从感知到协同',['星澜智造，2012年成立','面向工业客户的数字化解决方案','所有数据为虚构演示数据']),('企业发展历程',['2012年：18人团队成立','2020年：星澜云枢平台上线','2025年：累计服务120家演示客户']),('三项核心能力',['设备感知：X-Link边缘采集','数据平台：设备、质量、能源统一治理','数字孪生：运行可视化与维修培训']),('示范产线实践',['2018年柔性装配产线投运','过程数据可追溯覆盖率85%','数据来源：本演示大纲']),('绿色运营实践',['示范工厂开展能源优化试点','2021年单位产品能耗较2020年下降12%','指标口径：同一示范工厂、同类产品']),('业务与服务布局',['苏州：研发与方案设计','东莞：华南客户服务','2023年华南服务中心成立']),('储能监测案例',['2024年X-Energy试点交付','采集间隔由5秒缩短至1秒','不提供未给出的商业收益推算']),('下一阶段的方向',['2025年底研发人员占比35%','持续完善跨工厂协同','资料未给出未来营收与上市计划'])]
paras=[notice,'目标受众：客户与合作伙伴；建议8页，约3分钟，专业自然语气。','必须只依据本大纲回答，不得编造上市、利润、融资或真实客户名称。']
prs=Presentation();prs.slide_width=Inches(13.333);prs.slide_height=Inches(7.5)
for i,(title,bullets) in enumerate(slides):
 paras += [f'第{i+1}页：{title}',*['要点：'+b for b in bullets],f'讲解目标：围绕“{title}”自然解释上述事实，避免逐字念列表。']
 slide=prs.slides.add_slide(prs.slide_layouts[1]);slide.shapes.title.text=title;tf=slide.placeholders[1].text_frame;tf.clear()
 for j,b in enumerate(bullets):
  p=tf.paragraphs[0] if j==0 else tf.add_paragraph();p.text=b;p.font.size=Pt(24)
 slide.notes_slide.notes_text_frame.text='虚构演示资料。只使用本页给出的事实生成自然讲稿。'
prs.save(f/'星澜智造_智能演示大纲.pptx');docx(f/'星澜智造_智能演示大纲.docx','星澜智造 · 企业能力介绍大纲',paras)
(f/'问答验收.txt').write_text('问题1：什么时候成立？\n预期：2012年。\n问题2：能耗下降了多少，比较口径是什么？\n预期：2021年单位产品能耗较2020年下降12%，同一示范工厂、同类产品。\n问题3：公司利润是多少？\n预期：资料未提供，不编造。\n问题4：华南服务中心在哪？\n预期：东莞，2023年成立。',encoding='utf8')
skill(f,'企业智能演示编排',['按上传大纲逐页组织正文要点，保留指标及比较口径。','每页选择标题页、要点页或图文页，禁止沿用与资料无关的示例正文。','生成每页可自然播读的讲稿，每页约60至100字。','问答优先引用资料；资料未给出时明确说明，不补编数字。'])
save_prompt(f,'依据上传的PPT大纲生成8页智能演示，介绍星澜智造的能力与实践。请保留全部事实和指标口径，生成正文要点、逐页讲稿，让我先确认大纲与配图。作品要能够自动讲解和基于资料回答问题。')
f=OUT/'03_互动影片';f.mkdir(exist_ok=True);media=f/'素材';media.mkdir(exist_ok=True)
src=Path('/Users/ming/Desktop/unidt/project/泰山博物馆/taishan-multiface/public/assets/media')
for source,name in [('idle-poster.jpg','云山.jpg'),('route.png','择路.png'),('idle.mp4','候云.mp4'),('transition.mp4','云门.mp4')]:shutil.copy2(src/source,media/name)
(media/'留字互动.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{background:#e8e2d4;color:#393e39;font-family:serif;text-align:center;padding:12vh 8vw}button{padding:16px 32px;border:1px solid #8b795d;background:#fff9}h1{font-size:40px}</style><h1>留一句话，给未来的自己</h1><p id="quote">点击一枚印记，留下你的登山心意。</p><button onclick="document.getElementById(\'quote\').textContent=\'向山而行，亦向心而行。\'">留印 · 向山而行</button><p>虚构故事体验 · 不采集个人信息</p></html>',encoding='utf8')
nodes=[('start','start','候云','云海静候，点击“请君入山”开始。','候云.mp4','arrival:请君入山'),('arrival','scene','穿过云门','你是山中来客，寻找一块留给未来的无字碑。','云门.mp4','route:继续入山'),('route','choice','两条山路','你想沿着诗意寻找，还是沿着石刻寻找？','择路.png','poetry:走松风诗路；stone:走摩崖石路'),('poetry','scene','松风诗路','听松风穿过山谷，感受文字之外的山意。','云山.jpg','choice2:继续'),('choice2','choice','留给未来','你希望在碑上留下怎样的心意？','择路.png','endA:留一句勇气；endB:留一份宁静'),('stone','scene','摩崖石路','你发现石壁上留存的痕迹，决定做一名山路守护者。','云山.jpg','seal:留下心意'),('seal','scene','留印','在互动页面中留下“向山而行”的印记，再继续。','留字互动.html','endC:完成留印'),('endA','end','勇气之章','你带着敢于前行的勇气走向未来。','云山.jpg','无'),('endB','end','宁静之章','你听见风，也听见自己。','云山.jpg','无'),('endC','end','守护之章','你选择守护山路，也守护后来者的风景。','云山.jpg','无')]
paras=['这是虚构互动故事，不使用真实历史人物或史实断言。无拍照、换脸、支付和个人信息采集。','体验时长约2分钟，16:9，1920×1080。按以下节点ID、类型、台词、媒体文件及连线创建完整故事。','HTML节点里的互动独立运行，完成后由外部“完成留印”按钮继续。']
for id,t,title,body,asset,nexts in nodes:paras.extend([f'节点ID：{id}；类型：{t}；名称：{title}',f'画面与旁白：{body}',f'素材文件：{asset}',f'后续节点与按钮：{nexts}'])
docx(f/'泰山寻碑_互动故事策划脚本.docx','泰山寻碑 · 一次留给未来的旅程',paras)
(f/'节点素材对照.csv').write_text('节点,素材\n'+'\n'.join(f'{n[0]},{n[4]}' for n in nodes),encoding='utf-8-sig')
skill(f,'互动故事节点编排',['按策划稿的节点ID、分支和结局组织故事，不改写连线含义。','恰好一个start，所有节点可达，choice至少两个不同去向，每条路径有结局。','根据脚本明确指定的文件名匹配已上传素材，无法匹配时标为待确认。','生成后先展示节点、选项、素材供用户确认，再创建作品。'])
save_prompt(f,'根据上传的《泰山寻碑》策划脚本和全部节点素材制作互动影片。保留10个节点、两处选择和3种结局，图片、视频、HTML按脚本文件名对应。先让我确认节点、分支和素材，再生成可播放的作品。')
f=OUT/'04_组件生成';f.mkdir(exist_ok=True)
brief='为星澜智造制作一个带轻微悬浮动效的企业成果卡片组。3张卡片：设备感知（X-Link边缘采集）、绿色运营（单位产品能耗下降12%，2021年相对2020年）、数字孪生（可视化与维修培训）。使用深蓝科技风，标题“看见创新的力量”。开放标题、说明、主题色、悬浮效果开关等参数，生成后让我预览试编辑，并保存为可复用组件包。所有企业数据为虚构演示。'
(f/'组件制作需求.md').write_text('# 企业成果悬浮卡片组\n\n'+brief,encoding='utf8');save_prompt(f,brief)
skill(f,'企业成果卡片编排',['根据资料提取3至6项成果，每项包括标题和简短说明。','采用克制的悬浮卡片效果，保证触屏与键盘操作可用。','只开放组件已支持的参数，不声称任何HTML都能原生拆解。','生成后进入检查、实际预览和参数试编辑，确认后保存。'])
(OUT/'使用说明.md').write_text('''# 智创真实演示资料

四套资料均为演示输入，不是提前生成的成品。企业数据为虚构数据，泰山为虚构分支故事。

1. 解压总包。每个案例只上传一份正文（DOCX/PPTX/CSV任选，不要重复上传相同大纲），并选择该案例“素材”目录里的全部文件。首页支持多选上传。
2. 将相应 Skill ZIP 在 Skills 页面添加一次，再回首页选择该 Skill。
3. 选择可用的 DeepSeek 模型和设计风格（可选“无”），复制案例内提示词并发送。
4. 检查模型解析出的内容与素材对应关系，确认后生成；生成失败时查看错误并重试，不把示例模式当作真实模型结果。
5. 智能演示可从“新建项目→智能演示”进入；互动影片可从“新建项目→互动影片”进入。都支持同一套资料。

演示验证：修改一条事件或一页大纲重新生成，应看到结果随上传内容变化；演示问答中的未知利润问题应回答资料未提供。

素材来源：企业配图来自用户提供的企业大事记模板一；泰山素材来自用户已有泰山留真项目。仅作为本地演示参考，公开发布前按原项目素材授权范围处理。
''',encoding='utf8')
with zipfile.ZipFile(OUT.with_suffix('.zip'),'w',zipfile.ZIP_DEFLATED) as z:
 for p in OUT.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(OUT))
print(OUT)
