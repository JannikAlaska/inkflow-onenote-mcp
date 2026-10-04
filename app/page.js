export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 760, margin: '48px auto', padding: 24 }}>
      <h1>InkFlow OneNote MCP</h1>
      <p>Private connector between ChatGPT/MCP and Microsoft OneNote through Microsoft Graph.</p>
      <ul>
        <li>MCP endpoint: <code>/api/mcp</code></li>
        <li>OAuth metadata: <code>/.well-known/oauth-authorization-server</code></li>
        <li>Protected resource metadata: <code>/.well-known/oauth-protected-resource</code></li>
        <li>Microsoft callback: <code>/oauth/microsoft/callback</code></li>
      </ul>
      <p>The Microsoft account is selected during OAuth sign-in. No Microsoft password is stored by this app.</p>
    </main>
  );
}
