export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function oauthError(error, description, status = 400) {
  return json({ error, error_description: description }, status);
}

export function originFromRequest(req) {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  return new URL(req.url).origin;
}
