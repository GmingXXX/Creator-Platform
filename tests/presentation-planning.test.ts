import {describe,it,expect} from 'vitest';
import {suggestTopic,planCount,estimateMinutes,copySlide,arrangeSlide} from '../src/features/studios/presentation-planning';
import {makePresentationPages} from '../src/features/studios/studioLogic';
describe('资料与页数',()=>{
 it('去掉 PPT 页码并使用正文主题',()=>expect(suggestTopic('[第 1 页]\n企业技术路线\n核心材料')).toBe('企业技术路线'));
 it('支持 40 页并按内容估时',()=>{expect(planCount(40,'')).toBe(40);expect(estimateMinutes(['文'.repeat(600)])).toBeGreaterThan(estimateMinutes(['短句']));});
 it('改版保留元素标识与复制映射',()=>{const p=makePresentationPages('企业','industrial')[0];const a=arrangeSlide(p,1200,800,'上图下文');expect(a.nodes.map(n=>n.id)).toEqual(p.nodes.map(n=>n.id));const copy=copySlide(p,{sentences:[],transition:'fade',hotspots:[]});expect(copy.page.id).not.toBe(p.id);expect(copy.settings.transition).toBe('fade');});
});
