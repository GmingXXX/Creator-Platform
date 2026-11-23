import type {DesignSystem} from './types';

/** Production constraints agreed for this prototype, not a replacement for a formal brand VI. */
export function visualGenerationPrompt(description:string,style?:DesignSystem):string {
 const userDescription=description.split('\n\n华院展项制作约定：')[0].trim();
 if(!userDescription||userDescription.length>1500)throw new Error('请填写 1–1500 字的画面描述。');
 const direction=style?`作品设计风格：${style.name}。${style.description} 主色 ${style.accent}，背景参考 ${style.background}，辅助色 ${style.colors.join('、')}。`:'作品设计风格：清晰、克制的企业展示视觉，统一光线、材质与构图。';
 return `${userDescription}\n\n华院展项制作约定：${direction}主次分明，保留标题与正文排版的留白；同一作品保持主体、色彩与镜头语言一致。不生成文字、Logo、水印或数字，品牌标识与文字由编辑器独立排版。生成内容为概念视觉，不冒充客户真实照片，不虚构客户资质、历史或数据。`;
}
