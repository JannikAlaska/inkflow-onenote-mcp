# InkFlow OneNote MCP

Remote MCP connector for OneNote via Microsoft Graph. It is designed for the InkFlow private ChatGPT plugin.

## What it exposes

- `onenote_list_recent_pages`
- `onenote_get_page_content`
- `onenote_get_page_preview`
- `onenote_get_page_images`
- `onenote_append_transcription`

The server uses delegated Microsoft Graph access (`Notes.ReadWrite`). It does **not** use app-only OneNote access.

## Microsoft Entra app settings

Use the existing Application (client) ID:

`657b8a49-f601-40f4-993e-21ae71267f50`

Recommended configuration:

1. **Supported account types**: Accounts in any organizational directory (multitenant), because the OneNote notebooks are in a university Microsoft 365 account.
2. **API permissions → Microsoft Graph → Delegated permissions**: `Notes.ReadWrite`.
3. Add a **Web** redirect URI after deployment:
   `https://YOUR-HOST/oauth/microsoft/callback`
4. Create a client secret and store it only as `MICROSOFT_CLIENT_SECRET` on the host. Do not paste it into chat or commit it.

If your university blocks user consent to external apps, the Microsoft login can still fail with an admin-approval message even though the app itself lives in your own tenant.

## Required environment variables

```text
MICROSOFT_CLIENT_ID=657b8a49-f601-40f4-993e-21ae71267f50
MICROSOFT_CLIENT_SECRET=<secret from Entra>
TOKEN_ENCRYPTION_KEY=<32 random bytes as base64>
APP_BASE_URL=https://YOUR-HOST
MICROSOFT_TENANT=organizations
```

Generate the encryption key locally with:

```bash
openssl rand -base64 32
```

## Why TOKEN_ENCRYPTION_KEY exists

The connector is stateless. Its own OAuth access/refresh tokens are AES-256-GCM sealed and can carry the delegated Microsoft token material without a separate token database. ChatGPT never receives a plain Microsoft refresh token.

## Local run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

For a local Microsoft test, add `http://localhost:3000/oauth/microsoft/callback` as an additional Web redirect URI in the Entra app registration.

## Vercel deployment

Push this folder to a private Git repository and create a Vercel project from it. Add the environment variables above to Production and Preview. After the production URL is known, set `APP_BASE_URL` and add the exact Microsoft callback URI in Entra.

The MCP URL for InkFlow will be:

`https://YOUR-HOST/api/mcp`

## Important OneNote handwriting limitation

Microsoft Graph exposes OneNote page HTML and binary image resources. `onenote_get_page_images` can send image resources to the host model for handwriting recognition. Native OneNote ink is not guaranteed to appear as a retrievable image resource. If Microsoft Graph only exposes the native ink structure without a usable image, an additional rendering strategy will be needed for those pages.
