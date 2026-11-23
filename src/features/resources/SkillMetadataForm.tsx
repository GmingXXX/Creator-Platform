import type {Skill} from '../../domain/types';
import {getSkillMetadata} from '../../domain/skill-metadata';
import '../../styles/skill-metadata.css';

export function prepareSkillForm(skill:Skill):Skill {
 const metadata=getSkillMetadata(skill),clean=(values:string[])=>values.map(value=>value.trim()).filter(Boolean);
 return {...skill,name:skill.name.trim(),description:skill.description.trim(),input:skill.input.trim(),version:skill.version.trim(),author:skill.author.trim(),category:skill.category.trim(),steps:clean(skill.steps),metadata:{...metadata,tags:clean(metadata.tags),checks:clean(metadata.checks),dependencies:clean(metadata.dependencies)}};
}

interface Props {skill:Skill;onChange:(skill:Skill)=>void;experience?:boolean}
export function SkillMetadataForm({skill,onChange,experience=false}:Props){
 const meta=getSkillMetadata(skill);
 const patch=(changes:Partial<Skill>)=>onChange({...skill,...changes});
 const patchMeta=(changes:Partial<typeof meta>)=>patch({metadata:{...meta,...changes}});
 const field=(label:string,value:string,change:(value:string)=>void,options:{area?:boolean;max?:number;readOnly?:boolean}={})=><label>{label}{options.area?<textarea aria-label={label} rows={3} value={value} maxLength={options.max||5000} onChange={event=>change(event.target.value)}/>:<input aria-label={label} value={value} readOnly={options.readOnly} maxLength={options.max||200} onChange={event=>change(event.target.value)}/>}</label>;
 return <div className="skill-metadata-form">
  <fieldset><legend>基本元信息</legend>
   {field(experience?'方法名称':'名称',skill.name,value=>patch({name:value}),{max:80})}
   {field('唯一标识',skill.id,()=>{}, {readOnly:true})}
   {field(experience?'方法说明':'技能说明',skill.description,value=>patch({description:value}),{area:true})}
   <div className="skill-metadata-row">{field('版本',skill.version,value=>patch({version:value}),{max:30})}{field('作者',skill.author,value=>patch({author:value}),{max:80})}</div>
   <div className="skill-metadata-row">{field('分类',skill.category,value=>patch({category:value}),{max:40})}{field('图标',meta.icon,value=>patchMeta({icon:value}),{max:16})}</div>
   {field('标签',meta.tags.join(','),value=>patchMeta({tags:value.split(/[，,]/)}),{max:500})}<small>标签用逗号分隔；图标可填写简短符号或表情。</small>
  </fieldset>
  <fieldset><legend>用途与执行约定</legend>
   {field('用途说明',meta.purpose,value=>patchMeta({purpose:value}),{area:true})}
   {field('适用场景',meta.scenarios,value=>patchMeta({scenarios:value}),{area:true})}
   {field('不适用条件',meta.exclusions,value=>patchMeta({exclusions:value}),{area:true})}
   {field(experience?'所需资料':'需要提供',skill.input,value=>patch({input:value}),{area:true,max:2000})}
   {field(experience?'制作步骤':'技能执行步骤',skill.steps.join('\n'),value=>patch({steps:value.split('\n')}),{area:true,max:30000})}
   {field('预期输出',meta.output,value=>patchMeta({output:value}),{area:true})}
   {field('检查标准',meta.checks.join('\n'),value=>patchMeta({checks:value.split('\n')}),{area:true})}
  </fieldset>
  <details><summary>依赖与权限</summary><fieldset>
   {field('外部工具或服务',meta.dependencies.join('\n'),value=>patchMeta({dependencies:value.split('\n')}),{area:true})}
   {field('访问的数据或资源',meta.permissions.resources,value=>patchMeta({permissions:{...meta.permissions,resources:value}}),{area:true})}
   <div className="skill-metadata-row"><label>读写操作<select aria-label="读写操作" value={meta.permissions.operations} onChange={event=>patchMeta({permissions:{...meta.permissions,operations:event.target.value as typeof meta.permissions.operations}})}><option value="none">无外部操作</option><option value="read">读取</option><option value="write">写入</option><option value="read-write">读取与写入</option></select></label><label>用户授权要求<select aria-label="用户授权要求" value={meta.permissions.authorization} onChange={event=>patchMeta({permissions:{...meta.permissions,authorization:event.target.value as typeof meta.permissions.authorization}})}><option value="none">无需额外授权</option><option value="required">需要用户授权</option></select></label></div>
   <p>这里只声明执行所需权限，不代表已获得授权。实际任务仍按项目空间与外部服务权限检查。</p>
  </fieldset></details>
  <details><summary>示例与验证</summary><fieldset>
   {field('使用示例',meta.examples,value=>patchMeta({examples:value}),{area:true})}
   <label>验证状态<select aria-label="验证状态" value={meta.validation} onChange={event=>patchMeta({validation:event.target.value as typeof meta.validation})}><option value="unverified">尚未验证</option><option value="reviewed">已人工检查</option><option value="tested">已实际测试</option></select></label>
   {field('已知限制',meta.limitations,value=>patchMeta({limitations:value}),{area:true})}
   {meta.provenance&&<p>来源制作经验：v{meta.provenance.experienceVersion}。共享前请检查示例和方法说明中的客户专属内容。</p>}
  </fieldset></details>
  <details><summary>管理信息</summary><fieldset>
   {field('维护者',meta.maintainer,value=>patchMeta({maintainer:value}),{max:80})}
   <label>可见范围<select aria-label="可见范围" disabled={meta.visibility==='restricted'} value={meta.visibility} onChange={event=>patchMeta({visibility:event.target.value as typeof meta.visibility})}><option value="private">仅本人</option><option value="team">团队可用</option>{meta.visibility==='restricted'&&<option value="restricted">保留原成员访问范围</option>}</select></label>
   {meta.visibility==='restricted'&&<p>此技能保留原项目空间成员的可见范围。统一目录不会扩大原有成员的访问范围。</p>}
   <p>{skill.enabled===false?'当前为未启用草稿；保存后可在技能详情启用。':'当前已启用；本次保存不改变启停状态。'}</p>
  </fieldset></details>
 </div>;
}

export function SkillMetadataDetails({skill}:{skill:Skill}){
 const meta=getSkillMetadata(skill),show=(value:string)=>value.trim()||'未填写';
 const rows=[['唯一标识',skill.id],['标签',meta.tags.filter(Boolean).join('、')],['图标',meta.icon],['用途说明',meta.purpose],['适用场景',meta.scenarios],['不适用条件',meta.exclusions],['预期输出',meta.output],['检查标准',meta.checks.filter(Boolean).join('\n')],['外部工具或服务',meta.dependencies.filter(Boolean).join('\n')||'无'],['访问的数据或资源',meta.permissions.resources],['读写操作',({none:'无外部操作',read:'读取',write:'写入','read-write':'读取与写入'})[meta.permissions.operations]],['用户授权要求',meta.permissions.authorization==='required'?'需要用户授权':'无需额外授权'],['使用示例',meta.examples],['验证状态',({unverified:'尚未验证',reviewed:'已人工检查',tested:'已实际测试'})[meta.validation]],['已知限制',meta.limitations],['维护者',meta.maintainer],['可见范围',skill.public?'共创社区公开':({private:'仅本人',team:'团队可用',restricted:'原成员访问范围'})[meta.visibility]]];
 return <div className="skill-metadata-details"><h4>技能元信息</h4><dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{show(value)}</dd></div>)}</dl>{meta.provenance&&<p className="res-muted">来源制作经验版本：v{meta.provenance.experienceVersion}</p>}</div>;
}
