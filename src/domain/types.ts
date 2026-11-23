import type {SkillMetadata} from './skill-metadata';
import type {ExhibitReference} from './exhibit-references';
import type {ExperienceRecord} from './experience-types';
import type {ACPKnowledgeBinding,KnowledgeFieldInput,KnowledgeTarget} from './workspace-knowledge';
import type {WorkspaceData,WorkspaceMember} from './workspace-management';
import type {Workspace} from './workspaces';
export type ExhibitType = '时间演进型' | '关系图谱型' | '卡片浏览型' | '空间分布型' | '流程架构型' | '媒体叙事型' | '数据总览型';
export type WorkKind = 'exhibit' | 'presentation' | 'video' | 'story';
export type NodeKind = 'text' | 'image' | 'video' | 'audio' | 'shape' | 'card' | 'timeline' | 'gallery' | 'graph' | 'map' | 'flow' | 'chart' | 'bubble' | 'button' | 'html';
export interface ContentItem { assetId?: string; id: string; title: string; description: string; year?: string; image?: string; parentId?: string; value?: number; x?: number; y?: number; category?: string }
export interface Interaction { id: string; event: 'click' | 'videoStart'; action: 'detail' | 'navigate' | 'show' | 'hide' | 'toggle' | 'play' | 'state'; targetId?: string }
export interface MotionConfig { preset: string; duration: number; delay: number; easing: string; hold: boolean; keyframes?: {time: number; x: number; opacity: number}[] }
export interface VoiceCommand { id: string; phrase: string; aliases: string; action: string; targetId?: string; enabled: boolean; scope: 'page' | 'global' }
export interface TextAppearance { fontFamily?: string; fontSize?: number; fontWeight?: number; textAlign?: 'left' | 'center' | 'right' | 'justify'; lineHeight?: number; color?: string }
export interface SceneNode extends TextAppearance { titleStyle?: TextAppearance; bodyStyle?: TextAppearance; timelineLayout?: 'fishbone'; assetId?: string; mediaFit?: 'cover' | 'contain'; id: string; type: NodeKind; name: string; x: number; y: number; w: number; h: number; rotation: number; opacity: number; hidden: boolean; locked: boolean; content: string; src?: string; color: string; background: string; fontSize: number; radius: number; items?: ContentItem[]; interactions?: Interaction[]; motion?: MotionConfig; commands?: VoiceCommand[]; columns?: number; gap?: number; state?: string }
export interface ScenePage { backgroundAssetId?: string; id: string; name: string; background: string; backgroundImage?: string; nodes: SceneNode[]; notes?: string }
export interface StoryNode { mediaAssetId?: string; id: string; type: string; x: number; y: number; title: string; text: string; media?: string }
export interface StoryEdge { id: string; source: string; target: string; label: string }
export interface Work { productionStage?: import("./production-stage").ProductionStage; deliveryReview?: {revision:number;checks:string[]}; referenceSnapshots?: ExhibitReference[]; referenceHistory?: ExhibitReference[]; references?: ExhibitReference[]; experience?: ExperienceRecord; cover?: string; coverAssetId?: string; displayForm?: ExhibitType | null; aiModel?: string; contentPurposes?: string[]; creationPackage?: CreationPackage; id: string; workspaceId?: string; deletedAt?: string; projectId: string; title: string; kind: WorkKind; type: ExhibitType; width: number; height: number; styleId: string; pages: ScenePage[]; updatedAt: string; createdAt: string; revision: number; archived?: boolean; storyNodes?: StoryNode[]; storyEdges?: StoryEdge[]; voice?: string; shots?: {assetId?: string; id: string; title: string; narration: string; duration: number; src: string}[] }
export type AssetKind = 'presentation' | 'image' | 'video' | 'audio' | 'component' | 'html' | 'document';
export interface PackageFile { generatedBy?: 'work-output'; name: string; type: string; src?: string; content?: string }
export interface CreationPackage { referenceHistory?: ExhibitReference[]; references?: ExhibitReference[]; experience?: ExperienceRecord; skillSnapshots?: Skill[]; id: string; version: string; prompt: string; negativePrompt?: string; files: PackageFile[]; skillIds: string[]; params: Record<string, string>; styleId?: string; sourceId?: string; complete: boolean }
export interface AssetMetadata { facts?: { mime?: string; bytes?: number; width?: number; height?: number; duration?: number }; analysis?: { status: 'ready' | 'needs-description' | 'failed'; summary: string; tags: string[]; basis: 'file' | 'inherited' | 'demo' }; business?: { note: string; subject: string; confirmed: boolean; usage: 'project' | 'reusable' | 'reference'; allowAi: boolean } }
export interface ComponentImportRecord {
  source: 'html' | 'package';
  filename: string;
  fields: import('./component-import').ComponentField[];
  values: Record<string, string | number | boolean>;
  checks: import('./component-import').ComponentCheck[];
  runtime: 'preview-loaded' | 'parameters-connected';
  offline: 'unverified';
  checkedAt: string;
}
export interface Asset { knowledgeTarget?: KnowledgeTarget; intake?: {relativePath:string;folder?:string;batchId:string;status:string;packageKind?:'component'|'skill'|'archive'}; componentImport?: ComponentImportRecord; presentationRole?: 'embedded-component' | 'project-source'; metadata?: AssetMetadata; origin?: { assetId: string; version: string }; sourceWorkId?: string; workSnapshot?: Work; updatedAt?: string; archived?: boolean; deletedAt?: string; id: string; workspaceId?: string; name: string; kind: AssetKind; src: string; preview: string; description: string; tags: string[]; author: string; createdAt: string; source: 'uploaded' | 'generated' | 'community' | 'builtin'; package?: CreationPackage; componentType?: NodeKind; public?: boolean }
export interface Template { id: string; title: string; type: ExhibitType; author: string; tags: string[]; likes: number; uses: number; work: Work }
export interface Skill {
  metadata?: Partial<SkillMetadata>;
  enabled?: boolean; workspaceId?: string; source?: 'uploaded' | 'community' | 'builtin'; public?: boolean; revision?: number; sourceSkillId?: string; origin?: {skillId:string;version:string}; sourcePackage?: { filename: string; entry: string; instructions: string; files: {path: string; size: number; mime: string; content?: string; dataUrl?: string}[]; preview?: string; hasScripts: boolean; storageKey?: string; resourceStorageKey?: string }; id: string; name: string; description: string; category: string; styleId: string; previewType: NodeKind; author: string; version: string; input: string; steps: string[]; personal?: boolean }
export interface DesignSystem { version?: string; maintainer?: string; id: string; name: string; subtitle: string; description: string; colors: string[]; background: string; text: string; accent: string; font: string; motion: string; tags: string[] }
export interface Submission { id: string; kind: 'template' | 'asset' | 'skill'; name: string; author: string; createdAt: string; status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; reason?: string; work?: Work; asset?: Asset; skill?: Skill; revision: number }
export interface ComposerDraft { productionStage?: import("./production-stage").ProductionStage; intentClarification?: import("./intent-clarification").IntentClarification; references?: ExhibitReference[]; id: string; workspaceId?: string; text: string; model: string; styleId: string; skillIds: string[]; attachmentIds: string[]; reference?: CreationPackage; updatedAt: string }
export interface BackgroundDraft { requestId:string;prompt:string;size:string;status:'pending'|'ready'|'failed';taskId?:string;assetId?:string;error?:string;retryable?:boolean }
export interface Run { productionStage?: import("./production-stage").ProductionStage; references?: ExhibitReference[];
  explicitSkillIds?: string[];
  skillSelections?: {id:string;name:string;reason:string;mode:'explicit'|'automatic'}[]; backgroundDraft?:BackgroundDraft;generatedBackgroundIds?:string[]; structureConfirmed?: boolean; studioReview?: boolean; aiPlan?: import("./ai-plan").AIPlan; aiImageTaskId?: string; backgroundAssetId?: string; backgroundSelection?: 'suggested' | 'manual'; draftId?: string; id: string; workspaceId?: string; resourceStrategy?: 'generate' | 'reuse'; prompt: string; model: string; styleId: string; skillIds: string[]; attachmentIds: string[]; reference?: CreationPackage; status: 'running' | 'waiting' | 'stopped' | 'failed' | 'complete'; step: number; outputKind: 'exhibit' | 'component' | 'image' | 'video' | 'presentation' | 'html' | 'story'; workId?: string; assetId?: string; createdAt: string; error?: string }
export interface EditTarget { scope: 'work' | 'page' | 'node'; pageId?: string; nodeId?: string }
export interface ConversationTurn { id: string; workId: string; prompt: string; target: EditTarget; status: 'applied' | 'unsupported' | 'reverted'; summary: string; createdAt: string; before?: Work; afterRevision?: number; attachmentIds?: string[] }
export interface RevisionResult { ok: boolean; summary: string; turnId?: string }
export interface StudioData extends WorkspaceData { workspaceRestoreNotice?: string; workspaceDemoVersion?: number; sharingSchemaVersion?: number; projectSchemaVersion?: number; resourceSchemaVersion?: number; composerSchemaVersion?: number; creationError?: string; activeWorkspaceId: string; conversationTurns: ConversationTurn[]; works: Work[]; assets: Asset[]; templates: Template[]; skills: Skill[]; systems: DesignSystem[]; submissions: Submission[]; favorites: string[]; drafts: ComposerDraft[]; activeDraftId: string; runs: Run[]; role: 'creator' | 'reviewer'; loggedIn: boolean }
export interface StudioActions {
 archiveWorkspace:(id:string)=>void;
 unarchiveWorkspace:(id:string)=>void;
 deleteWorkspace:(id:string)=>void;
 restoreWorkspace:(id:string)=>void;
 permanentlyDeleteWorkspace:(id:string,confirmationName:string)=>void;
 moveWorkToWorkspace:(id:string,targetWorkspaceId:string)=>Work;
 updateWorkspaceDetails:(workspaceId:string,input:{name:string;description?:string})=>void;
 transferWorkspaceOwnership:(workspaceId:string,memberId:string)=>void;
 createWorkspace:(input:{name:string;description?:string;knowledgeField?:KnowledgeFieldInput})=>Workspace;
 bindWorkspaceKnowledge:(workspaceId:string,input:KnowledgeFieldInput)=>ACPKnowledgeBinding;
 unbindWorkspaceKnowledge:(workspaceId:string)=>void;
 inviteWorkspaceMember:(workspaceId:string,account:string,role:'editor'|'viewer')=>WorkspaceMember;
 changeWorkspaceMemberRole:(workspaceId:string,memberId:string,role:'editor'|'viewer')=>void;
 removeWorkspaceMember:(workspaceId:string,memberId:string)=>void;
 acceptWorkspaceInvitation:(workspaceId:string,memberId:string)=>void;
 setWorkspaceActor:(workspaceId:string,memberId:string)=>void;
 login: (username: string, password: string) => boolean;
 logout: () => void;
 setRole: (role: StudioData['role']) => void;
 setWorkspace: (id: string) => void;
 deleteWork: (id: string) => boolean;
 restoreWork: (id: string) => boolean;
 deleteDraft: (id: string) => void;
 reviseWork: (workId: string, prompt: string, target?: EditTarget, attachmentIds?: string[]) => RevisionResult;
 undoRevision: (turnId: string) => RevisionResult;
 saveWork: (work: Work) => void;
 createWork: (options: {displayForm?: ExhibitType | null; workspaceId?: string; title: string; type: ExhibitType; width: number; height: number; styleId?: string; kind?: WorkKind; contentPurposes?: string[]}) => Work;
 cloneTemplate: (id: string) => Work | undefined;
 duplicateWork: (id: string) => Work | undefined;
 archiveWork: (id: string) => void;
 addAsset: (asset: Asset) => void;
 updateAssetMetadata: (id: string, patch: Partial<AssetMetadata>) => boolean;
 adoptAsset: (id: string, workspaceId: string) => Asset | undefined;
 removeAsset: (id: string) => boolean;
 copyAssetToLibrary: (id: string) => string | undefined;
 addSkill: (skill: Skill) => void;
 submitSkill: (id: string) => string | undefined;
 adoptSkill: (id: string, workspaceId?: string) => Skill | undefined;
 copySkillToSpace: (id:string, workspaceId:string) => Skill | undefined;
 toggleFavorite: (id: string) => void;
 updateDraft: (patch: Partial<ComposerDraft>) => void;
 newDraft: (patch?: Partial<ComposerDraft>) => ComposerDraft;
 selectDraft: (id: string) => void;
 referenceAsset: (asset: Asset) => ComposerDraft | undefined;
 startRun: () => Run | undefined;
 updateRun: (id: string, patch: Partial<Run>) => void;
 completeRun: (id: string) => void;
 submitWork: (id: string) => string | undefined;
 submitAsset: (id: string) => string | undefined;
 reviewSubmission: (id: string, status: 'approved' | 'rejected' | 'withdrawn', reason?: string) => boolean;
 resetDemo: () => void;
}
export type StudioStore = StudioData & StudioActions;
