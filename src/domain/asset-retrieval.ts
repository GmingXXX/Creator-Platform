import type {Asset, AssetKind} from './types';
import {assetAvailableForInsertion} from './asset-access';
import {assetSearchText, describeAssetSource, getAssetMetadata} from './asset-metadata';

export interface AssetMatch {asset:Asset;score:number;reasons:string[]}
export interface AssetQuery {assets:Asset[];workspaceId:string;query:string;kind?:AssetKind;forAI?:boolean;subject?:string}
const subjects:Record<string,string>={xintai:'信泰',dongguan:'东莞博物馆',aitown:'AI小镇'};
const terms=['背景','工厂','厂房','工业','钢铁','科技','蓝色','蓝灰','珠宝','首饰','政务','博物馆','文博','金融','论坛','时间轴','大事记','语音','气泡','荣誉','案例','地图','卡片','留白','横屏','竖屏','透明','照片','视频','图片'];
const genericTerms=new Set(['背景','图片','照片','视频','横屏','竖屏','透明','留白']);
const normalize=(text:string)=>text.toLowerCase().replace(/[\s·，。！？、：；“”"'（）()]/g,'');
const subjectAliases:Record<string,string>={'信泰企业展厅':'信泰','ai小镇展厅':'ai小镇'};
const normalizeSubject=(text:string)=>subjectAliases[normalize(text)]||normalize(text);

/** Deterministic demo matching; no semantic model or confidence claim is involved. */
export function requestedSubject(query:string,workspaceId:string,explicit?:string):string|undefined {
  if(explicit?.trim())return normalizeSubject(explicit);
  const text=normalize(query);
  const named=Object.values(subjects).find(subject=>text.includes(normalize(subject)));
  if(named)return normalize(named);
  if(/客户自己|客户实拍|本企业|本公司|我们的工厂|客户原始|真实客户/.test(text))return normalize(subjects[workspaceId]||'未明确客户');
  if(/实拍|真实.*(?:素材|照片|图片|画面)|品牌标识|logo/.test(text))return '__unconfirmed-subject__';
  return undefined;
}

function queryTerms(query:string):string[] {
  const text=normalize(query);
  const words=[...query.toLowerCase().matchAll(/[a-z0-9_-]{2,}/g)].map(match=>match[0]);
  const familiar=terms.filter(term=>text.includes(term));
  const fragments=[...query.matchAll(/[\u4e00-\u9fff]{2,}/g)].map(match=>match[0]);
  const related=text.includes('钢铁')?['工业']:text.includes('珠宝')?['首饰']:text.includes('文博')?['博物馆']:[];
  return [...new Set([...words,...familiar,...fragments,...related])];
}

function matchAsset(asset:Asset, input:AssetQuery, tokens:string[]):AssetMatch|undefined {
  if(!assetAvailableForInsertion(asset,input.workspaceId)||(input.kind&&asset.kind!==input.kind))return;
  const metadata=getAssetMetadata(asset), business=metadata.business;
  const subject=requestedSubject(input.query,input.workspaceId,input.subject);
  if(input.forAI){
    if(!business.allowAi||business.usage==='reference')return;
    if(metadata.analysis.status!=='ready'&&!business.note.trim())return;
    if(subject&&(!business.confirmed||normalizeSubject(business.subject)!==subject))return;
  }
  const text=normalize(assetSearchText(asset));
  const matched=tokens.filter(token=>text.includes(normalize(token)));
  if(input.query.trim()&&!matched.length)return;
  if(input.forAI&&tokens.some(token=>!genericTerms.has(token))&&!matched.some(token=>!genericTerms.has(token)))return;
  const local=!asset.public&&asset.source!=='builtin'&&(asset.workspaceId||'personal')===input.workspaceId;
  const businessMatch=matched.some(token=>normalize(business.note).includes(normalize(token)));
  const reasons=[describeAssetSource(asset)];
  if(businessMatch)reasons.push('业务说明匹配');
  if(subject&&business.confirmed)reasons.push('业务对象已确认');
  if(matched.length)reasons.push(`匹配：${matched.slice(0,3).join('、')}`);
  return {asset,score:matched.length*10+(businessMatch?3:0)+(local?1:0),reasons};
}

export function rankAssets(input:AssetQuery):AssetMatch[] {
  const tokens=queryTerms(input.query);
  return input.assets.map(asset=>matchAsset(asset,input,tokens)).filter((match):match is AssetMatch=>Boolean(match))
    .sort((a,b)=>b.score-a.score||a.asset.name.localeCompare(b.asset.name,'zh-CN'));
}
