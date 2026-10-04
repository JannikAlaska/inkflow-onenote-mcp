import { json, originFromRequest } from '../../../lib/http.js';

export async function GET(req) {
  const origin = originFromRequest(req);
  return json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ['onenote.readwrite'],
    bearer_methods_supported: ['header'],
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    },
  });
}
