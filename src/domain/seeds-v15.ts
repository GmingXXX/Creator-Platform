import type {Skill,StudioData,Template,WorkKind} from './types';
import {createSceneWork} from './scenes';
const skillExamples:[string,string,Skill['previewType'],string][]=[
 ['企业大事记编排','从资料提取年份与事件，组织时间轴和详情。','timeline','企业年份、事件和图片'],
 ['荣誉资质墙','按资质、荣誉、专利分类，编排可筛选的荣誉墙。','gallery','证书图片、名称、年份及分类'],
 ['产业分布地图','整理城市、业务与项目案例，编排地图热点。','map','城市位置、业务介绍及案例'],
 ['品牌科技背景','生成有留白的品牌背景，适配目标屏幕。','image','品牌色、行业主题及屏幕尺寸'],
 ['演示讲稿组织','将资料组织为章节、页面与逐页讲稿。','text','主题资料、受众和讲解时长'],
 ['互动影片分支规划','设计开场、选择分支与结局，检查故事路径。','flow','故事主题、人物、分支目标'],
];
function skills():Skill[]{return skillExamples.map(([name,description,previewType,input],i)=>({
 id:`skill-v15-preset-${i+1}`,workspaceId:'personal',source:'builtin',personal:true,public:false,name,description,input,
 category:i===3?'图片生成':i===4?'内容策划':i===5?'互动影片':'展项编排',styleId:['industrial','government','technology','technology','culture','technology'][i],
 previewType,author:'智创团队',version:'1.0',revision:1,steps:['读取输入资料并确认内容目标',description,'生成可编辑结构并检查内容完整性'],
}));}
const examples:[string,WorkKind,string,string,string][]=[
 ['企业创新成果演示','presentation','government','企业成果','成果总览、核心技术、应用案例'],
 ['金融论坛趋势讲解','video','finance','行业趋势','全球趋势、市场变化、未来展望'],
 ['城市更新宣传短片','video','culture','城市更新','城市记忆、公共空间、未来生活'],
 ['未来工厂互动探索','story','industrial','工业探索','智能制造、绿色能源、未来工厂'],
 ['博物馆文物探秘','story','culture','文物探秘','发现文物、解读纹饰、追溯年代'],
 ['AI 小镇的一天','story','technology','智慧生活','智慧出行、智能服务、低碳生活'],
];
function templates():Template[]{return examples.map(([title,kind,styleId,tag,chapters],i)=>{
 const work=createSceneWork({title,kind,type:'媒体叙事型',width:1920,height:1080,styleId});
 const names=chapters.split('、');
 return {id:`template-v15-${i+1}`,title,type:work.type,author:'智创团队',tags:['模拟案例',tag],likes:36+i*7,uses:52+i*11,
  work:{...work,id:`work-template-v15-${i+1}`,projectId:`project-template-v15-${i+1}`,
   pages:work.pages.map((page,index)=>({...page,name:names[index%names.length],notes:`${title}：围绕${names[index%names.length]}介绍背景、重点内容与应用价值。`})),
   ...(work.shots?{shots:work.shots.map((shot,index)=>({...shot,title:names[index%names.length],narration:`${title}，这一幕展示${names[index%names.length]}，让观众理解主题与实际价值。`}))}:{}),
   ...(work.storyNodes?{storyNodes:work.storyNodes.map((node,index)=>({...node,title:node.type==='start'?title:node.type==='end'||node.type==='ending'?'探索完成':names[index%names.length],text:node.type==='choice'?`选择你希望进一步了解的${tag}主题。`:`走进${names[index%names.length]}，发现${tag}背后的故事。`}))}:{}),
  }};
});}
/** Version gate preserves deletion; ID checks preserve edited examples during the first migration. */
export function migrateResourcesV15<T extends StudioData>(data:T):T {
 if(data.sharingSchemaVersion===1)return data;
 const append=<I extends {id:string}>(existing:I[],added:I[])=>[...existing,...added.filter(item=>!existing.some(old=>old.id===item.id))];
 return {...data,sharingSchemaVersion:1,skills:append(data.skills.map(skill=>({...skill,workspaceId:skill.workspaceId||'personal',source:skill.source||(skill.origin?'community':'uploaded')})),skills()),
  templates:append(data.templates,templates()),drafts:data.drafts.map(draft=>({...draft,model:['deepseek-flash','deepseek-v4-pro','demo'].includes(draft.model)?draft.model:'deepseek-flash'}))};
}
