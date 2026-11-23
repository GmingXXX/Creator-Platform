import {Field,Tabs} from '../../components/ui';
import {resolutions} from '../../domain/fixtures';
import type {Work} from '../../domain/types';

export type NewAssetProject = {title:string;resolution:string;width:number;height:number};
export function AssetInsertTarget({destination,onDestination,works,target,onTarget,project,onProject,error}:{
 destination:'existing'|'new';onDestination:(value:'existing'|'new')=>void;
 works:Work[];target:string;onTarget:(value:string)=>void;
 project:NewAssetProject;onProject:(value:NewAssetProject)=>void;error:string;
}) {
 return <div className="res-form">
  <h3>选择要添加到的作品</h3>
  <Tabs value={destination} onChange={onDestination} items={[{value:'existing',label:'已有作品'},{value:'new',label:'新建交互页面'}]}/>
  {destination==='existing'?<>
   <p className="res-muted">添加到所选作品的第一个页面，进入画布后可以继续调整。</p>
   <select aria-label="目标展项" value={target} onChange={event=>onTarget(event.target.value)}><option value="">请选择作品</option>{works.map(work=><option key={work.id} value={work.id}>{work.title}</option>)}</select>
   {!works.length&&<p className="res-muted">当前空间还没有交互页面，可切换到“新建交互页面”直接创建并插入。</p>}
  </>:<>
   <p className="res-muted">在当前空间创建交互页面，并将此素材直接放入新画布。</p>
   <Field label="作品名称"><input maxLength={60} value={project.title} onChange={event=>onProject({...project,title:event.target.value})}/></Field>
   <Field label="屏幕分辨率"><select aria-label="屏幕分辨率" value={project.resolution} onChange={event=>onProject({...project,resolution:event.target.value})}>{resolutions.map(item=><option key={item.label} value={`${item.width}×${item.height}`}>{item.width}×{item.height} · {item.label}</option>)}<option value="custom">自定义尺寸</option></select></Field>
   {project.resolution==='custom'&&<div className="form-grid"><Field label="宽度 px"><input type="number" min={320} max={16384} value={project.width} onChange={event=>onProject({...project,width:Number(event.target.value)})}/></Field><Field label="高度 px"><input type="number" min={320} max={16384} value={project.height} onChange={event=>onProject({...project,height:Number(event.target.value)})}/></Field></div>}
  </>}
  {error&&<p className="res-error" role="alert">{error}</p>}
 </div>;
}
