import type {Asset,StudioData} from './types';
import type {ComponentField} from './component-import';
import timelineHtml from '../../public/components-catalog/milestone-timeline/index.html?raw';
import cardHtml from '../../public/components-catalog/floating-card/index.html?raw';
import timelineManifest from '../../public/components-catalog/milestone-timeline/component.json';
import cardManifest from '../../public/components-catalog/floating-card/component.json';

const entries=[
 {slug:'milestone-timeline',manifest:timelineManifest,html:timelineHtml,author:'shadcnspace',url:'https://21st.dev/@shadcnspace/components/timeline-02',description:'选择年份查看企业里程碑，支持键盘切换；开放展项名称、事件内容、图片和主题色。'},
 {slug:'floating-card',manifest:cardManifest,html:cardHtml,author:'n38693842',url:'https://21st.dev/@n38693842/components/3d-card',description:'指针移动产生立体悬浮效果，点击探索成果查看详情；开放标题、说明、图片、主题色与动效开关。'},
];
/** Runtime, package and screenshot are generated from the same catalog document. */
export const catalogComponents:Asset[]=entries.map(entry=>{
 const path=`/components-catalog/${entry.slug}`,fields=entry.manifest.fields as ComponentField[];
 return {
  id:`catalog-21st-${entry.slug}`,kind:'component',componentType:'html',name:entry.manifest.name,
  src:`${path}/index.html`,preview:`${path}/preview.png`,description:entry.description,
  tags:['21st 适配','可试编辑','自包含组件'],author:entry.author,createdAt:'2026-11-16T00:00:00.000Z',source:'community',public:true,
  componentImport:{filename:`${entry.slug}.zip`,source:'package',fields,values:Object.fromEntries(fields.map(field=>[field.key,field.default])),checks:[],runtime:'parameters-connected',offline:'unverified',checkedAt:'2026-11-16T00:00:00.000Z'},
  package:{id:`package-21st-${entry.slug}`,version:'1.0',prompt:entry.description,skillIds:[],complete:true,params:{sourceUrl:entry.url,catalogSlug:entry.slug,adaptation:'真实源码适配为自包含 HTML；参数通过智创编辑接口更新。',packageUrl:`${path}/component.zip`},files:[
   {name:'index.html',type:'html',src:`${path}/index.html`,content:entry.html},
   {name:'component.json',type:'config',content:JSON.stringify(entry.manifest)},
   {name:'source.json',type:'config',src:`${path}/source.json`},
   {name:'upstream.tsx',type:'source',src:`${path}/upstream.tsx`},
   {name:'upstream-demo.tsx',type:'source',src:`${path}/upstream-demo.tsx`},
   {name:'README.md',type:'document',src:`${path}/README.md`},
   {name:'preview.png',type:'image',src:`${path}/preview.png`},
  ]},
 };
});

/** Preserve existing/deleted versions: catalog updates never overwrite personal state. */
export function migrateCatalogComponents<T extends StudioData>(data:T):T {
 const added=catalogComponents.filter(asset=>!data.assets.some(existing=>existing.id===asset.id));
 return added.length?{...data,assets:[...data.assets,...structuredClone(added)]}:data;
}
