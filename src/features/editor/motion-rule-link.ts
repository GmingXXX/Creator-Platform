let requestedRule:string|undefined;
export function openRuleMotion(ruleId:string){requestedRule=ruleId;window.dispatchEvent(new CustomEvent('studio:motion-rule',{detail:{id:ruleId}}))}
export function consumeMotionRule(){const id=requestedRule;requestedRule=undefined;return id}
