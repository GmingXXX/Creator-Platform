import type {Work} from '../../domain/types';

export function deletePageSelection(work:Work,pageId:string,ids:readonly string[]):Work {
 const page=work.pages.find(item=>item.id===pageId);
 if(!page)return work;
 const nodes=page.nodes.filter(node=>node.locked||!ids.includes(node.id));
 if(nodes.length===page.nodes.length)return work;
 return {...work,pages:work.pages.map(item=>item.id===pageId?{...item,nodes}:item)};
}

/** The layer list is front-to-back, while scene nodes are stored back-to-front. */
export function reorderPageLayer(work:Work,pageId:string,sourceId:string,targetId:string,position:'above'|'below'):Work {
 const page=work.pages.find(item=>item.id===pageId);
 const source=page?.nodes.find(node=>node.id===sourceId);
 if(!page||!source||source.locked||sourceId===targetId||!page.nodes.some(node=>node.id===targetId))return work;
 const remaining=page.nodes.filter(node=>node.id!==sourceId);
 const insertion=remaining.findIndex(node=>node.id===targetId)+(position==='above'?1:0);
 const nodes=[...remaining.slice(0,insertion),source,...remaining.slice(insertion)];
 if(nodes.every((node,index)=>node===page.nodes[index]))return work;
 return {...work,pages:work.pages.map(item=>item.id===pageId?{...item,nodes}:item)};
}
