import type {SceneNode,Work} from '../../domain/types';
export const presentationTemplates=[
 {id:'editorial',name:'简洁图文',description:'清晰标题、舒展正文与右侧主视觉',styleId:'finance'},
 {id:'chapter',name:'章节叙事',description:'大号章节标题，适合故事与主题讲述',styleId:'culture'},
 {id:'briefing',name:'企业汇报',description:'紧凑层级、分栏要点与底部图像',styleId:'industrial'},
] as const;
export function applyPresentationTemplate(work:Work,templateId:string):Work{
 if(!templateId)return work;
 if(!presentationTemplates.some(template=>template.id===templateId))throw new Error('所选演示模板不存在');
 const {width:w,height:h}=work;
 const pages=work.pages.map(page=>{
  const body=page.nodes.filter(node=>node.name.startsWith('正文要点'));
  const media=page.nodes.some(node=>node.type==='image');
  const nodes=page.nodes.map((node):SceneNode=>{
   if(node.name==='主标题')return {...node,x:w*.08,y:h*(templateId==='chapter'?.23:.14),w:w*.84,h:h*.14,fontSize:Math.min(w/1920,h/1080)*(templateId==='chapter'?82:62)};
   const i=body.findIndex(item=>item.id===node.id);
   if(i>=0){
    if(templateId==='briefing')return {...node,x:w*(.08+(i%2)*.46),y:h*(.34+Math.floor(i/2)*.16),w:w*.4,h:h*.13};
    return {...node,x:w*.08,y:h*((templateId==='chapter'?.44:.35)+i*.45/Math.max(body.length,1)),w:w*(media?.45:.84),h:h*.42/Math.max(body.length,1)};
   }
   if(node.type==='image')return {...node,x:w*(templateId==='briefing'?.08:.59),y:h*(templateId==='briefing'?.78:.39),w:w*(templateId==='briefing'?.84:.33),h:h*(templateId==='briefing'?.12:.43)};
   return {...node};
  });
  return {...page,nodes};
 });
 return {...work,pages,creationPackage:work.creationPackage?{...work.creationPackage,params:{...work.creationPackage.params,templateId}}:undefined};
}
