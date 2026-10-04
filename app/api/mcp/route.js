import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import {
  appendHtml,
  fetchPageImages,
  getPageContent,
  getPagePreview,
  listRecentPages,
  transcriptionHtml,
} from '../../../lib/microsoft.js';
import { verifyLocalAccessToken } from '../../../lib/oauth.js';

function authFromContext(ctx) {
  const authInfo = ctx?.http?.authInfo;
  const graphAccessToken = authInfo?.extra?.graphAccessToken;
  if (!graphAccessToken) throw new Error('Microsoft Graph authorization is missing');
  return graphAccessToken;
}

function textResult(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'onenote_list_recent_pages',
      {
        title: 'List recent OneNote pages',
        description: 'List the most recently modified OneNote pages for the signed-in Microsoft user.',
        inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
        annotations: { readOnlyHint: true },
      },
      async ({ limit }, ctx) => {
        const token = authFromContext(ctx);
        const data = await listRecentPages(token, limit);
        return textResult(data);
      },
    );

    server.registerTool(
      'onenote_get_page_content',
      {
        title: 'Get OneNote page content',
        description: 'Read a OneNote page as HTML, including generated element IDs for later page updates.',
        inputSchema: z.object({ page_id: z.string().min(1) }),
        annotations: { readOnlyHint: true },
      },
      async ({ page_id }, ctx) => {
        const token = authFromContext(ctx);
        return textResult(await getPageContent(token, page_id));
      },
    );

    server.registerTool(
      'onenote_get_page_preview',
      {
        title: 'Get OneNote page preview',
        description: 'Return Microsoft Graph preview text for a OneNote page.',
        inputSchema: z.object({ page_id: z.string().min(1) }),
        annotations: { readOnlyHint: true },
      },
      async ({ page_id }, ctx) => {
        const token = authFromContext(ctx);
        return textResult(await getPagePreview(token, page_id));
      },
    );

    server.registerTool(
      'onenote_get_page_images',
      {
        title: 'Get images from a OneNote page',
        description: 'Load image resources referenced by a OneNote page so the host model can inspect handwriting or photographed notes.',
        inputSchema: z.object({
          page_id: z.string().min(1),
          max_images: z.number().int().min(1).max(12).default(8),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ page_id, max_images }, ctx) => {
        const token = authFromContext(ctx);
        const { images } = await fetchPageImages(token, page_id, max_images);
        if (!images.length) {
          return textResult('No image resources were found in the OneNote page HTML. Native ink may not be exposed as an image by Microsoft Graph.');
        }
        return {
          content: [
            { type: 'text', text: `Found ${images.length} OneNote image resource(s).` },
            ...images.map((img) => ({ type: 'image', data: img.data, mimeType: img.mimeType })),
          ],
        };
      },
    );

    server.registerTool(
      'onenote_append_transcription',
      {
        title: 'Append transcription to OneNote page',
        description: 'Append a clearly separated “Transkription (KI)” block to the bottom of a OneNote page without replacing the original content.',
        inputSchema: z.object({
          page_id: z.string().min(1),
          transcription: z.string().min(1).max(50000),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async ({ page_id, transcription }, ctx) => {
        const token = authFromContext(ctx);
        await appendHtml(token, page_id, transcriptionHtml(transcription));
        return textResult({ ok: true, page_id, appended: 'Transkription (KI)' });
      },
    );
  },
  {
    serverInfo: { name: 'inkflow-onenote', version: '0.1.0' },
    instructions: 'Access the signed-in user’s OneNote through Microsoft Graph. Preserve original handwriting and use append-only transcription writes.',
  },
);

async function verifyToken(_req, bearerToken) {
  if (!bearerToken) return undefined;
  try {
    const parsed = verifyLocalAccessToken(bearerToken);
    return {
      token: bearerToken,
      scopes: String(parsed.scope || 'onenote.readwrite').split(/\s+/).filter(Boolean),
      clientId: parsed.clientId || 'mcp-client',
      extra: { graphAccessToken: parsed.graphAccessToken },
    };
  } catch {
    return undefined;
  }
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['onenote.readwrite'],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authHandler as GET, authHandler as POST };
