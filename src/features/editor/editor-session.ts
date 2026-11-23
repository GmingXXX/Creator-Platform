import type {EditTarget, Work} from '../../domain/types';

export interface EditorView {
  pageId:string;
  selected:string[];
  zoom:number;
  pan:{x:number;y:number};
  tab:string;
}
const tabs=['属性','交互','动效','命令','AI'];
const finite=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
export function normalizeEditorView(work:Work, raw:unknown):EditorView {
  const value=raw&&typeof raw==='object'?raw as Partial<EditorView>:{};
  const page=work.pages.find(item=>item.id===value.pageId)||work.pages[0];
  return {pageId:page.id,selected:Array.isArray(value.selected)?value.selected.filter(id=>page.nodes.some(node=>node.id===id)):[],zoom:Math.max(.04,Math.min(2,finite(value.zoom,.4))),pan:{x:finite(value.pan?.x,0),y:finite(value.pan?.y,0)},tab:tabs.includes(value.tab||'')?value.tab!:'属性'};
}
export function readEditorView(work:Work):EditorView|undefined {
  try {const raw=sessionStorage.getItem(`zc-editor-view-${work.id}`);return raw?normalizeEditorView(work,JSON.parse(raw)):undefined;}catch{return undefined;}
}
export function writeEditorView(workId:string,view:EditorView):void {
  try {sessionStorage.setItem(`zc-editor-view-${workId}`,JSON.stringify(view));}catch{/* Editing remains usable when session storage is unavailable. */}
}
export function selectionTarget(pageId:string,selected:string[]):EditTarget {
  return selected.length===1?{scope:'node',pageId,nodeId:selected[0]}:{scope:'page',pageId};
}
export function sameWorkContent(a:Work,b:Work):boolean {
  const {revision:_aRevision,updatedAt:_aUpdated,...aContent}=a;
  const {revision:_bRevision,updatedAt:_bUpdated,...bContent}=b;
  return JSON.stringify(aContent)===JSON.stringify(bContent);
}
