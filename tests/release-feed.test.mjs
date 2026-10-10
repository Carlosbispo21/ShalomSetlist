import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { verifyReleaseFeed } from '../scripts/verify-release-feed.mjs';
const expected={version:'0.3.3',apkUrl:'https://example.test/0.3.3.apk'};
test('não anuncia publicação enquanto o CDN entrega a versão anterior',async()=>{
  let checks=0, waits=0;
  await verifyReleaseFeed(expected,{fetchManifest:async()=>++checks===1?{...expected,version:'0.3.2'}:expected,wait:async()=>{waits++;}});
  assert.equal(checks,2); assert.equal(waits,1);
});
test('manifesto com download divergente não passa como publicado',async()=>{
  await assert.rejects(verifyReleaseFeed(expected,{timeout:0,fetchManifest:async()=>({...expected,apkUrl:'https://example.test/old.apk'})}),/cache do manifesto/);
});
