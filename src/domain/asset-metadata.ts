import type {Asset, AssetMetadata} from './types';

export type ResolvedAssetMetadata = Required<AssetMetadata>;

/** Descriptions from sample/generated sources are inherited, not computer-vision results. */
export function getAssetMetadata(asset:Asset):ResolvedAssetMetadata {
  const uploaded=asset.source==='uploaded';
  const inherited:NonNullable<AssetMetadata['analysis']>={
    status:uploaded?'needs-description':'ready',
    summary:uploaded?'已读取文件属性，内容与业务身份尚待补充。':asset.description,
    tags:uploaded?[]:[...asset.tags],
    basis:uploaded?'file':asset.source==='generated'?'demo':'inherited',
  };
  return {
    facts:{...asset.metadata?.facts},
    analysis:asset.metadata?.analysis?{...asset.metadata.analysis,tags:[...asset.metadata.analysis.tags]}:inherited,
    business:{note:'',subject:'',confirmed:false,usage:asset.public||asset.source==='builtin'?'reusable':'project',allowAi:true,...asset.metadata?.business},
  };
}

/** Refreshing machine-derived metadata cannot overwrite a person's business description. */
export function mergeAssetMetadata(asset:Asset, metadata:Partial<AssetMetadata>):Asset {
  const current=getAssetMetadata(asset);
  return {...asset,metadata:{...current,...metadata,
    facts:{...current.facts,...metadata.facts},
    analysis:metadata.analysis?{...metadata.analysis,tags:[...metadata.analysis.tags]}:current.analysis,
    business:asset.metadata?.business?{...asset.metadata.business}:metadata.business?{...metadata.business}:current.business,
  }};
}

export function assetSearchText(asset:Asset):string {
  const metadata=getAssetMetadata(asset);
  return [asset.name,asset.description,...asset.tags,metadata.analysis.summary,...metadata.analysis.tags,metadata.business.note,metadata.business.subject].join(' ').toLowerCase();
}

export function describeAssetSource(asset:Asset):string {
  if(asset.public)return '共创社区';
  if(asset.package?.params.knowledgeCatalogId==='zhichuang-20261116')return '模拟知识本地场 · 引用资料';
  if(asset.source==='builtin')return '平台内置';
  if(asset.origin||asset.source==='community')return '社区复用 · 当前空间';
  return asset.source==='generated'?'当前空间 · 智能生成':'当前空间 · 上传素材';
}

export function validBusinessMetadata(value:unknown):value is NonNullable<AssetMetadata['business']> {
  if(!value||typeof value!=='object')return false;
  const input=value as Record<string,unknown>;
  return typeof input.note==='string'&&input.note.length<=2000&&typeof input.subject==='string'&&input.subject.length<=120
    &&typeof input.confirmed==='boolean'&&(!input.confirmed||Boolean(input.subject.trim()))
    &&typeof input.usage==='string'&&['project','reusable','reference'].includes(input.usage)&&typeof input.allowAi==='boolean';
}
