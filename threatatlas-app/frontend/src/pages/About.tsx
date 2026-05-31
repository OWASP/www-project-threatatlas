import { Shield, GitBranch, Brain, Users, Zap, Lock, Globe, BookOpen, ExternalLink, Star, Code2, Activity, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const FEATURES = [
  { icon: Brain,     title: 'AI-Powered Analysis',       desc: 'Pydantic-AI agent with SSE streaming generates threat proposals across STRIDE, OWASP Top 10, PASTA, LINDDUN and more — every suggestion requires human approval.' },
  { icon: GitBranch, title: 'Live Collaboration',        desc: 'WebSocket-based real-time diagram editing with presence indicators and live cursors for distributed security teams.' },
  { icon: BookOpen,  title: 'Knowledge Base',            desc: 'Curated threat and mitigation library per framework, fully editable with custom entries and restorable to factory defaults.' },
  { icon: Lock,      title: 'Risk Acceptance Workflow',  desc: 'Formal accept / approve / reject lifecycle for accepted risks with an approvals dashboard and full audit trail.' },
  { icon: Users,     title: 'Team & SSO',                desc: 'Multi-tenant user management, role-based access control, and SAML/OIDC SSO with SCIM provisioning support.' },
  { icon: Zap,       title: 'CI/CD Integration',         desc: 'Machine-to-machine API tokens, GitHub / GitLab / Azure DevOps webhook recipes, and exportable threat reports.' },
  { icon: Globe,     title: 'Draw.io Import',            desc: 'Import existing architecture diagrams from Draw.io (.drawio / .xml) and enrich them instantly with threat metadata.' },
  { icon: Shield,    title: 'Component Library',         desc: '28 pre-built architecture components (AWS S3, API Gateway, etc.) each pre-loaded with KB-backed threats and mitigations.' },
];

const STACK = [
  { label: 'Frontend',  items: ['React 19', 'TypeScript', 'Vite', 'Tailwind CSS v4', 'shadcn/ui', 'ReactFlow v12'] },
  { label: 'Backend',   items: ['FastAPI', 'Python 3.12', 'Pydantic-AI', 'SQLAlchemy', 'Alembic'] },
  { label: 'Infra',     items: ['PostgreSQL', 'Redis', 'Docker Compose', 'Caddy (TLS)'] },
  { label: 'AI Models', items: ['GPT-5.4', 'GPT-5.4 mini', 'GPT-5.4 nano', 'Claude Sonnet 4.6', 'Claude Opus 4.7', 'Claude Haiku 4.5'] },
];


const STATS = [
  { value: '28+',  label: 'Built-in Components' },
  { value: '15',   label: 'Threat Frameworks' },
  { value: '∞',    label: 'AI Proposals' },
  { value: '100%', label: 'Human-Approved' },
];

export default function About() {
  return (
    <div className="w-full">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="px-8 py-16 flex items-center gap-6 relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20 shadow-lg shrink-0">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">ThreatAtlas</h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              An AI-assisted threat modeling platform for engineering and security teams —
              built to make structured security analysis fast, collaborative, and actionable.
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/50">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-6 px-4 gap-1">
              <span className="text-3xl font-bold text-primary">{value}</span>
              <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-12 space-y-14">

        {/* ── About ────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            About the Project
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            ThreatAtlas is an open-source, self-hosted threat modeling application designed for modern software teams.
            It combines Data Flow Diagram (DFD) editing with an AI chat interface that proposes threats and mitigations
            from a curated knowledge base — all aligned to industry-standard frameworks. Every AI proposal requires
            explicit human approval before it is committed, keeping security engineers in full control.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Teams can model multiple products, run multi-framework analyses in parallel, manage risk acceptance
            workflows, and integrate threat model exports into CI/CD pipelines — all from a single self-hosted platform.
          </p>
        </section>

        <Separator />

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="space-y-5">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Key Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 group">
                <CardContent className="p-5 space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Tech stack ───────────────────────────────────────────────── */}
        <section className="space-y-5">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Technology Stack
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {STACK.map(({ label, items }) => (
              <Card key={label} className="border-border/60">
                <CardContent className="p-5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(item => (
                      <Badge key={item} variant="secondary" className="text-xs font-normal">{item}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Team & Contributors ──────────────────────────────────────── */}
        <section className="space-y-5">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team & Contributors
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Card className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shrink-0 text-xl font-bold text-primary">
                  AY
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">Ali Yazdani</p>
                  <p className="text-xs text-muted-foreground mt-0.5">OWASP Project Leader</p>
                  <a
                    href="mailto:ali.yazdani@owasp.org"
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    ali.yazdani@owasp.org
                  </a>
                </div>
              </CardContent>
            </Card>

            <a
              href="https://github.com/OWASP/www-project-threatatlas/graphs/contributors?all=1"
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <Card className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 h-full">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shrink-0 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1">
                      Contributors
                      <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Everyone who built ThreatAtlas</p>
                    <span className="text-xs text-primary group-hover:underline mt-1 inline-flex items-center gap-1">
                      View on GitHub
                    </span>
                  </div>
                </CardContent>
              </Card>
            </a>
          </div>
        </section>

        <Separator />

        {/* ── Resources ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Resources
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'GitHub Repository',       href: 'https://github.com/OWASP/www-project-threatatlas' },
              { label: 'OWASP Project Page',      href: 'https://owasp.org/www-project-threatatlas/' },
              { label: 'OWASP Threat Modeling',   href: 'https://owasp.org/www-project-threat-modeling/' },
              { label: 'OWASP Top 10',            href: 'https://owasp.org/www-project-top-ten/' },
              { label: 'STRIDE Methodology',      href: 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {label}
              </a>
            ))}
          </div>
        </section>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>ThreatAtlas is an OWASP project — built with security engineering teams in mind. All AI proposals require human review before committing to the threat model.</span>
        </div>

      </div>
    </div>
  );
}
