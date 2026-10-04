import { seal, unseal, sha256Base64Url } from './crypto.js';
import { refreshMicrosoftToken } from './microsoft.js';

const ACCESS_LIFETIME_MS = 50 * 60 * 1000;
const REFRESH_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export async function validateOAuthClient(clientId, redirectUri) {
  if (!clientId) throw new Error('client_id is required');
  if (!redirectUri) throw new Error('redirect_uri is required');

  if (clientId.startsWith('https://')) {
    const res = await fetch(clientId, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
    });
    if (!res.ok) throw new Error(`Unable to read client metadata (${res.status})`);
    const meta = await res.json();
    if (!Array.isArray(meta.redirect_uris) || !meta.redirect_uris.includes(redirectUri)) {
      throw new Error('redirect_uri is not registered in the client metadata document');
    }
    return { clientId, redirectUris: meta.redirect_uris, clientName: meta.client_name || clientId };
  }

  const reg = unseal(clientId);
  if (reg.kind !== 'dcr-client') throw new Error('Unknown OAuth client_id');
  if (!Array.isArray(reg.redirectUris) || !reg.redirectUris.includes(redirectUri)) {
    throw new Error('redirect_uri is not registered for this OAuth client');
  }
  return { clientId, redirectUris: reg.redirectUris, clientName: reg.clientName || 'MCP client' };
}

export function issueDcrClient({ redirectUris, clientName }) {
  if (!Array.isArray(redirectUris) || redirectUris.length < 1) {
    throw new Error('redirect_uris must contain at least one URI');
  }
  for (const uri of redirectUris) {
    const parsed = new URL(uri);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Unsupported redirect URI scheme');
  }
  return seal({
    kind: 'dcr-client',
    redirectUris,
    clientName: clientName || 'MCP client',
    iat: Date.now(),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });
}

export function verifyPkce(verifier, expectedChallenge) {
  if (!verifier || !expectedChallenge) return false;
  return sha256Base64Url(verifier) === expectedChallenge;
}

export function issueLocalTokens({ graphAccessToken, graphRefreshToken, graphExpiresIn, scope, clientId }) {
  const now = Date.now();
  const graphExpiry = now + Math.max(Number(graphExpiresIn || 3600) - 60, 60) * 1000;
  const localExpiry = Math.min(graphExpiry, now + ACCESS_LIFETIME_MS);
  const accessToken = seal({
    kind: 'access',
    graphAccessToken,
    scope,
    clientId,
    iat: now,
    exp: localExpiry,
  });
  const refreshToken = graphRefreshToken
    ? seal({
        kind: 'refresh',
        graphRefreshToken,
        scope,
        clientId,
        iat: now,
        exp: now + REFRESH_LIFETIME_MS,
      })
    : undefined;

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.max(60, Math.floor((localExpiry - now) / 1000)),
    scope,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  };
}

export function verifyLocalAccessToken(token) {
  const parsed = unseal(token);
  if (parsed.kind !== 'access' || !parsed.graphAccessToken) throw new Error('Invalid access token');
  return parsed;
}

export async function rotateRefreshToken(sealedRefreshToken) {
  const parsed = unseal(sealedRefreshToken);
  if (parsed.kind !== 'refresh' || !parsed.graphRefreshToken) throw new Error('Invalid refresh token');
  const ms = await refreshMicrosoftToken(parsed.graphRefreshToken);
  return issueLocalTokens({
    graphAccessToken: ms.access_token,
    graphRefreshToken: ms.refresh_token || parsed.graphRefreshToken,
    graphExpiresIn: ms.expires_in,
    scope: parsed.scope || 'onenote.readwrite',
    clientId: parsed.clientId,
  });
}
