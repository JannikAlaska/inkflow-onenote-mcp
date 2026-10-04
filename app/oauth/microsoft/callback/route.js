import { seal, unseal } from '../../../../lib/crypto.js';
import { originFromRequest, oauthError } from '../../../../lib/http.js';
import { exchangeMicrosoftCode } from '../../../../lib/microsoft.js';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const error = url.searchParams.get('error');
    if (error) {
      return oauthError(error, url.searchParams.get('error_description') || 'Microsoft authorization failed');
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return oauthError('invalid_request', 'Missing Microsoft code or state');

    const st = unseal(state);
    if (st.kind !== 'ms-state') return oauthError('invalid_request', 'Invalid OAuth state');
    const origin = originFromRequest(req);
    const msRedirectUri = `${origin}/oauth/microsoft/callback`;
    const ms = await exchangeMicrosoftCode({ code, redirectUri: msRedirectUri, codeVerifier: st.msVerifier });

    const authorizationCode = seal({
      kind: 'auth-code',
      clientId: st.clientId,
      redirectUri: st.redirectUri,
      codeChallenge: st.codeChallenge,
      requestedScope: st.requestedScope,
      graphAccessToken: ms.access_token,
      graphRefreshToken: ms.refresh_token,
      graphExpiresIn: ms.expires_in,
      iat: Date.now(),
      exp: Date.now() + 5 * 60 * 1000,
    });

    const back = new URL(st.redirectUri);
    back.searchParams.set('code', authorizationCode);
    if (st.state) back.searchParams.set('state', st.state);
    return Response.redirect(back.toString(), 302);
  } catch (err) {
    return oauthError('server_error', err.message || 'Microsoft callback failed', 500);
  }
}
