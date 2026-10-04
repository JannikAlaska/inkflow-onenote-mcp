import { issueDcrClient } from '../../../lib/oauth.js';
import { json, oauthError } from '../../../lib/http.js';

export async function POST(req) {
  try {
    const body = await req.json();
    const clientId = issueDcrClient({
      redirectUris: body.redirect_uris,
      clientName: body.client_name,
    });
    return json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }, 201);
  } catch (err) {
    return oauthError('invalid_client_metadata', err.message || 'Invalid registration request');
  }
}
