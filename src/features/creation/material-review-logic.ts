import type {Asset} from '../../domain/types';
export function generationAssetLabel(asset:Pick<Asset,'source'>){return asset.source==='generated'?'AI 生成':asset.source==='uploaded'?'客户上传':'素材库';}
export function materialRequestId(key:string,version:number){let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);return `material-${(hash>>>0).toString(16)}-${version}`;}
