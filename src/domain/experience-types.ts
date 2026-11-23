import type {EditTarget} from './types';
export const experienceSectionKeys = ['overview','references','changes','lessons','limitations'] as const;
export type ExperienceSectionKey = typeof experienceSectionKeys[number];
export type ExperienceSections = Record<ExperienceSectionKey,string>;
export interface ExperienceObservation {title:string;width:number;height:number;pageCount:number;nodeCount:number;nodeLayout:string;nodeText:string;storyCount:number;shotCount:number}
export interface ExperienceVersion {
 version:number;workRevision:number;target:EditTarget;targetLabel?:string;sourceFingerprint:string;updatedAt:string;
 observation?:ExperienceObservation;mode:'local'|'model';sections:ExperienceSections;editedSections:ExperienceSectionKey[];
}
export interface ExperienceRecord extends ExperienceVersion {
 id:string;createdAt:string;history:ExperienceVersion[];
}
