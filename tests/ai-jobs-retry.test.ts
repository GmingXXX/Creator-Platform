import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ImageJobs } from '../server/jobs.mjs';
import { ApiError } from '../server/config.mjs';

const directories: string[] = [];
const input = { workspaceId: 'personal', idempotencyKey: 'single-paid-image', prompt: '背景', size: '1696*960' };
async function setup(pollImage = vi.fn().mockResolvedValue({ status: 'SUCCEEDED', url: 'https://x.aliyuncs.com/a.png' })) {
  const dir = await mkdtemp(join(tmpdir(), 'zc-jobs-retry-')); directories.push(dir);
  const providers = { submitImage: vi.fn().mockResolvedValue({ taskId: 'paid-once' }), pollImage, downloadImage: vi.fn().mockResolvedValue(Buffer.from('image')) };
  const jobs = new ImageJobs(dir, providers, { schedule: false }); await jobs.init();
  const task = await jobs.create(input);
  return { dir, jobs, providers, id: task.id };
}
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

describe('paid image task retry recovery', () => {
  it.each([429, 500, 502, 503, 504])('retries transient ApiError %s without another submission', async status => {
    const poll = vi.fn().mockRejectedValueOnce(new ApiError('temporary', status)).mockResolvedValue({ status: 'SUCCEEDED', url: 'https://x.aliyuncs.com/a.png' });
    const { jobs, providers, id } = await setup(poll);
    await jobs.process(id); expect((await jobs.get(id)).status).toBe('running');
    await jobs.process(id); expect((await jobs.get(id)).status).toBe('succeeded');
    expect(providers.submitImage).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenNthCalledWith(2, 'paid-once');
  });
  it('caps automatic retries and lets the same idempotency key resume the paid task after restart', async () => {
    const { jobs, providers, id, dir } = await setup(vi.fn().mockRejectedValue(new ApiError('temporary', 502)));
    for (let attempt = 0; attempt < 5; attempt++) await jobs.process(id);
    expect(providers.pollImage).toHaveBeenCalledTimes(3);
    expect(await jobs.get(id)).toMatchObject({ status: 'failed', retryable: true });
    const restored = new ImageJobs(dir, providers, { schedule: false }); await restored.init();
    providers.pollImage.mockResolvedValue({ status: 'SUCCEEDED', url: 'https://x.aliyuncs.com/a.png' });
    const [a,b] = await Promise.all([restored.create(input), restored.create(input)]);
    expect(a.id).toBe(id); expect(b.id).toBe(id); expect(a.status).toBe('running');
    await restored.process(id);
    expect(await restored.get(id)).toMatchObject({ status: 'succeeded', retryable: false });
    expect(providers.submitImage).toHaveBeenCalledTimes(1);
  });
  it('retries image downloads and preserves the paid task identity', async () => {
    const { jobs, providers, id } = await setup();
    providers.downloadImage.mockRejectedValueOnce(new ApiError('保存失败', 502));
    await jobs.process(id); expect((await jobs.get(id)).status).toBe('running');
    await jobs.process(id); expect((await jobs.get(id)).status).toBe('succeeded');
    expect(providers.downloadImage).toHaveBeenCalledTimes(2); expect(providers.submitImage).toHaveBeenCalledTimes(1);
  });
  it.each(['FAILED', 'CANCELED', 'UNKNOWN'])('does not retry terminal provider state %s', async status => {
    const { jobs, providers, id } = await setup(vi.fn().mockResolvedValue({ status }));
    await jobs.process(id); await jobs.create(input); await jobs.process(id);
    expect(await jobs.get(id)).toMatchObject({ status: 'failed', retryable: false });
    expect(providers.pollImage).toHaveBeenCalledTimes(1); expect(providers.submitImage).toHaveBeenCalledTimes(1);
  });
  it('keeps GET read-only and rejects a changed payload when resuming', async () => {
    const { jobs, providers, id } = await setup(vi.fn().mockRejectedValue(new ApiError('temporary', 502)));
    for (let attempt = 0; attempt < 3; attempt++) await jobs.process(id);
    await jobs.get(id); await jobs.get(id);
    expect(providers.pollImage).toHaveBeenCalledTimes(3);
    await expect(jobs.create({ ...input, prompt: 'different' })).rejects.toThrow('重复');
    expect((await jobs.get(id)).status).toBe('failed');
  });
  it('bounds a query window but permits explicit resumption of the existing provider task', async () => {
    const { jobs, providers, id } = await setup(vi.fn().mockResolvedValue({ status: 'RUNNING' }));
    await jobs.process(id);
    await jobs.save({ ...jobs.tasks.get(id), createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString() });
    await jobs.process(id);
    expect(await jobs.get(id)).toMatchObject({ status: 'failed', retryable: true });
    providers.pollImage.mockResolvedValue({ status: 'SUCCEEDED', url: 'https://x.aliyuncs.com/a.png' });
    await jobs.create(input); await jobs.process(id);
    expect((await jobs.get(id)).status).toBe('succeeded');
    expect(providers.submitImage).toHaveBeenCalledTimes(1);
  });
  it('does not retry a non-transient request rejection', async () => {
    const { jobs, providers, id } = await setup(vi.fn().mockRejectedValue(new ApiError('rejected', 400)));
    await jobs.process(id); await jobs.create(input); await jobs.process(id);
    expect(await jobs.get(id)).toMatchObject({ status: 'failed', retryable: false });
    expect(providers.pollImage).toHaveBeenCalledTimes(1);
  });
  it('never retries or resubmits a request whose submission result is unknown', async () => {
    const { jobs, providers, id } = await setup();
    providers.submitImage.mockRejectedValue(new ApiError('network failure', 502));
    await jobs.process(id); await jobs.create(input); await jobs.process(id);
    expect(await jobs.get(id)).toMatchObject({ status: 'failed', retryable: false });
    expect(providers.submitImage).toHaveBeenCalledTimes(1); expect(providers.pollImage).not.toHaveBeenCalled();
  });
});
