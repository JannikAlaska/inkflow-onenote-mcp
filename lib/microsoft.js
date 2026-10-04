const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

export const MICROSOFT_CLIENT_ID =
  process.env.MICROSOFT_CLIENT_ID || '657b8a49-f601-40f4-993e-21ae71267f50';

const tenant = process.env.MICROSOFT_TENANT || 'organizations';
export const MS_AUTHORIZE_URL = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
export const MS_TOKEN_URL = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

export const MS_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'Notes.ReadWrite',
];

export async function exchangeMicrosoftCode({ code, redirectUri, codeVerifier }) {
  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: MS_SCOPES.join(' '),
  });
  if (process.env.MICROSOFT_CLIENT_SECRET) {
    body.set('client_secret', process.env.MICROSOFT_CLIENT_SECRET);
  }
  return microsoftTokenRequest(body);
}

export async function refreshMicrosoftToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: MS_SCOPES.join(' '),
  });
  if (process.env.MICROSOFT_CLIENT_SECRET) {
    body.set('client_secret', process.env.MICROSOFT_CLIENT_SECRET);
  }
  return microsoftTokenRequest(body);
}

async function microsoftTokenRequest(body) {
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Microsoft token error ${res.status}`);
  }
  if (!data.access_token) throw new Error('Microsoft did not return an access token');
  return data;
}

export async function graphFetch(accessToken, pathOrUrl, init = {}) {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH_ROOT}${pathOrUrl}`;
  const parsed = new URL(url);
  if (parsed.origin !== 'https://graph.microsoft.com') {
    throw new Error('Refusing to call a non-Microsoft Graph URL');
  }
  const headers = new Headers(init.headers || {});
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', headers.get('accept') || 'application/json');
  const res = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Microsoft Graph ${res.status}: ${text.slice(0, 800)}`);
  }
  return res;
}

export async function listRecentPages(accessToken, limit = 10) {
  const top = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const params = new URLSearchParams({
    '$top': String(top),
    '$orderby': 'lastModifiedDateTime desc',
    '$expand': 'parentNotebook,parentSection',
  });
  const res = await graphFetch(accessToken, `/me/onenote/pages?${params}`);
  return res.json();
}

export async function getPageContent(accessToken, pageId) {
  const res = await graphFetch(
    accessToken,
    `/me/onenote/pages/${encodeURIComponent(pageId)}/content?includeIDs=true`,
    { headers: { accept: 'text/html' } },
  );
  return res.text();
}

export async function getPagePreview(accessToken, pageId) {
  const res = await graphFetch(
    accessToken,
    `/me/onenote/pages/${encodeURIComponent(pageId)}/preview`,
  );
  return res.json();
}

function htmlAttr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  return tag.match(re)?.[1] || null;
}

export function extractGraphImageUrls(html) {
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  const urls = [];
  for (const tag of tags) {
    const candidate = htmlAttr(tag, 'data-fullres-src') || htmlAttr(tag, 'src');
    if (!candidate) continue;
    try {
      const u = new URL(candidate.replace(/&amp;/g, '&'));
      if (u.origin === 'https://graph.microsoft.com') urls.push(u.toString());
    } catch {
      // Ignore malformed/non-absolute image references.
    }
  }
  return [...new Set(urls)];
}

export async function fetchPageImages(accessToken, pageId, maxImages = 8) {
  const html = await getPageContent(accessToken, pageId);
  const urls = extractGraphImageUrls(html).slice(0, Math.min(Math.max(maxImages, 1), 12));
  const images = [];
  let totalBytes = 0;
  for (const url of urls) {
    const res = await graphFetch(accessToken, url, { headers: { accept: '*/*' } });
    const mimeType = (res.headers.get('content-type') || 'image/png').split(';')[0];
    if (!mimeType.startsWith('image/')) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    totalBytes += buf.length;
    if (totalBytes > 20 * 1024 * 1024) break;
    images.push({ mimeType, data: buf.toString('base64') });
  }
  return { images, html };
}

export async function appendHtml(accessToken, pageId, html) {
  const commands = [{ target: 'body', action: 'append', content: html }];
  await graphFetch(
    accessToken,
    `/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    {
      method: 'PATCH',
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
      },
      body: JSON.stringify(commands),
    },
  );
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function transcriptionHtml(text) {
  const safeLines = String(text)
    .split(/\r?\n/)
    .map((line) => `<div>${escapeHtml(line) || '<br>'}</div>`)
    .join('');
  return `<div data-id="inkflow-transcription"><hr/><h2>Transkription (KI)</h2>${safeLines}</div>`;
}
