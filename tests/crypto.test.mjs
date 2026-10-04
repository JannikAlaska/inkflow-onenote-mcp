import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const { seal, unseal, sha256Base64Url } = await import('../lib/crypto.js');

 test('seal/unseal roundtrip', () => {
  const token = seal({ hello: 'world', exp: Date.now() + 10000 });
  assert.equal(unseal(token).hello, 'world');
});

test('PKCE hash is stable', () => {
  assert.equal(sha256Base64Url('abc'), 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
});
