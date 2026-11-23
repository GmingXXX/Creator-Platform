import {useEffect,useState} from 'react';
import {ImagePlus, Sparkles} from 'lucide-react';
import type {Asset,EditTarget,SceneNode,Work} from '../../domain/types';
import {Button,toast} from '../../components/ui';
import {WorkConversation} from '../conversation/WorkConversation';
import {EditorImageGenerator} from './EditorImageGenerator';
import {MaterialPicker} from '../resources/MaterialPicker';
import {selectionTarget} from './editor-session';
import {replaceNodeMaterial,replacePageBackground} from './editor-materials';

interface Props {
 work:Work;pageId:string;node?:SceneNode;selectedIds:string[];
 patchNode:(patch:Partial<SceneNode>)=>void;changeWork:(work:Work)=>void;
 onBeforeApply:()=>void;onApplied:(work:Work)=>void;
}
export function EditorAssistant({work,pageId,node,selectedIds,patchNode,changeWork,onBeforeApply,onApplied}:Props){
 const [pickerOpen,setPickerOpen]=useState(false);
 const [target,setTarget]=useState<EditTarget>(()=>selectionTarget(pageId,selectedIds));
 const selectionKey=selectedIds.join('|');
 useEffect(()=>setTarget(selectionTarget(pageId,selectedIds)),[pageId,selectionKey]);
 const mediaType=node?.type==='video'?'video':'image';
 const canReplace=(!node||node.type==='image'||node.type==='video')&&selectedIds.length<=1;
 function replace(asset:Asset){
  if(node?.locked){toast('请先解锁这个组件',true);return;}
  const next=node?replaceNodeMaterial(work,pageId,node.id,asset):replacePageBackground(work,pageId,asset);
  if(next===work){toast('无法替换此素材，请重新选择',true);return;}
  changeWork(next);setPickerOpen(false);
  toast('素材已替换，可通过撤销恢复');
 }
 return <div className="editor-assistant"><div className="editor-assistant-intro"><Sparkles size={17}/><div><strong>继续完善当前作品</strong><p>{selectedIds.length>1?'已选择多个组件，请在下方指定修改范围。':node?`已定位到「${node.name}」`:'已定位到当前页面'}</p></div></div>
  {node?.locked&&<p className="editor-assistant-notice">当前组件已锁定。解锁后可修改，或选择其他范围。</p>}
  <WorkConversation work={work} target={target} onTargetChange={setTarget} onBeforeApply={onBeforeApply} onApplied={onApplied} compact>
  {canReplace&&<div className="editor-material-picker"><Button variant="secondary" size="sm" disabled={node?.locked} onClick={()=>setPickerOpen(true)}><ImagePlus size={15}/>{node?'从素材库替换内容':'从素材库替换背景'}</Button><p>选择当前空间或社区素材，保留布局与交互。</p></div>}
  {canReplace&&mediaType==='image'&&<EditorImageGenerator key={`${work.id}:${pageId}:${node?.id||'background'}`} work={work} pageId={pageId} nodeId={node?.id} locked={node?.locked} onApply={replace}/>}
  </WorkConversation>
  <MaterialPicker open={pickerOpen} onClose={()=>setPickerOpen(false)} workspaceId={work.workspaceId||'personal'} kinds={[mediaType]} title={node?'替换组件素材':'选择页面背景'} onSelect={replace}/>
 </div>;
}
