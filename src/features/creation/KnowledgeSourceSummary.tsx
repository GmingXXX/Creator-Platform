import {Database} from 'lucide-react';
import type {Asset} from '../../domain/types';

export function KnowledgeSourceSummary({assets}:{assets:Asset[]}){
 const sources=assets.filter(asset=>asset.package?.params.knowledgeCatalogId==='zhichuang-20261116');
 if(!sources.length)return null;
 const fields=[...new Set(sources.map(asset=>asset.package?.params.knowledgeFieldName||'演示知识本地场'))];
 return <details className="knowledge-source-summary">
  <summary><Database size={15}/><span>已引用模拟知识本地场 · {sources.length} 份资料</span></summary>
  <p>{fields.join('、')}。以下为本次任务引用的资料，未调用真实 ACP 服务。</p>
  <ul>{sources.map(asset=><li key={asset.id}>{asset.name}</li>)}</ul>
 </details>;
}
