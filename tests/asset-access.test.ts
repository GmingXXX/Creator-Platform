import { describe, expect, it } from 'vitest';
import { assetAvailableForAI, assetAvailableForInsertion, assetAvailableInSpace, workAvailableInSpace } from '../src/domain/asset-access';
import {canCopyResource} from '../src/domain/resource-sharing';
import {useStudio} from '../src/domain/store';
import { createInitialData } from '../src/domain/fixtures';

describe('resource space boundaries', () => {
  const seed = createInitialData();
  it('shares published and built-in resources while keeping uploads in their originating space', () => {
    const base = { ...seed.assets[0], public: false, source: 'uploaded' as const, workspaceId: 'xintai' };
    expect(assetAvailableInSpace(base, 'xintai')).toBe(true);
    expect(assetAvailableInSpace(base, 'dongguan')).toBe(false);
    expect(assetAvailableInSpace({ ...base, public: true }, 'dongguan')).toBe(true);
    expect(assetAvailableInSpace({ ...base, source: 'builtin',workspaceId:undefined }, 'dongguan')).toBe(true);
  });
  it('keeps project demo materials scoped and makes an explicit personal copy',()=>{
    const base=seed.assets.find(asset=>asset.id==='workspace-demo-xintai-asset-1')!;
    expect(assetAvailableForAI(base,'xintai')).toBe(true);
    expect(assetAvailableForAI(base,'dongguan')).toBe(false);
    expect(assetAvailableForInsertion(base,'personal')).toBe(false);
    expect(canCopyResource(base,'dongguan','personal')).toBe(false);
    expect(canCopyResource(base,'xintai','dongguan')).toBe(false);
    expect(canCopyResource(base,'xintai','personal')).toBe(true);
    useStudio.setState({...createInitialData(),activeWorkspaceId:'xintai'});
    const copy=useStudio.getState().adoptAsset(base.id,'personal');
    expect(copy?.id).not.toBe(base.id);expect(copy?.workspaceId).toBe('personal');
    expect(useStudio.getState().assets.find(asset=>asset.id===base.id)?.workspaceId).toBe('xintai');
  });
  it('limits insertion to active raw media in the accessible space', () => {
    const base = {...seed.assets[0],public:false,source:'uploaded' as const,workspaceId:'xintai'};
    expect(assetAvailableForInsertion(base,'xintai')).toBe(true);
    expect(assetAvailableForInsertion(base,'personal')).toBe(false);
    expect(assetAvailableForInsertion({...base,archived:true},'xintai')).toBe(false);
    expect(assetAvailableForInsertion({...base,deletedAt:'2026-11-06'},'xintai')).toBe(false);
    expect(assetAvailableForInsertion({...base,kind:'presentation'},'xintai')).toBe(false);
    expect(assetAvailableForInsertion({...base,kind:'video',sourceWorkId:'work-5'},'xintai')).toBe(false);
    expect(assetAvailableForInsertion({...base,kind:'video',workSnapshot:seed.works[4]},'xintai')).toBe(false);
    expect(assetAvailableInSpace({...base,deletedAt:'2026-11-06'},'xintai')).toBe(true);
  });
  it('treats legacy private uploads as personal', () => {
    const base = { ...seed.assets[0], public: false, source: 'uploaded' as const, workspaceId: undefined };
    expect(assetAvailableInSpace(base, 'personal')).toBe(true);
    expect(assetAvailableInSpace(base, 'xintai')).toBe(false);
  });
  it('excludes recycled work from every picker without losing its original space', () => {
    const work = { ...seed.works[0], workspaceId: 'xintai' };
    expect(workAvailableInSpace(work, 'xintai')).toBe(true);
    expect(workAvailableInSpace(work, 'personal')).toBe(false);
    expect(workAvailableInSpace({ ...work, deletedAt: new Date().toISOString() }, 'xintai')).toBe(false);
  });
});
