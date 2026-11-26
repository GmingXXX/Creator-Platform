import type {CSSProperties} from 'react';
import type {DesignSystem} from '../../domain/types';
import {resolveFontFamily} from '../../domain/text-style';
export function storyScenePaint(system:DesignSystem|undefined,hasMedia:boolean,showCaption:boolean):CSSProperties {
 return {
  fontFamily:resolveFontFamily(system?.font),
  color:system?.text||'#edf3fa',
  backgroundColor:!hasMedia&&system?.background?system.background:'#17202c',
  backgroundImage:!hasMedia&&!system?'radial-gradient(ellipse at 80% 20%, #2d5068, transparent 70%), linear-gradient(120deg,#15202b,#213648)':undefined,
  '--story-media-overlay':showCaption?'linear-gradient(90deg,#111c2da3,#111c2d14)':'transparent',
 } as CSSProperties;
}
