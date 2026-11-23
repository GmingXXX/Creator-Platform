import type { Asset, Work } from './types';
import {getAssetMetadata} from './asset-metadata';

/** Public resources remain reusable; private files stay in their creation space. */
export function assetAvailableInSpace(asset: Asset, workspaceId = 'personal'): boolean {
  return Boolean(asset.public) || (asset.source==='builtin'&&!asset.workspaceId) || (asset.workspaceId || 'personal') === workspaceId;
}

export function workAvailableInSpace(work: Work, workspaceId = 'personal'): boolean {
  return !work.deletedAt && (work.workspaceId || 'personal') === workspaceId;
}

/** Engineering works are edited in their own studio, not inserted as raw media. */
export function assetAvailableForInsertion(asset: Asset, workspaceId = 'personal'): boolean {
  const native=['text','image','video','audio','shape','card','timeline','gallery','graph','map','flow','chart','bubble','button','html'];
  const insertable=['image','video','audio','html'].includes(asset.kind)||(asset.kind==='component'&&Boolean(asset.componentType&&native.includes(asset.componentType)));
  return assetAvailableInSpace(asset,workspaceId) && !asset.archived && !asset.deletedAt && !asset.sourceWorkId && !asset.workSnapshot && insertable;
}

/** A separate explicit import choice; it never makes the source available to project AI. */
export function assetAvailableForPersonalImport(asset:Asset,workspaceId:string):boolean {
  return workspaceId!=='personal'&&!asset.public&&asset.source!=='builtin'&&(asset.workspaceId||'personal')==='personal'&&assetAvailableForInsertion(asset,'personal');
}

/** Explicit AI attachments can be reference-only, but never bypass workspace or AI consent. */
export function assetAvailableForAI(asset:Asset,workspaceId='personal'):boolean {
  return assetAvailableInSpace(asset,workspaceId)&&!asset.deletedAt&&!asset.archived&&getAssetMetadata(asset).business.allowAi;
}
