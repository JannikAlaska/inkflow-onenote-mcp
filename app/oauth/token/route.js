import { unseal } from '../../../lib/crypto.js';
import { oauthError, json } from '../../../lib/http.js';
import { issueLocalTokens, rotateRefreshToken, verifyPkce } from '../../../lib/oauth.js';

export async function POST(req) {
  try {
    const body = new URLSearchParams(await req.text());
    const grantType = body.get('grant_type');

    if (grantType === 'authorization_code') {
      const code = body.get('code');
      const verifier = body.get('code_verifier');
      const redirectUri = body.get('redirect_uri');
      if (!code || !verifier) return oauthError('invalid_request', 'Missing code or code_verifier');
      const parsed = unseal(code);
      if (parsed.kind !== 'auth-code') return oauthError('invalid_grant', 'Invalid authorization code');
      if (redirectUri && redirectUri !== parsed.redirectUri) return oauthError('invalid_grant', 'redirect_uri mismatch');
      if (!verifyPkce(verifier, parsed.codeChallenge)) return oauthError('invalid_grant', 'PKCE verification failed');

      return json(issueLocalTokens({
        graphAccessToken: parsed.graphAccessToken,
        graphRefreshToken: parsed.graphRefreshToken,
        graphExpiresIn: parsed.graphExpiresIn,
        scope: parsed.requestedScope || 'onenote.readwrite',
        clientId: parsed.clientId,
      }));
    }

    if (grantType === 'refresh_token') {
      const refreshToken = body.get('refresh_token');
      if (!refreshToken) return oauthError('invalid_request', 'Missing refresh_token');
      return json(await rotateRefreshToken(refreshToken));
    }

    return oauthError('unsupported_grant_type', 'Supported grants: authorization_code, refresh_token');
  } catch (err) {
    return oauthError('invalid_grant', err.message || 'Token exchange failed');
  }
}
