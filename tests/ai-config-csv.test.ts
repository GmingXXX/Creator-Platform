import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../server/config.mjs';
const folders: string[] = [];
const fixtureKey = 'sk-fixture.header.payload.signature';
async function root(csv: string) { const path = await mkdtemp(join(tmpdir(), 'zc-config-csv-')); folders.push(path); await writeFile(join(path, '阿里bai lian.csv'), csv); return path; }
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
describe('Bailian credential CSV boundary', () => {
  it('reads the exact apiKey value without truncating dotted credentials', async () => {
    const path = await root(`\uFEFFworkspaceName,"测试,空间"\r\napiKey,"${fixtureKey}"\r\ndashScope,https://example-workspace.cn-beijing.maas.aliyuncs.com/api/v1\r\napiHost,example-workspace.cn-beijing.maas.aliyuncs.com\r\nworkspaceId,test`);
    const config = await loadConfig(path, {});
    expect(config.dashscopeKey).toBe(fixtureKey);
    expect(config.dashscopeBase).toBe('https://example-workspace.cn-beijing.maas.aliyuncs.com');
  });
  it('supports apiHost-only exports and rejects secrets found in unrelated fields', async () => {
    const path = await root(`workspaceName,sk-not-a-key\napiHost,example.cn-beijing.maas.aliyuncs.com\napiKey,${fixtureKey}`);
    expect((await loadConfig(path, {})).dashscopeKey).toBe(fixtureKey);
    await writeFile(join(path, '阿里bai lian.csv'), 'workspaceName,sk-not-a-key');
    expect((await loadConfig(path, {})).dashscopeKey).toBe('');
  });
  it('prefers environment credentials and a validated environment base', async () => {
    const path = await root(`apiKey,${fixtureKey}\ndashScope,http://attacker.test/private`);
    const config = await loadConfig(path, { DASHSCOPE_API_KEY: 'sk-env.complete.signature', DASHSCOPE_BASE_URL: 'https://env-workspace.cn-beijing.maas.aliyuncs.com/api/v1/' });
    expect(config.dashscopeKey).toBe('sk-env.complete.signature');
    expect(config.dashscopeBase).toBe('https://env-workspace.cn-beijing.maas.aliyuncs.com');
    expect((await loadConfig(path, { DASHSCOPE_API_KEY: 'sk-env', DASHSCOPE_REGION: 'singapore' })).dashscopeBase).toBe('https://dashscope-intl.aliyuncs.com');
  });
  it.each(['http://example.cn-beijing.maas.aliyuncs.com/api/v1', 'https://example.cn-beijing.maas.aliyuncs.com.attacker.test', 'https://127.0.0.1', 'https://aliyuncs.com', 'https://a@dashscope.aliyuncs.com', 'https://dashscope.aliyuncs.com:8443', 'https://dashscope.aliyuncs.com/private', 'https://dashscope.aliyuncs.com/?token=secret', 'https://dashscope.aliyuncs.com/#private'])('rejects unsafe provider address %s without exposing its value', async endpoint => {
    const path = await root(`apiKey,${fixtureKey}\ndashScope,${endpoint}`);
    await expect(loadConfig(path, {})).rejects.toThrow('地址');
    await expect(loadConfig(path, {})).rejects.not.toThrow(fixtureKey);
  });
  it('rejects mismatched endpoint fields and duplicated credential keys', async () => {
    const path = await root(`apiKey,${fixtureKey}\ndashScope,https://one.cn-beijing.maas.aliyuncs.com/api/v1\napiHost,two.cn-beijing.maas.aliyuncs.com`);
    await expect(loadConfig(path, {})).rejects.toThrow('不一致');
    await writeFile(join(path, '阿里bai lian.csv'), `apiKey,${fixtureKey}\napiKey,sk-other`);
    await expect(loadConfig(path, {})).rejects.toThrow('重复');
  });
  it('preserves the legacy regional export and defaults when no endpoint is given', async () => {
    const path = await root('北京,sk-legacy-fixture');
    const config = await loadConfig(path, {});
    expect(config.dashscopeKey).toBe('sk-legacy-fixture');
    expect(config.dashscopeBase).toBe('https://dashscope.aliyuncs.com');
  });
});
