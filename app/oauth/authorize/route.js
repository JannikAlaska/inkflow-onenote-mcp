import { randomUrlSafe, seal, sha256Base64Url } from '../../../lib/crypto.js';
import { originFromRequest, oauthError } from '../../../lib/http.js';
import { validateOAuthClient } from '../../../lib/oauth.js';
import { MICROSOFT_CLIENT_ID, MS_AUTHORIZE_URL, MS_SCOPES } from '../../../lib/microsoft.js';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const responseType = q.get('response_type');
    const clientId = q.get('client_id');
    const redirectUri = q.get('redirect_uri');
    const state = q.get('state') || '';
    const codeChallenge = q.get('code_challenge');
    const codeChallengeMethod = q.get('code_challenge_method');
    const requestedScope = q.get('scope') || 'onenote.readwrite offline_access';

    if (responseType !== 'code') return oauthError('unsupported_response_type', 'Only response_type=code is supported');
    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      return oauthError('invalid_request', 'PKCE with code_challenge_method=S256 is required');
    }
    await validateOAuthClient(clientId, redirectUri);

    const origin = originFromRequest(req);
    const msRedirectUri = `${origin}/oauth/microsoft/callback`;
    const msVerifier = randomUrlSafe(48);
    const msState = seal({
      kind: 'ms-state',
      clientId,
      redirectUri,
      state,
      requestedScope,
      codeChallenge,
      msVerifier,
      iat: Date.now(),
      exp: Date.now() + 10 * 60 * 1000,
    });

    const ms = new URL(MS_AUTHORIZE_URL);
    ms.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
    ms.searchParams.set('response_type', 'code');
    ms.searchParams.set('redirect_uri', msRedirectUri);
    ms.searchParams.set('response_mode', 'query');
    ms.searchParams.set('scope', MS_SCOPES.join(' '));
    ms.searchParams.set('state', msState);
    ms.searchParams.set('code_challenge', sha256Base64Url(msVerifier));
    ms.searchParams.set('code_challenge_method', 'S256');
    ms.searchParams.set('prompt', 'select_account');

    return Response.redirect(ms.toString(), 302);
  } catch (err) {
    return oauthError('invalid_request', err.message || 'Authorization request failed');
  }
}
