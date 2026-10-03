import { useState } from 'react';
import {
  BookOpen, Rocket, Boxes, ShieldAlert, Bot, Plug, Webhook, Settings2, Keyboard, Copy, Check, Info, AlertTriangle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ── Small building blocks ─────────────────────────────────────────────────────

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{label ?? 'shell'}</span>
        <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy to clipboard">
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div className={`flex gap-2.5 rounded-lg border p-3 text-sm ${tone === 'warning' ? 'border-warning/30 bg-warning/10' : 'bg-muted/40'}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}`} />
      <div>{children}</div>
    </div>
  );
}

const K = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</kbd>
);
const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
);
const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

// ── Tabs ──────────────────────────────────────────────────────────────────────

const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-threatatlas-instance';

function GettingStarted() {
  return (
    <div className="space-y-6">
      <Section icon={Rocket} title="Welcome to ThreatAtlas" description="A platform for community-driven, AI-assisted threat modeling.">
        <P>
          ThreatAtlas helps engineering and security teams model how a system works, find what can go wrong, decide what to do
          about it, and keep that record up to date. The basic workflow is:
        </P>
        <Steps items={[
          <><strong>Create a product</strong> – the system you want to threat-model.</>,
          <><strong>Draw a data flow diagram</strong> – processes, data stores, external entities, data flows and trust boundaries.</>,
          <><strong>Identify threats</strong> – pick a framework (for example STRIDE) and attach threats from the knowledge base, or let the AI assistant propose them.</>,
          <><strong>Assess and mitigate</strong> – score likelihood and impact, link mitigations, then reassess the residual risk.</>,
          <><strong>Review and report</strong> – get approvals for accepted risks, track posture on the dashboard, and export reports or gate CI pipelines.</>,
        ]} />
      </Section>

      <Section icon={BookOpen} title="First login and account basics">
        <Bullets items={[
          <>Self-registration is disabled. A default administrator account is created on first start (see the installation guide). <strong>Change its password immediately.</strong></>,
          <>Administrators invite new users from <strong>Settings → Team</strong>. The invitation link is sent by email, so SMTP must be configured.</>,
          <>Change your own password from the account menu at the bottom of the sidebar. The same menu switches between light, dark and system themes.</>,
          <>If your organization uses single sign-on or a directory, the login page shows a button for each enabled provider.</>,
        ]} />
        <Note tone="warning">
          Keep at least one local administrator account even if you use SSO or LDAP. Accounts linked to a directory can no longer sign in with a local password.
        </Note>
      </Section>

      <Section icon={BookOpen} title="Where things are" description="The sidebar is the main way to move around.">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-44">Page</TableHead><TableHead>What it is for</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {[
              ['Dashboard', 'All threats across every product, with severity and status filters and summary statistics.'],
              ['Products', 'Create and manage products; open a product to see its diagrams, threats, mitigations and analytics.'],
              ['Analytics', 'Global charts: risk matrix, severity and status breakdowns, risk trend and inherent versus residual comparisons.'],
              ['Approvals', 'Risk acceptances assigned to you for formal review. A badge shows how many are pending.'],
              ['Knowledge Base', 'The library of threats and mitigations per framework, including your own custom entries.'],
              ['Component Library', 'Pre-built architecture components that come with threats and mitigations already linked.'],
              ['Settings', 'Team, SSO and SCIM, AI model, integrations and audit log (some tabs are admin-only).'],
              ['Changelog / About', 'Release notes and project information.'],
            ].map(([page, desc]) => (
              <TableRow key={page}>
                <TableCell className="font-medium">{page}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{desc}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <P>Press <K>⌘</K> <K>K</K> (or <K>Ctrl</K> <K>K</K>) anywhere to search products, diagrams, threats and mitigations.</P>
      </Section>
    </div>
  );
}

function Modeling() {
  return (
    <div className="space-y-6">
      <Section icon={Boxes} title="Products" description="A product is the top-level system you threat-model.">
        <Steps items={[
          <>Open <strong>Products</strong> and click <strong>New Product</strong>.</>,
          <>Enter a name and description, choose the frameworks you want to use, and optionally add details such as project status, repository and application URLs, business area and owner.</>,
          <>Click <strong>Create</strong>.</>,
        ]} />
        <Bullets items={[
          <><strong>Sharing:</strong> add collaborators with a chosen access level, or make the product public for read access.</>,
          <><strong>Duplicate:</strong> copy a product to start a new threat model from an existing one. Diagrams, models and threat and mitigation assignments are copied; statuses reset, and risk assessments, comments, history, collaborators and Jira settings are not.</>,
          <><strong>Downloads:</strong> from the product page, export diagrams (JSON), threats and mitigations (CSV), a printable HTML report, or everything as a ZIP.</>,
        ]} />
      </Section>

      <Section icon={Boxes} title="Data flow diagrams" description="Map your system, then attach threats to its elements.">
        <Steps items={[
          <>Open a product and click <strong>New Diagram</strong>. Start from a blank canvas, a template (web application, microservices, mobile with API, CI/CD pipeline) or import a Draw.io file.</>,
          <>Add elements from the left panel: processes, data stores, external entities and trust boundaries.</>,
          <>Drag from an element&apos;s edge handle to another element to create a data flow.</>,
          <>Click any element to open its properties and threats in the right panel.</>,
        ]} />
        <Bullets items={[
          <><strong>Version history:</strong> snapshots are saved as you work. Compare two versions, including threat and mitigation changes, or restore an older one.</>,
          <><strong>Collaboration:</strong> several people can edit at once with live cursors and presence indicators. Changes auto-save after a few seconds.</>,
          <><strong>Read-only access:</strong> viewers can inspect, export and view history, but cannot change the canvas, threats, mitigations or models.</>,
          <><strong>Heat map:</strong> toggle it in the toolbar to colour elements by their most severe threat.</>,
          <><strong>Import from Draw.io:</strong> upload a <C>.drawio</C> or <C>.xml</C> file and it is converted to an editable diagram. The AI can classify each element as a process, data store, external entity, data flow or trust boundary.</>,
        ]} />
      </Section>

      <Section icon={Boxes} title="Component library" description="Pre-built components with known threats and mitigations.">
        <P>
          The component library contains common architecture building blocks such as databases, queues, identity providers,
          containers, cloud services and CI/CD pipelines. Drag one from the diagram editor&apos;s left panel and ThreatAtlas
          proposes the threats and mitigations linked to that component for your active framework.
        </P>
        <Bullets items={[
          <>Open <strong>Component Library</strong> in the sidebar to browse components and their threat and mitigation relationships.</>,
          <>Administrators can edit components, add custom ones, and revert built-in components to their original content.</>,
        ]} />
      </Section>

      <Section icon={Boxes} title="Knowledge base and frameworks" description="The source of truth for threats and mitigations.">
        <P>
          The knowledge base is filled on first start and includes STRIDE, PASTA, LINDDUN, DREAD, VAST, OCTAVE, Trike,
          Attack Trees, Kill Chain, MITRE ATT&amp;CK, CVSS, OWASP ASVS and the OWASP Top 10 and LLM Top 10.
        </P>
        <Bullets items={[
          <>Choose a framework, then browse the <strong>Threats</strong> or <strong>Mitigations</strong> tab. Filter by category or search by name and description.</>,
          <>Add your own entries with <strong>Add Custom Threat</strong> or <strong>Add Custom Mitigation</strong>. Custom entries belong to their creator.</>,
          <>Edit or delete entries with the pencil and trash icons on each row.</>,
        ]} />
      </Section>
    </div>
  );
}

function Risk() {
  return (
    <div className="space-y-6">
      <Section icon={ShieldAlert} title="Threats and mitigations" description="Attached to individual diagram elements.">
        <Steps items={[
          <>Select a node or edge on the canvas.</>,
          <>In <strong>Threats</strong>, click <strong>Add Threat</strong>, search the knowledge base and add one.</>,
          <>Click the threat to open the details sheet. There you set likelihood and impact, change status, comment, and manage linked mitigations.</>,
          <>Click <strong>Add Mitigation</strong> to attach a control from the knowledge base, then move it from Proposed to Implemented to Verified.</>,
        ]} />
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Threat status: Identified</Badge>
          <Badge variant="outline">Mitigated</Badge>
          <Badge variant="outline">Accepted</Badge>
          <Badge variant="secondary">Mitigation status: Proposed</Badge>
          <Badge variant="secondary">Implemented</Badge>
          <Badge variant="secondary">Verified</Badge>
        </div>
      </Section>

      <Section icon={ShieldAlert} title="Inherent and residual risk" description="Two separate assessments, never mixed automatically.">
        <Bullets items={[
          <><strong>Inherent risk</strong> is likelihood × impact (each 1–5) before controls. It maps to a severity: low, medium, high or critical.</>,
          <><strong>Residual risk</strong> is a separate, manual reassessment after controls are in place. It needs a short rationale and never overwrites the inherent score.</>,
          <>Changing a mitigation&apos;s status does <em>not</em> change either score. If you change the inherent score, the old residual assessment is cleared because it is no longer valid.</>,
          <>Analytics compare inherent and residual scores and report the average change in score points.</>,
        ]} />
      </Section>

      <Section icon={ShieldAlert} title="Risk acceptance and approvals" description="A formal record when a risk is knowingly accepted.">
        <Steps items={[
          <>Set a threat&apos;s status to <strong>Accepted</strong>. A dialog asks for a justification, an optional approver and an optional review date.</>,
          <>The approver gets a notification and finds the item under <strong>Approvals</strong>.</>,
          <>The approver approves or rejects it, with a note. A rejection (a note is required) returns the threat to <em>Identified</em>.</>,
          <>The requester is notified of the decision. Every step is recorded in the audit log.</>,
        ]} />
        <P>The bell in the top bar shows unread notifications; the sidebar badge on Approvals shows how many items wait for you.</P>
      </Section>

      <Section icon={ShieldAlert} title="Dashboard and analytics">
        <Bullets items={[
          <><strong>Dashboard:</strong> every threat across all products. Filter by severity, status, product or diagram, then click a threat to open its details.</>,
          <><strong>Analytics:</strong> risk matrix (likelihood × impact), severity and mitigation charts, risk trend across diagram versions and a cross-product comparison.</>,
          <><strong>Product analytics:</strong> the same views scoped to one product, on its Analytics tab.</>,
        ]} />
      </Section>
    </div>
  );
}

function AiAssistant() {
  return (
    <div className="space-y-6">
      <Section icon={Bot} title="AI threat modeling assistant" description="A chat panel inside the diagram editor.">
        <P>
          The assistant reads your diagram and proposes threats and mitigations for each element and data flow using your
          selected framework. Nothing is added automatically: every proposal is shown as a card that you approve or dismiss.
        </P>
        <Bullets items={[
          <>Open a diagram and use the <strong>AI Analysis</strong> tab in the right panel.</>,
          <>Each proposal shows a confidence level (high, medium or low). The assistant can also propose removing duplicate or outdated threats.</>,
          <><strong>AI focus:</strong> right-click an element and choose <em>Set as AI Focus</em> to limit analysis to the elements you care about.</>,
          <><strong>Incremental analysis:</strong> banners point out elements that are not yet analysed or were added since the last save, with one-click targeted analysis.</>,
          <>Conversations are stored per diagram and are restored the next time you open it.</>,
        ]} />
      </Section>

      <Section icon={Bot} title="Configuring the AI model (administrators)" description="Settings → AI Model">
        <Steps items={[
          <>Choose a provider: OpenAI, Anthropic, or an OpenAI-compatible endpoint (set the base URL).</>,
          <>Enter the model name and API key. Keys are stored encrypted.</>,
          <>Adjust temperature and maximum tokens if needed.</>,
          <>Click <strong>Test Connection</strong>. The result explains problems such as missing credits, an invalid key or an unknown model.</>,
          <>Click <strong>Save Configuration</strong>.</>,
        ]} />
        <P>The same page shows token consumption so you can keep an eye on usage.</P>
        <Note>
          Behind a corporate proxy with an internal certificate authority, set <C>AI_CA_BUNDLE_PATH</C> in the backend environment so the AI provider&apos;s TLS certificate is trusted.
        </Note>
      </Section>
    </div>
  );
}

function Mcp() {
  const endpoint = `${origin}/mcp/`;
  const oauthConfig = JSON.stringify({ mcpServers: { threatatlas: { url: endpoint } } }, null, 2);
  const tokenConfig = JSON.stringify({
    mcpServers: { threatatlas: { url: endpoint, headers: { Authorization: 'Bearer ta_xxxxxxxxxxxxxxxx' } } },
  }, null, 2);

  const tools: [string, string][] = [
    ['Products', 'list_products, get_product, create_product, update_product, delete_product'],
    ['Diagrams', 'list_diagrams, get_diagram, create_diagram, update_diagram, delete_diagram'],
    ['Frameworks and models', 'list_frameworks, create_custom_framework, list_diagram_models, create_diagram_model'],
    ['Threats', 'list_diagram_threats, list_threats, create_custom_threat, identify_threat_on_diagram, update_diagram_threat, delete_diagram_threat'],
    ['Mitigations', 'list_diagram_mitigations, list_knowledge_base_mitigations, create_custom_mitigation, add_mitigation_to_diagram, update_diagram_mitigation_status, remove_mitigation_from_diagram'],
    ['Component templates', 'list_component_templates, create_component_template (administrators only), apply_component_template'],
    ['Search and risk', 'search_threatatlas, get_product_security_status'],
  ];

  return (
    <div className="space-y-6">
      <Section icon={Plug} title="MCP server" description="Connect Claude Code, Claude.ai, Claude Desktop or any MCP client to your threat models.">
        <P>
          ThreatAtlas includes a built-in Model Context Protocol server. An assistant can list products, draw diagrams,
          identify threats, manage mitigations and read the security posture, instead of you pasting diagrams into a chat.
          Every call uses the same permission checks and audit logging as the web app and is attributed to the person who
          authorized it. There is no separate AI role: an assistant can only do what that person can do in the browser.
        </P>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Endpoint for this instance</p>
          <CodeBlock code={endpoint} label="url" />
          <p className="text-xs text-muted-foreground">Keep the trailing slash. It uses the Streamable HTTP transport.</p>
        </div>
      </Section>

      <Section icon={Plug} title="Authentication" description="Two options, one for interactive clients and one for headless use.">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader><CardTitle className="text-sm">OAuth 2.1 (recommended)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <P>Point a client that supports MCP OAuth at the endpoint. It opens your browser to a ThreatAtlas sign-in and consent screen. Approve it and the client receives a scoped token.</P>
              <P>Access tokens last 1 hour and refresh tokens 30 days. Compliant clients refresh silently.</P>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader><CardTitle className="text-sm">Personal API token</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <P>For clients without OAuth or for CI. Create a token under <strong className="text-foreground">Settings → Integrations → API Tokens</strong> and send it as a bearer token.</P>
              <P>Tokens start with <C>ta_</C> and are shown once. Revoke them from the same screen if they leak.</P>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section icon={Plug} title="Configure a client">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Claude Code (one command)</p>
            <CodeBlock code={`claude mcp add --transport http threatatlas ${endpoint}`} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">JSON configuration with OAuth</p>
            <CodeBlock code={oauthConfig} label="json" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">JSON configuration with an API token</p>
            <CodeBlock code={tokenConfig} label="json" />
          </div>
        </div>
      </Section>

      <Section icon={Plug} title="Available tools">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-48">Area</TableHead><TableHead>Tools</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {tools.map(([area, list]) => (
              <TableRow key={area}>
                <TableCell className="font-medium align-top">{area}</TableCell>
                <TableCell className="whitespace-normal font-mono text-xs text-muted-foreground">{list}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <P>
          Example prompt: <em>&ldquo;Draw a diagram for the Payments API with an API gateway, a service and a database,
          apply the matching component templates, then tell me whether it passes our security gate.&rdquo;</em>
        </P>
      </Section>

      <Section icon={Plug} title="Self-hosting and troubleshooting">
        <Bullets items={[
          <>Set <C>BACKEND_BASE_URL</C> in the backend environment to the public address your MCP clients use, including scheme. It is the OAuth issuer and must match exactly.</>,
          <><strong>Login loops or discovery errors:</strong> check that <C>BACKEND_BASE_URL</C> matches the origin the client uses, including any reverse-proxy path rewriting.</>,
          <><strong>401 on every call:</strong> the token expired (OAuth access tokens last 1 hour) or was revoked. Sign in again or create a new API token.</>,
          <><strong>Permission errors:</strong> they mirror the web app. If you cannot open the product in the browser, the assistant cannot either.</>,
        ]} />
      </Section>
    </div>
  );
}

function Integrations() {
  const gate = `curl -sf -H "Authorization: Bearer $THREATATLAS_TOKEN" \\
  "${origin}/api/products/$PRODUCT_ID/security-status?fail_on_critical=true&fail_on_unmitigated_high=true&min_mitigation_ratio=0.7"`;
  const gateResponse = `{
  "product_id": 1,
  "product_name": "Payments API",
  "summary": {
    "total_threats": 24,
    "by_severity": { "critical": 0, "high": 3, "medium": 8, "low": 13, "unscored": 0 },
    "mitigated_threats": 19,
    "mitigation_ratio": 0.79
  },
  "pass": false,
  "failures": ["3 high/critical threat(s) have no active mitigation"]
}`;
  const reports = `# Markdown report (GitHub job summary, Confluence, PR comments)
curl -sf -H "Authorization: Bearer $THREATATLAS_TOKEN" \\
  "${origin}/api/products/$PRODUCT_ID/download/report.md" > threat-model.md

# Word document (audit deliverables)
curl -sf -H "Authorization: Bearer $THREATATLAS_TOKEN" \\
  "${origin}/api/products/$PRODUCT_ID/download/report.docx" > threat-model.docx`;

  return (
    <div className="space-y-6">
      <Section icon={Webhook} title="API tokens" description="Settings → Integrations → API Tokens">
        <Bullets items={[
          <>Create long-lived tokens for pipelines and other machine-to-machine access. They start with <C>ta_</C>.</>,
          <>A token is shown <strong>only once</strong>. Copy it straight into your secret store.</>,
          <>Send it as <C>Authorization: Bearer &lt;token&gt;</C>. Tokens act with the permissions of the user who created them.</>,
          <>Interactive API documentation is available on the backend at <C>/docs</C>.</>,
        ]} />
      </Section>

      <Section icon={Webhook} title="CI/CD security gate" description="Fail a pipeline when a threat model crosses your risk thresholds.">
        <P>
          The security status endpoint returns the product&apos;s posture as JSON. It always answers HTTP 200, so check the
          <C>pass</C> field rather than the status code. Store the token as a CI secret named <C>THREATATLAS_TOKEN</C>.
        </P>
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-64">Parameter</TableHead><TableHead>Effect</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell><C>fail_on_critical</C></TableCell><TableCell className="whitespace-normal text-muted-foreground">pass is false if any critical threat exists.</TableCell></TableRow>
            <TableRow><TableCell><C>fail_on_unmitigated_high</C></TableCell><TableCell className="whitespace-normal text-muted-foreground">pass is false if a high or critical threat has no active mitigation.</TableCell></TableRow>
            <TableRow><TableCell><C>min_mitigation_ratio</C></TableCell><TableCell className="whitespace-normal text-muted-foreground">pass is false if the mitigated ratio (0.0 to 1.0) is below this value.</TableCell></TableRow>
          </TableBody>
        </Table>
        <CodeBlock code={gate} />
        <CodeBlock code={gateResponse} label="json" />
        <P>
          Settings → Integrations → CI/CD has ready-made snippets for GitHub Actions, GitLab CI, Azure DevOps, Jenkins and
          Bitbucket. Start in report-only mode without thresholds, then enable them once teams have triaged their threats.
        </P>
      </Section>

      <Section icon={Webhook} title="Reports">
        <CodeBlock code={reports} />
      </Section>

      <Section icon={Webhook} title="Jira" description="Settings → Integrations → Connections">
        <Steps items={[
          <>Enter your Jira URL (for example <C>https://yourcompany.atlassian.net</C>), account email and API token, then save.</>,
          <>Set the Jira project key on the product if it should be different.</>,
          <>Use <strong>Create JIRA Issue</strong> on a threat card to push that threat to Jira as an issue.</>,
        ]} />
      </Section>
    </div>
  );
}

function Administration() {
  const tls = `docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d`;
  const envs: [string, string][] = [
    ['SECRET_KEY', 'Long random string used to sign tokens and encrypt stored secrets. Change it for any shared deployment.'],
    ['POSTGRES_PASSWORD', 'Database password. Change the default before production use.'],
    ['SMTP_*', 'Mail server settings. Required for invitation emails.'],
    ['FRONTEND_URL / CORS_ORIGINS', 'Public address of the web app. Needed for invitation links, SSO and cookies behind a proxy.'],
    ['BACKEND_BASE_URL', 'Public origin of the backend. Required for the MCP server and its OAuth flow.'],
    ['VITE_API_URL', 'Leave empty to use the same origin as the frontend. Set only if the API is on a separate public origin (build-time).'],
    ['AI_CA_BUNDLE_PATH', 'Path to a CA bundle for AI providers behind a corporate proxy.'],
    ['DEBUG', 'Set to False in production.'],
  ];

  return (
    <div className="space-y-6">
      <Section icon={Settings2} title="Roles and groups" description="Settings → Team">
        <Bullets items={[
          <><strong>Admin:</strong> manages users, SSO, AI model, integrations and sees the audit log.</>,
          <><strong>Standard:</strong> creates and edits products, diagrams, threats and mitigations they have access to.</>,
          <><strong>Read only:</strong> can view but not change anything.</>,
          <><strong>Groups</strong> grant a role to their members. A person&apos;s effective role is the most permissive of their direct role and any group role.</>,
          <>Product sharing adds per-product access on top of the global role.</>,
        ]} />
      </Section>

      <Section icon={Settings2} title="Single sign-on, directory and provisioning" description="Settings → SSO & SCIM (administrators)">
        <Bullets items={[
          <><strong>OIDC:</strong> add providers such as Microsoft Entra ID, Okta, Keycloak, Auth0 or Google. Each enabled provider appears on the login page. Client secrets are stored encrypted.</>,
          <><strong>LDAP / Active Directory:</strong> add a directory provider. Users sign in with their directory username; ThreatAtlas checks the password against the directory and never stores it. The first sign-in creates or links an account by email.</>,
          <><strong>SCIM 2.0:</strong> let your identity provider create users and groups automatically at <C>/scim/v2</C>. Generate a SCIM token under <em>SCIM Tokens</em>; it is shown once.</>,
        ]} />
        <Note>Step-by-step guides for LDAP, Keycloak SCIM and TLS are in the project&apos;s <C>docs/</C> folder.</Note>
      </Section>

      <Section icon={Settings2} title="Configuration reference" description="Environment variables in your .env file.">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-64">Variable</TableHead><TableHead>Purpose</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {envs.map(([name, desc]) => (
              <TableRow key={name}>
                <TableCell className="align-top"><C>{name}</C></TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{desc}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <P>Default Docker Compose ports: web app 3001, backend API 8001, Redis 6380 and PostgreSQL 5432. Override them with <C>FRONTEND_PORT</C>, <C>BACKEND_PORT</C>, <C>REDIS_PORT</C> and <C>POSTGRES_PORT</C>.</P>
      </Section>

      <Section icon={Settings2} title="HTTPS" description="Optional TLS overlay with a Caddy reverse proxy.">
        <P>
          The TLS overlay terminates HTTPS on port 443 and redirects port 80. It supports three modes through one variable:
          a self-signed certificate for development, your own certificate from an internal CA, or automatic Let&apos;s Encrypt for public sites.
        </P>
        <CodeBlock code={tls} />
      </Section>

      <Section icon={Settings2} title="Audit log" description="Settings → Audit Log (administrators)">
        <P>A live, terminal-style view of system activity across the platform, including changes to products, diagrams and threats and approval decisions.</P>
      </Section>
    </div>
  );
}

function ShortcutsAndHelp() {
  const shortcuts: [React.ReactNode, string][] = [
    [<><K>⌘</K> / <K>Ctrl</K> + <K>K</K></>, 'Open global search'],
    [<><K>⌘</K> / <K>Ctrl</K> + <K>C</K></>, 'Copy the selected diagram elements'],
    [<><K>⌘</K> / <K>Ctrl</K> + <K>V</K></>, 'Paste copied elements'],
    [<><K>⌘</K> / <K>Ctrl</K> + <K>D</K></>, 'Duplicate the selection'],
    [<><K>⌘</K> / <K>Ctrl</K> + <K>A</K></>, 'Select all elements'],
    [<><K>Delete</K> / <K>Backspace</K></>, 'Delete the selected elements'],
    [<K>Esc</K>, 'Close menus and dialogs'],
    [<>Right-click</>, 'Canvas menu: copy, duplicate, paste, select all, delete, add element here, set AI focus'],
  ];

  const faqs: [string, React.ReactNode][] = [
    ['A container will not start', <>Check its logs, for example <C>docker compose logs backend</C>, <C>docker compose logs postgres</C> or <C>docker compose logs frontend</C>, and confirm the state with <C>docker compose ps</C>.</>],
    ['I cannot open the app', <>Make sure Docker is running, the frontend container is up and the port is free. The default is 3001. Change <C>FRONTEND_PORT</C> in <C>.env</C> if it clashes, then run <C>docker compose up -d</C>.</>],
    ['The backend shows errors or data is empty', <>Read <C>docker compose logs backend</C> and confirm Postgres is healthy. If migrations failed on first start, run <C>docker compose exec backend pdm run migrate</C>.</>],
    ['The knowledge base is empty', <>It is seeded on startup. Check the backend logs for seeding errors. If the backend started before migrations finished, run <C>docker compose restart backend</C>.</>],
    ['Invitation emails are not arriving', <>Configure the <C>SMTP_*</C> settings in <C>.env</C> and restart the backend. You can also copy the invitation link manually.</>],
    ['AI Test Connection fails', <>The result card explains the cause: no credits, invalid key, unknown model, rate limit or an unreachable endpoint. Open &ldquo;Technical details&rdquo; for the provider&apos;s raw message.</>],
    ['I cannot edit a diagram', <>You may have view-only access to the product or a read-only role. Ask the product owner for editor access.</>],
    ['Start completely fresh', <><C>docker compose down -v</C> removes containers and all data, then <C>docker compose up -d</C> starts clean. This permanently deletes your data.</>],
  ];

  return (
    <div className="space-y-6">
      <Section icon={Keyboard} title="Keyboard shortcuts">
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-64">Keys</TableHead><TableHead>Action</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {shortcuts.map(([keys, action], i) => (
              <TableRow key={i}>
                <TableCell>{keys}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section icon={Info} title="Troubleshooting and FAQ">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map(([q, a], i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'start', label: 'Getting started', icon: Rocket, content: <GettingStarted /> },
  { id: 'modeling', label: 'Modeling', icon: Boxes, content: <Modeling /> },
  { id: 'risk', label: 'Risk & approvals', icon: ShieldAlert, content: <Risk /> },
  { id: 'ai', label: 'AI assistant', icon: Bot, content: <AiAssistant /> },
  { id: 'mcp', label: 'MCP', icon: Plug, content: <Mcp /> },
  { id: 'integrations', label: 'Integrations', icon: Webhook, content: <Integrations /> },
  { id: 'admin', label: 'Administration', icon: Settings2, content: <Administration /> },
  { id: 'help', label: 'Shortcuts & help', icon: Keyboard, content: <ShortcutsAndHelp /> },
];

export default function UserGuide() {
  return (
    <div className="flex-1 w-full min-h-0 space-y-6 p-4 md:p-6 lg:p-8">
      <Tabs defaultValue="start" className="gap-6">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ id, content }) => (
          <TabsContent key={id} value={id} className="w-full">
            {content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
