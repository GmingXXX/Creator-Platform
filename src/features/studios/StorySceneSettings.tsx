import {useState} from 'react';
import {Image as ImageIcon,Film,Code2} from 'lucide-react';
import {Button} from '../../components/ui';
import {useStudio} from '../../domain/store';
import type {StoryNode,Work} from '../../domain/types';
import {MaterialPicker} from '../resources/MaterialPicker';
import {storyMediaKind} from './creationLogic';
import {StorySoundSettings} from './StorySound';
import {StudioImage} from './StudioShared';

type Props={node:StoryNode;work:Work;disabled:boolean;onChange:(patch:Partial<StoryNode>)=>void};
export function StorySceneSettings({node,work,disabled,onChange}:Props){
  const assets=useStudio(s=>s.assets),[picker,setPicker]=useState(false);
  const kind=storyMediaKind(node,assets),workspaceId=work.workspaceId||'personal';
  const media=assets.find(a=>a.id===node.mediaAssetId);
  const Icon=kind==='html'?Code2:kind==='video'?Film:ImageIcon;
  return <>
    <details className="story-sound-settings"><summary>场景背景</summary>
      <div className="story-scene-media">{node.media&&(kind==='image'?<StudioImage src={node.media} alt="场景画面"/>:<Icon size={22}/>)}
        <span>{media?.name||(node.media?{image:'背景图片',html:'HTML 交互画面',video:'背景视频'}[kind]:'未设置背景素材')}</span>
      </div>
      <div className="story-sound-actions"><Button size="sm" disabled={disabled} onClick={()=>setPicker(true)}>{node.media?'更换场景背景':'选择场景背景'}</Button>
      {node.media&&<Button size="sm" disabled={disabled} onClick={()=>onChange({media:undefined,mediaAssetId:undefined})}>移除背景</Button>}</div>
      <label>背景概述<textarea maxLength={1000} rows={2} disabled={disabled} placeholder="描述生成背景时应保留的场景特征" value={node.backgroundBrief||''} onChange={e=>onChange({backgroundBrief:e.target.value})}/></label>
    </details>
    <StorySoundSettings sound={node.sound} projectMusic={work.storyMusic} isVideo={kind==='video'} workspaceId={workspaceId} disabled={disabled} onChange={sound=>onChange({sound})}/>
    <MaterialPicker open={picker} onClose={()=>setPicker(false)} workspaceId={workspaceId} kinds={['image','video','html']} title="选择故事画面" onSelect={a=>onChange({media:a.src,mediaAssetId:a.id})}/>
  </>;
}
