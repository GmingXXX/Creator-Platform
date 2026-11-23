import {describe,it,expect} from 'vitest';
import {catalogComponents,migrateCatalogComponents} from '../src/domain/catalog-components';
import {createInitialData} from '../src/domain/fixtures';
import {readFile} from 'node:fs/promises';
import {inspectComponentFile,applyComponentValues} from '../src/domain/component-import';
describe('21st adapted component catalog',()=>{
 it('ships two actual editable packages with matching covers and source records',()=>{
  expect(catalogComponents).toHaveLength(2);
  for(const asset of catalogComponents){
   expect(asset.kind).toBe('component');
   expect(asset.componentType).toBe('html');
   expect(asset.componentImport?.fields.length).toBeGreaterThan(2);
   expect(asset.package?.params.sourceUrl).toMatch(/^https:\/\/21st.dev\//);
   expect(asset.package?.files.some(f=>f.name==='index.html'&&f.content?.includes('ZhichuangComponent'))).toBe(true);
   expect(asset.preview).toMatch(/components-catalog\/.+\/preview.png$/);
  }
 });
 it('adds by stable identity without resetting personal changes or deleted assets',()=>{
  const original=createInitialData();
  const first=migrateCatalogComponents(original);
  expect(first.assets.filter(a=>a.id.startsWith('catalog-21st-'))).toHaveLength(2);
  const changed={...first,assets:first.assets.map(a=>a.id===catalogComponents[0].id?{...a,name:'我的名称',deletedAt:'now'}:a)};
  const twice=migrateCatalogComponents(changed);
  expect(twice.assets.find(a=>a.id===catalogComponents[0].id)).toMatchObject({name:'我的名称',deletedAt:'now'});
  expect(twice.assets).toHaveLength(first.assets.length);
 });
 it('inspects the actual self-contained ZIPs and accepts editable values',async()=>{
  for(const asset of catalogComponents){
   const bytes=await readFile(`public/components-catalog/${asset.package!.params.catalogSlug}/component.zip`);
   const file=new File([bytes],`${asset.name}.zip`,{type:'application/zip'});
   const inspected=await inspectComponentFile(file);
   expect(inspected?.canPreview).toBe(true);
   expect(inspected?.dependencies).toHaveLength(0);
   const field=inspected!.fields[0];
   const applied=applyComponentValues(inspected!.html,inspected!.fields,{...inspected!.defaults,[field.key]:'修改后的标题'});
   expect(applied).toContain('修改后的标题');
   expect(applied).toContain('zhichuang-component-sdk');
  }
 });
});
