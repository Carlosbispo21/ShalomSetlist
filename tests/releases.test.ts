import test from 'node:test';
import assert from 'node:assert/strict';
import { newerVersion, parseRelease } from '../src/releases.ts';
const project = 'https://vzccxwihuhcjydyjrzym.supabase.co';
const apkUrl = `${project}/storage/v1/object/public/app-releases/shalom-0.4.0.apk`;
test('versões comparam números e ignoram versões antigas, iguais ou inválidas', () => {
  assert.equal(newerVersion('0.10.0', '0.3.0'), true);
  for (const version of ['0.3.0', '0.2.9', 'v0.4.0', 'invalid', '0.4']) assert.equal(newerVersion(version, '0.3.0'), false);
});
test('aviso Android aceita apenas APK HTTPS no bucket de versões deste projeto', () => {
  assert.deepEqual(parseRelease({ version: '0.4.0', apkUrl }, '0.3.0', project), { version: '0.4.0', apkUrl });
  for (const url of [apkUrl.replace('https:', 'http:'), apkUrl.replace('vzccxwihuhcjydyjrzym.supabase.co', 'example.com'), apkUrl.replace('app-releases', 'scores'), apkUrl.replace('.apk', '.html'), 'javascript:alert(1)'])
    assert.equal(parseRelease({ version: '0.4.0', apkUrl: url }, '0.3.0', project), null);
  assert.equal(parseRelease({ version: '0.3.0', apkUrl }, '0.3.0', project), null);
  assert.equal(parseRelease(null, '0.3.0', project), null);
});
test('aceita lançamento do repositório autorizado e rejeita outro projeto ou versão', () => {
  const url = 'https://github.com/Carlosbispo21/ShalomSetlist/releases/download/v0.4.0/shalom-0.4.0.apk';
  assert.equal(parseRelease({ version: '0.4.0', apkUrl: url }, '0.3.0', project)?.apkUrl, url);
  assert.equal(parseRelease({ version: '0.4.0', apkUrl: url.replace('ShalomSetlist', 'other') }, '0.3.0', project), null);
  assert.equal(parseRelease({ version: '0.4.1', apkUrl: url }, '0.3.0', project), null);
});
