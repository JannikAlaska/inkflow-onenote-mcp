import crypto from 'node:crypto';

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not configured');

  let key;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    key = null;
  }
  if (!key || key.length !== 32) {
    const hex = Buffer.from(raw, 'hex');
    if (hex.length === 32) key = hex;
  }
  if (!key || key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (base64 or hex)');
  }
  return key;
}

export function seal(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((b) => b.toString('base64url')).join('.');
}

export function unseal(token) {
  if (!token || typeof token !== 'string') throw new Error('Missing sealed token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed sealed token');
  const [ivB64, ciphertextB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(plaintext.toString('utf8'));
  if (parsed.exp && Date.now() >= parsed.exp) throw new Error('Token expired');
  return parsed;
}

export function randomUrlSafe(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Base64Url(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

export function timingSafeEqualText(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
