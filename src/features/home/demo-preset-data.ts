import {demoPresentationFiles} from '../../domain/demo-presentation-media';
/* Minimal fictional inputs. Missing materials are produced inside the platform. */
export const demoPresetData = [
  {
    "id": "timeline",
    "title": "企业鱼骨时间轴",
    "prompt": "根据上传的星澜智造文字资料和3张客户示意图片，制作1920×1080的鱼骨图时间轴交互页面。保留10个事件，上下交错，支持横向拖动和点击详情。优先使用提供的图片，其余从素材库匹配或生成概念配图，明确标注AI视觉示意。遵循华院设计规范及所选设计风格，先确认事件和配图方案，再生成可体验作品。所有企业信息为虚构演示。",
    "files": [
      {
        "name": "星澜智造_企业大事件.md",
        "path": "星澜智造_企业大事件.md",
        "url": "/demo-inputs/v2/timeline/星澜智造_企业大事件.md",
        "mime": "text/markdown"
      },
      {
        "name": "2012_事件配图.png",
        "path": "素材/2012_事件配图.png",
        "url": "/demo-inputs/v2/timeline/素材/2012_事件配图.png",
        "mime": "image/png"
      },
      {
        "name": "2018_事件配图.jpg",
        "path": "素材/2018_事件配图.jpg",
        "url": "/demo-inputs/v2/timeline/素材/2018_事件配图.jpg",
        "mime": "image/jpeg"
      },
      {
        "name": "2022_事件配图.jpg",
        "path": "素材/2022_事件配图.jpg",
        "url": "/demo-inputs/v2/timeline/素材/2022_事件配图.jpg",
        "mime": "image/jpeg"
      }
    ],
    "skill": {
      "name": "鱼骨时间轴编排.zip",
      "path": "鱼骨时间轴编排.zip",
      "url": "/demo-inputs/v1/timeline/鱼骨时间轴编排.zip",
      "mime": "application/zip"
    }
  },
  {
    "id": "presentation",
    "title": "企业智能演示",
    "prompt": "只依据上传的PPT大纲生成8页智能演示，介绍星澜智造的能力与实践。保留事实和指标口径；保持原大纲8页标题和顺序，前6页采用配套预置概念图，第7、8页（储能监测案例、下一阶段的方向）留空用于现场AI实时生成；不要将前6页图片重复用于这两页。素材来自平台素材库，均为模拟概念图，遵循华院设计规范及所选设计风格。先确认大纲和素材方案，再生成正文、配图与逐页讲稿，交付可自动讲解和基于资料问答的作品。",
    "files": [
      {
        "name": "星澜智造_智能演示大纲.pptx",
        "path": "星澜智造_智能演示大纲.pptx",
        "url": "/demo-inputs/v1/presentation/星澜智造_智能演示大纲.pptx",
        "mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      },
      ...demoPresentationFiles
    ],
    "skill": {
      "name": "企业智能演示编排.zip",
      "path": "企业智能演示编排.zip",
      "url": "/demo-inputs/v1/presentation/企业智能演示编排.zip",
      "mime": "application/zip"
    }
  },
  {
    "id": "story",
    "title": "互动故事",
    "prompt": "我想创作一部《泰山寻碑》互动故事：观众成为年轻的碑刻守护者，在云海、石阶与山门之间寻找失落的碑文。请从创意自主生成策划脚本、角色与场景、图片和视频素材，再编排两处选择和3种结局。先让我确认故事方向、节点与素材方案，再生成可交互影片。遵循华院设计规范及所选设计风格；故事为虚构创作，不冒充真实史实。",
    "files": [],
    "skill": {
      "name": "互动故事节点编排.zip",
      "path": "互动故事节点编排.zip",
      "url": "/demo-inputs/v1/story/互动故事节点编排.zip",
      "mime": "application/zip"
    }
  },
  {
    "id": "component",
    "title": "成果卡片组件",
    "prompt": "为星澜智造制作一个带轻微悬浮动效的企业成果卡片组。3张卡片：设备感知（X-Link边缘采集）、绿色运营（单位产品能耗下降12%，2021年相对2020年）、数字孪生（可视化与维修培训）。使用深蓝科技风，标题“看见创新的力量”。开放标题、说明、主题色、悬浮效果开关等参数，生成后让我预览试编辑，并保存为可复用组件包。所有企业数据为虚构演示。",
    "files": [
      {
        "name": "组件制作需求.md",
        "path": "组件制作需求.md",
        "url": "/demo-inputs/v1/component/组件制作需求.md",
        "mime": "text/markdown"
      }
    ],
    "skill": {
      "name": "企业成果卡片编排.zip",
      "path": "企业成果卡片编排.zip",
      "url": "/demo-inputs/v1/component/企业成果卡片编排.zip",
      "mime": "application/zip"
    }
  },
  {
    "id": "honors",
    "title": "荣誉与案例展示",
    "prompt": "帮我把公司的荣誉资质和技术案例做成一个可演示的展项，内容从当前绑定的知识本地场获取。",
    "files": [
      {
        "name": "星澜智造_荣誉资质.md",
        "path": "星澜智造_荣誉资质.md",
        "url": "/demo-inputs/v1/honors/星澜智造_荣誉资质.md",
        "mime": "text/markdown"
      },
      {
        "name": "星澜智造_技术案例.md",
        "path": "星澜智造_技术案例.md",
        "url": "/demo-inputs/v1/honors/星澜智造_技术案例.md",
        "mime": "text/markdown"
      }
    ],
    "skill": {
      "name": "荣誉与案例证据编排.zip",
      "path": "荣誉与案例证据编排.zip",
      "url": "/demo-inputs/v1/honors/荣誉与案例证据编排.zip",
      "mime": "application/zip"
    }
  }
] as const;
