import type {Asset,Template,Work} from '../../domain/types';
import {assetAvailableForInsertion} from '../../domain/asset-access';
import {assetSearchText} from '../../domain/asset-metadata';
import {materialNodeKind} from '../editor/editor-materials';
export interface ReferenceSourceChoice {value:string;kind:'work'|'template';id:string;title:string;work:Work}
export const referenceKindLabel=(work:Work)=>({exhibit:'交互页面',presentation:'智能演示',story:'互动影片',video:'视频分镜'}[work.kind]);
export function referenceSourceChoices(works:Work[],templates:Template[],workspaceId:string):ReferenceSourceChoice[]{
 return [...works.filter(work=>!work.deletedAt&&(work.workspaceId||'personal')===workspaceId).map(work=>({value:`work:${work.id}`,kind:'work' as const,id:work.id,title:work.title,work})),...templates.filter(template=>!template.work.deletedAt).map(template=>({value:`template:${template.id}`,kind:'template' as const,id:template.id,title:template.title,work:template.work}))];
}
export function visibleReferenceChoices(choices:ReferenceSourceChoice[],search:string,selected:string):ReferenceSourceChoice[]{
 const query=search.trim().toLowerCase();
 return choices.filter(choice=>choice.value===selected||`${choice.title} ${referenceKindLabel(choice.work)} ${choice.kind==='work'?'当前空间':'社区模板'}`.toLowerCase().includes(query));
}
export function editorMaterialChoices(assets:Asset[],workspaceId:string,source:'space'|'community',search:string):Asset[]{
 return assets.filter(asset=>assetAvailableForInsertion(asset,workspaceId)&&materialNodeKind(asset)&&
  (source==='community'?asset.public:!asset.public&&(asset.workspaceId?asset.workspaceId===workspaceId:asset.source!=='builtin'&&workspaceId==='personal'))&&
  assetSearchText(asset).toLowerCase().includes(search.trim().toLowerCase()));
}
