import {withoutPresentationKnowledge} from './presentation-knowledge-sharing';
import {publicSkillSnapshot} from './skill-publication';
import type {Asset,CreationPackage,Work} from './types';

/** Creative notes belong to the private production record, not the submitted artifact. */
function publicPackageSnapshot(pkg:CreationPackage):CreationPackage {
 const {experience,referenceHistory,references,skillSnapshots,skillIds,params,...content}=structuredClone(pkg);
 const {experienceWorkId,...publicParams}=params;
 const shared=(skillSnapshots||[]).filter(skill=>skill.public).map(publicSkillSnapshot);
 return {...content,params:withoutPresentationKnowledge(publicParams),skillIds:skillIds.filter(id=>shared.some(skill=>skill.id===id)),...(shared.length?{skillSnapshots:shared}:{})};
}

export function publicWorkSnapshot(work:Work):Work {
 const {experience,deliveryReview,referenceHistory,references,referenceSnapshots,creationPackage,...content}=structuredClone(work);
 return {...content,...(creationPackage?{creationPackage:publicPackageSnapshot(creationPackage)}:{})};
}

export function publicAssetSnapshot(asset:Asset):Asset {
 const {package:pkg,workSnapshot,...content}=structuredClone(asset);
 return {...content,...(pkg?{package:publicPackageSnapshot(pkg)}:{}),...(workSnapshot?{workSnapshot:publicWorkSnapshot(workSnapshot)}:{})};
}
