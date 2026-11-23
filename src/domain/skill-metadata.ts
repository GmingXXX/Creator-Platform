import type {Skill} from './types';
export interface SkillMetadata {
 tags:string[];icon:string;purpose:string;scenarios:string;exclusions:string;output:string;checks:string[];dependencies:string[];
 permissions:{resources:string;operations:'none'|'read'|'write'|'read-write';authorization:'none'|'required'};
 examples:string;validation:'unverified'|'reviewed'|'tested';limitations:string;maintainer:string;
 visibility:'private'|'team'|'restricted';ownerAccount:string;allowedWorkspaceIds:string[];
 provenance?:{workId:string;workTitle:string;experienceVersion:number};
}
export function getSkillMetadata(skill:Skill):SkillMetadata {
 const legacySpace=skill.workspaceId&&skill.workspaceId!=='personal'?skill.workspaceId:undefined;
 const defaults:SkillMetadata={tags:[],icon:'✦',purpose:skill.description,scenarios:'',exclusions:'',output:'',checks:[],dependencies:[],permissions:{resources:'无',operations:'none',authorization:'none'},examples:'',validation:'unverified',limitations:'',maintainer:skill.author||'纪鸣',visibility:legacySpace?'restricted':skill.source==='builtin'?'team':'private',ownerAccount:skill.public?'public':'jiming',allowedWorkspaceIds:legacySpace?[legacySpace]:[]};
 return {...defaults,...skill.metadata,permissions:{...defaults.permissions,...skill.metadata?.permissions}};
}
export function createSkillDraft(options:{author?:string;ownerAccount?:string}={}):Skill {
 const skill:Skill={id:`skill-${crypto.randomUUID()}`,name:'',description:'',version:'0.1.0',author:options.author||'纪鸣',category:'制作方法',input:'',steps:[],styleId:'',previewType:'card',personal:true,public:false,enabled:false,workspaceId:'personal',source:'uploaded',revision:1};
 return {...skill,metadata:{...getSkillMetadata(skill),ownerAccount:options.ownerAccount||'jiming'}};
}
const validText=(value:unknown,max:number,required=false):value is string=>typeof value==='string'&&value.length<=max&&(!required||Boolean(value.trim()))&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
export function validateSkillMetadata(skill:Skill,allowIncomplete=false):void {
 if(!validText(skill.id,200,true)||!validText(skill.name,80,!allowIncomplete)||!validText(skill.description,5000,!allowIncomplete)||!validText(skill.author,100,true)||!validText(skill.input,2000,!allowIncomplete))throw new Error('请填写有效的名称、描述、作者和所需资料。');
 if(!/^\d+(?:\.\d+){0,2}(?:-[\w.-]+)?$/.test(skill.version)||skill.version.length>30)throw new Error('版本格式应为 0.1.0 或 1.0 等数字版本。');
 const m=getSkillMetadata(skill);
 for(const [label,list,max] of [['制作步骤',skill.steps,30],['标签',m.tags,20],['检查标准',m.checks,30],['依赖',m.dependencies,30],['授权范围',m.allowedWorkspaceIds,100]] as const){if(!Array.isArray(list)||list.length>max||list.some(value=>!validText(value,1000,true)))throw new Error(`${label}格式无效或过长。`);}
 if(!allowIncomplete&&!skill.steps.length)throw new Error('请填写至少一项制作步骤。');
 if(![m.purpose,m.scenarios,m.exclusions,m.output,m.examples,m.limitations].every(value=>validText(value,5000))||!validText(m.icon,16,true)||!validText(m.maintainer,100,true)||!validText(m.ownerAccount,100,true))throw new Error('技能元信息格式无效或过长。');
 if(!['private','team','restricted'].includes(m.visibility)||!['unverified','reviewed','tested'].includes(m.validation)||!['none','read','write','read-write'].includes(m.permissions.operations)||!['none','required'].includes(m.permissions.authorization))throw new Error('技能可见范围或权限声明无效。');
 if(!validText(m.permissions.resources,2000,true))throw new Error('请填写所需资源；无外部资源时填写“无”。');
 if(m.visibility==='restricted'&&!m.allowedWorkspaceIds.length)throw new Error('请保留至少一项原有访问范围。');
 if(m.provenance&&(!validText(m.provenance.workId,200,true)||!validText(m.provenance.workTitle,200,true)||!Number.isInteger(m.provenance.experienceVersion)||m.provenance.experienceVersion<1))throw new Error('来源经验记录无效。');
}
export function serializeSkillInstructions(skill:Skill):string {
 const m=getSkillMetadata(skill),list=(items:string[])=>items.map((text,index)=>`${index+1}. ${text}`).join('\n')||'无';
 return `<!-- studio-definition:start -->\n# ${skill.name}\n\n${skill.description}\n\n## 用途与适用场景\n${m.purpose}\n${m.scenarios||'待补充'}\n\n## 不适用条件\n${m.exclusions||'待补充'}\n\n## 输入\n${skill.input}\n\n## 制作步骤\n${list(skill.steps)}\n\n## 预期输出\n${m.output||'待补充'}\n\n## 检查标准\n${list(m.checks)}\n\n## 依赖与权限声明\n${list(m.dependencies)}\n所需资源：${m.permissions.resources}\n操作范围：${m.permissions.operations}\n需要授权：${m.permissions.authorization==='required'?'是':'否'}（声明不等于已授权）\n\n## 示例\n${m.examples||'待补充'}\n\n## 验证与限制\n验证状态：${m.validation}\n${m.limitations||'尚未补充验证依据'}\n<!-- studio-definition:end -->`;
}
export function syncSkillPackage(skill:Skill):Skill {
 validateSkillMetadata(skill);
 const old=skill.sourcePackage,extra=(old?.instructions||'').replace(/<!-- studio-definition:start -->[\s\S]*?<!-- studio-definition:end -->\s*/g,'').replace(/^## 原始包补充说明（与当前定义冲突时以当前定义为准）\s*/,'').trim();
 const instructions=serializeSkillInstructions(skill)+(extra?`\n\n## 原始包补充说明（与当前定义冲突时以当前定义为准）\n${extra}`:'');
 const entry=old?.entry||'SKILL.md';
 const file={path:entry,size:new TextEncoder().encode(instructions).length,mime:'text/markdown',content:instructions};
 return {...skill,metadata:getSkillMetadata(skill),sourcePackage:{filename:old?.filename||`${skill.name}.skill.zip`,entry,instructions,files:[file,...(old?.files||[]).filter(item=>item.path!==entry)],preview:old?.preview,hasScripts:old?.hasScripts||false,storageKey:old?.storageKey,resourceStorageKey:old?.resourceStorageKey}};
}
