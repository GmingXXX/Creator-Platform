import {describe,it,expect} from 'vitest';
import {nodeTypographyStyle,textRoleStyle,fontOptions,wholeTextPatch} from '../src/domain/text-style';
import type {SceneNode} from '../src/domain/types';
const node={fontSize:32,color:'#334455'} as SceneNode;
describe('shared text appearance',()=>{
 it('keeps old typography defaults unless explicitly edited',()=>{expect(nodeTypographyStyle(node)).toEqual({});expect(textRoleStyle(node,'title')).toEqual({});});
 it('uses common font properties and independent compound title/body overrides',()=>{
 const styled={...node,fontFamily:'serif',fontWeight:500,textAlign:'center' as const,lineHeight:1.6,titleStyle:{fontSize:48,fontWeight:700},bodyStyle:{fontFamily:'monospace',color:'#ffffff'}};
 expect(nodeTypographyStyle(styled)).toMatchObject({fontFamily:'serif',fontWeight:500,textAlign:'center',lineHeight:1.6});
 expect(textRoleStyle(styled,'title')).toMatchObject({fontSize:48,fontWeight:700,fontFamily:'serif'});
 expect(textRoleStyle(styled,'body')).toMatchObject({fontFamily:'monospace',color:'#ffffff',fontWeight:500});
 expect(styled.fontFamily).toBe('serif');
 });
 it('applies whole compound size to visible title and body without changing input',()=>{
 const compound={...node,type:'card' as const,items:[{id:'item',title:'标题',description:'内容'}],titleStyle:{fontWeight:700}};
 const patch=wholeTextPatch(compound,{fontSize:42,color:'#123456'});
 expect(textRoleStyle({...compound,...patch},'title')).toMatchObject({fontSize:42,color:'#123456',fontWeight:700});
 expect(textRoleStyle({...compound,...patch},'body')).toMatchObject({fontSize:42,color:'#123456'});
 expect(compound.titleStyle).toEqual({fontWeight:700});
 });
 it('ignores invalid style values and only offers local fallback font stacks',()=>{
 expect(nodeTypographyStyle({...node,fontWeight:NaN,lineHeight:-1,textAlign:'evil' as never})).toEqual({});
 expect(fontOptions.every(option=>option.label&&option.value!==undefined)).toBe(true);
 });
});
