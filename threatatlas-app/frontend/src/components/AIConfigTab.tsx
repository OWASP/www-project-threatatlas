import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, Loader2, Bot, CheckCircle2, Zap, ArrowDownToLine, ArrowUpFromLine, MessageSquare, RefreshCw, Plug, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { aiConfigApi } from '@/lib/api';

interface AIConfigData {
  id: number;
  provider: string;
  model_name: string;
  api_key_masked: string;
  base_url: string | null;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
}

const PROVIDER_MODELS: Record<string, { id: string; label: string }[]> = {
  openai: [
    // GPT-5.4 family (2026)
    { id: 'gpt-5.4',        label: 'GPT-5.4' },
    { id: 'gpt-5.4-mini',  label: 'GPT-5.4 Mini' },
    { id: 'gpt-5.4-nano',  label: 'GPT-5.4 Nano' },
  ],
  anthropic: [
    // Claude 4.x family (2025-2026)
    { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  openai_compatible: [],
};

// Cost in USD per 1M tokens — prefix-matched (longest prefix wins, so list specific before general)
const TOKEN_PRICING: Array<{ prefix: string; input: number; output: number; label: string }> = [
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  { prefix: 'gpt-5.5-pro',    input: 30.00, output: 180.00, label: 'GPT-5.5 Pro' },
  { prefix: 'gpt-5.5',        input: 5.00,  output: 30.00,  label: 'GPT-5.5' },
  { prefix: 'gpt-5.4-pro',    input: 30.00, output: 180.00, label: 'GPT-5.4 Pro' },
  { prefix: 'gpt-5.4-nano',   input: 0.20,  output: 1.25,   label: 'GPT-5.4 Nano' },
  { prefix: 'gpt-5.4-mini',   input: 0.75,  output: 4.50,   label: 'GPT-5.4 Mini' },
  { prefix: 'gpt-5.4',        input: 2.50,  output: 15.00,  label: 'GPT-5.4' },
  { prefix: 'gpt-4.1-nano',   input: 0.10,  output: 0.40,   label: 'GPT-4.1 Nano' },
  { prefix: 'gpt-4.1-mini',   input: 0.40,  output: 1.60,   label: 'GPT-4.1 Mini' },
  { prefix: 'gpt-4.1',        input: 2.00,  output: 8.00,   label: 'GPT-4.1' },
  { prefix: 'gpt-4o-mini',    input: 0.15,  output: 0.60,   label: 'GPT-4o Mini' },
  { prefix: 'gpt-4o',         input: 2.50,  output: 10.00,  label: 'GPT-4o' },
  { prefix: 'o4-mini',        input: 1.10,  output: 4.40,   label: 'o4 Mini' },
  { prefix: 'o3-mini',        input: 1.10,  output: 4.40,   label: 'o3 Mini' },
  { prefix: 'o3',             input: 10.00, output: 40.00,  label: 'o3' },
  { prefix: 'o1-mini',        input: 1.10,  output: 4.40,   label: 'o1 Mini' },
  { prefix: 'o1',             input: 15.00, output: 60.00,  label: 'o1' },
  // ── Anthropic ───────────────────────────────────────────────────────────────
  { prefix: 'claude-opus-4-7',   input: 5.00,  output: 25.00, label: 'Claude Opus 4.7' },
  { prefix: 'claude-sonnet-4-6', input: 3.00,  output: 15.00, label: 'Claude Sonnet 4.6' },
  { prefix: 'claude-haiku-4-5',  input: 1.00,  output: 5.00,  label: 'Claude Haiku 4.5' },
  // ── OpenAI-compatible (third-party / self-hosted) ───────────────────────────
  { prefix: 'deepseek-r1',          input: 0.55,  output: 2.19,  label: 'DeepSeek R1' },
  { prefix: 'deepseek-v3',          input: 0.27,  output: 1.10,  label: 'DeepSeek V3' },
  { prefix: 'deepseek-chat',        input: 0.14,  output: 0.28,  label: 'DeepSeek Chat' },
  { prefix: 'meta-llama/llama-3',   input: 0.18,  output: 0.18,  label: 'Llama 3' },
  { prefix: 'llama3',               input: 0.00,  output: 0.00,  label: 'Llama 3 (local)' },
  { prefix: 'llama-3',              input: 0.00,  output: 0.00,  label: 'Llama 3 (local)' },
  { prefix: 'mistral-large',        input: 2.00,  output: 6.00,  label: 'Mistral Large' },
  { prefix: 'mistral-small',        input: 0.10,  output: 0.30,  label: 'Mistral Small' },
  { prefix: 'mixtral',              input: 0.24,  output: 0.24,  label: 'Mixtral' },
  { prefix: 'mistral',              input: 0.25,  output: 0.25,  label: 'Mistral' },
  { prefix: 'qwen2.5-72b',          input: 0.23,  output: 0.40,  label: 'Qwen 2.5 72B' },
  { prefix: 'qwen2.5',              input: 0.07,  output: 0.12,  label: 'Qwen 2.5' },
  { prefix: 'gemma',                input: 0.00,  output: 0.00,  label: 'Gemma (local)' },
  { prefix: 'phi-4',                input: 0.00,  output: 0.00,  label: 'Phi-4 (local)' },
];

function lookupPricing(modelName: string) {
  if (!modelName) return null;
  const lower = modelName.toLowerCase();
  // Longest matching prefix wins (entries are ordered most-specific first)
  return TOKEN_PRICING.find((p) => lower.startsWith(p.prefix)) ?? null;
}

interface PerModelStats {
  provider: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  message_count: number;
}

interface TokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  message_count: number;
  conversation_count: number;
  provider: string | null;
  model_name: string | null;
  per_model: PerModelStats[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function modelCost(input: number, output: number, modelName: string): number | null {
  const pricing = lookupPricing(modelName);
  if (!pricing) return null;
  return (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;
}

function estimateTotalCost(stats: TokenStats): string | null {
  // Sum costs across each model's actual token counts for accuracy
  if (stats.per_model && stats.per_model.length > 0) {
    let total = 0;
    let anyPriced = false;
    for (const m of stats.per_model) {
      const c = modelCost(m.input_tokens, m.output_tokens, m.model_name);
      if (c !== null) { total += c; anyPriced = true; }
    }
    if (anyPriced) return total < 0.01 ? '<$0.01' : `$${total.toFixed(2)}`;
  }
  // Fallback: use active model price × total tokens (single-model case)
  if (!stats.model_name) return null;
  const c = modelCost(stats.input_tokens, stats.output_tokens, stats.model_name);
  if (c === null) return null;
  return c < 0.01 ? '<$0.01' : `$${c.toFixed(2)}`;
}

const PROVIDERS: Array<{
  id: 'openai' | 'anthropic' | 'openai_compatible';
  label: string;
  description: string;
  logo: string;
  logoPath: string;
  logoClass: string;
}> = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models via OpenAI API',
    logo: 'OA',
    logoPath: '/images/ai-providers/openai.svg',
    logoClass: 'bg-success/15 text-success ',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models via Anthropic API',
    logo: 'AN',
    logoPath: '/images/ai-providers/anthropic.svg',
    logoClass: 'bg-caution/15 text-caution ',
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI-Compatible',
    description: 'Custom endpoint (Ollama, LiteLLM, etc.)',
    logo: 'OC',
    logoPath: '/images/ai-providers/ollama.svg',
    logoClass: 'bg-info/15 text-info ',
  },
];

interface TestErrorInfo { title: string; description: string; actionUrl?: string; actionLabel?: string; raw: string }

/** Turn the raw provider error string into a short, readable explanation. */
function parseTestError(raw: string): TestErrorInfo {
  const text = raw.replace(/^Connection failed:\s*/i, '');
  const status = text.match(/status_code:\s*(\d{3})/)?.[1];
  const url = text.match(/https?:\/\/[^\s'"),]+/)?.[0]?.replace(/[.]+$/, '');
  const has = (s: string) => text.toLowerCase().includes(s);

  if (status === '429' && (has('insufficient_quota') || has('credit') || has('quota'))) {
    return { title: 'No credits remaining', description: 'The provider account has run out of credits. Add credits or use a different API key to continue.', actionUrl: url, actionLabel: 'Open billing', raw: text };
  }
  if (status === '429') return { title: 'Rate limit reached', description: 'The provider is limiting requests. Wait a moment and try again.', raw: text };
  if (status === '401' || has('invalid_api_key') || has('incorrect api key')) {
    return { title: 'Invalid API key', description: 'The provider rejected this key. Check that it is correct and still active.', raw: text };
  }
  if (status === '403') return { title: 'Access denied', description: 'This key does not have permission to use the selected model.', raw: text };
  if (status === '404' || has('model_not_found')) {
    return { title: 'Model not found', description: 'The selected model is not available for this account or endpoint.', raw: text };
  }
  if (has('timeout') || has('timed out') || has('connect')) {
    return { title: 'Could not reach the provider', description: 'Check the base URL and your network connection, then try again.', raw: text };
  }
  return { title: 'Connection failed', description: 'The provider returned an error. See the details below.', raw: text };
}

export default function AIConfigTab() {
  const [existing, setExisting] = useState<AIConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const [provider, setProvider] = useState('openai');
  const [modelName, setModelName] = useState('gpt-4o');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  useEffect(() => {
    loadConfig();
    loadTokenStats();
  }, []);

  const loadTokenStats = async () => {
    try {
      setStatsLoading(true);
      const res = await aiConfigApi.tokenStats();
      setTokenStats(res.data);
    } catch {
      // silently ignore — non-critical
    } finally {
      setStatsLoading(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey && !existing) {
      toast.error('Enter an API key to test');
      return;
    }
    if (provider === 'openai_compatible' && !baseUrl) {
      toast.error('Base URL is required for OpenAI-compatible providers');
      return;
    }
    try {
      setTestStatus('testing');
      setTestMessage('');
      await aiConfigApi.test({
        provider,
        model_name: modelName,
        api_key: apiKey || '____keep____',
        base_url: provider === 'openai_compatible' ? baseUrl : undefined,
        temperature,
        max_tokens: maxTokens,
      });
      setTestStatus('ok');
      setTestMessage('Connection successful');
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.response?.data?.detail || 'Connection failed');
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await aiConfigApi.get();
      if (res.data) {
        const cfg: AIConfigData = res.data;
        setExisting(cfg);
        setProvider(cfg.provider);
        setModelName(cfg.model_name);
        setApiKey('');  // never pre-fill; user must re-enter to change
        setBaseUrl(cfg.base_url || '');
        setTemperature(cfg.temperature);
        setMaxTokens(cfg.max_tokens);
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        toast.error('Failed to load AI configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey && !existing) {
      toast.error('API key is required');
      return;
    }
    if (provider === 'openai_compatible' && !baseUrl) {
      toast.error('Base URL is required for OpenAI-compatible providers');
      return;
    }
    try {
      setSaving(true);
      const payload: any = {
        provider,
        model_name: modelName,
        temperature,
        max_tokens: maxTokens,
        base_url: provider === 'openai_compatible' ? baseUrl : undefined,
      };
      if (apiKey) payload.api_key = apiKey;

      if (existing) {
        await aiConfigApi.update(existing.id, payload);
      } else {
        await aiConfigApi.create(payload);
      }
      toast.success('AI configuration saved');
      setApiKey('');
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const estimatedCost = tokenStats ? estimateTotalCost(tokenStats) : null;
  const pricingInfo = tokenStats?.model_name ? lookupPricing(tokenStats.model_name) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Provider Configuration
          </CardTitle>
          <CardDescription>
            Configure the AI provider used for automated threat modeling analysis.
            Supports OpenAI, Anthropic, and any OpenAI-compatible API endpoint.
            The API key is encrypted before storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Provider */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PROVIDERS.map((p) => {
                const selected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setModelName(PROVIDER_MODELS[p.id]?.[0]?.id ?? '');
                      setTestStatus('idle');
                    }}
                    className={[
                      'rounded-lg border p-2.5 text-left transition-all',
                      'hover:border-primary/40 hover:bg-muted/30',
                      selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/60',
                    ].join(' ')}
                    aria-pressed={selected}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold ${p.logoClass}`}>
                        <img
                          src={p.logoPath}
                          alt={`${p.label} logo`}
                          className="h-4 w-4 object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'inline';
                          }}
                        />
                        <span className="hidden">{p.logo}</span>
                      </div>
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 transition-opacity ${selected ? 'opacity-100 text-primary' : 'opacity-20 text-muted-foreground'}`}
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{p.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Base URL (openai_compatible only) */}
          {provider === 'openai_compatible' && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.your-provider.com/v1"
              />
              <p className="text-xs text-muted-foreground">
                Must be OpenAI-compatible (e.g. Ollama, LiteLLM, Together AI, Mistral, etc.)
              </p>
            </div>
          )}

          {/* Model */}
          <div className="space-y-2">
            <Label>Model</Label>
            {PROVIDER_MODELS[provider]?.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {PROVIDER_MODELS[provider].map((m) => {
                  const selected = modelName === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModelName(m.id)}
                      className={[
                        'rounded-lg border p-2.5 text-left transition-all',
                        'hover:border-primary/40 hover:bg-muted/30',
                        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/60',
                      ].join(' ')}
                      aria-pressed={selected}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold leading-snug">{m.label}</p>
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 transition-opacity ${selected ? 'opacity-100 text-primary' : 'opacity-20 text-muted-foreground'}`}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground font-mono truncate">{m.id}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. llama3.2, mistral-7b"
              />
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key {existing && <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>}</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={existing ? existing.api_key_masked : 'sk-...'}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Temperature</span>
              <span className="text-muted-foreground font-normal text-xs">{temperature.toFixed(1)}</span>
            </Label>
            <Slider
              min={0} max={2} step={0.1}
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Lower = more focused, Higher = more creative</p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label>Max Response Tokens</Label>
            <Input
              type="number"
              min={256}
              max={32000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Saving…' : 'Save Configuration'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setTestStatus('idle'); handleTest(); }}
              disabled={testStatus === 'testing'}
              className="w-full sm:w-auto"
            >
              {testStatus === 'testing'
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Plug className="h-4 w-4 mr-2" />}
              {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
            </Button>
            {testStatus === 'ok' && (
              <div role="status" className="flex w-full basis-full items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">Connection successful</p>
                  <p className="text-muted-foreground">The model responded and your settings are valid.</p>
                </div>
              </div>
            )}
            {testStatus === 'error' && (() => {
              const info = parseTestError(testMessage);
              return (
                <div role="alert" className="flex w-full basis-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{info.title}</p>
                      <p className="text-muted-foreground">{info.description}</p>
                    </div>
                    {info.actionUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={info.actionUrl} target="_blank" rel="noopener noreferrer">{info.actionLabel}</a>
                      </Button>
                    )}
                    <details className="group text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none hover:text-foreground">Technical details</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border bg-background p-2 font-mono">{info.raw}</pre>
                    </details>
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Token Consumption Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              Token Consumption
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadTokenStats}
              disabled={statsLoading}
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            Lifetime token usage across all AI conversations.
            {pricingInfo && (
              <span className="ml-1">
                Estimated cost based on <span className="font-medium">{pricingInfo.label}</span> pricing
                (${pricingInfo.input}/1M input · ${pricingInfo.output}/1M output).
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading && !tokenStats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tokenStats ? (
            <div className="space-y-4">
              {/* Main stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Input</span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{formatTokens(tokenStats.input_tokens)}</p>
                  <p className="text-[11px] text-muted-foreground">tokens</p>
                </div>
                <div className="rounded-xl border border-border/60 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Output</span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{formatTokens(tokenStats.output_tokens)}</p>
                  <p className="text-[11px] text-muted-foreground">tokens</p>
                </div>
                <div className="rounded-xl border border-border/60 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Usage</span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{tokenStats.conversation_count}</p>
                  <p className="text-[11px] text-muted-foreground">{tokenStats.message_count} AI replies</p>
                </div>
                <div className="rounded-xl border px-4 py-3 space-y-1" style={{ borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--primary) 4%, transparent)' }}>
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Est. Cost</span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                    {estimatedCost ?? '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {estimatedCost ? 'USD lifetime' : 'pricing n/a'}
                  </p>
                </div>
              </div>

              {/* Total bar */}
              {tokenStats.total_tokens > 0 && (tokenStats.input_tokens > 0 || tokenStats.output_tokens > 0) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Input / Output split</span>
                    <span>{formatTokens(tokenStats.input_tokens + tokenStats.output_tokens)} total</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-muted flex">
                    <div
                      className="h-full rounded-l-full transition-all"
                      style={{
                        width: `${(tokenStats.input_tokens / (tokenStats.input_tokens + tokenStats.output_tokens)) * 100}%`,
                        backgroundColor: 'var(--primary)',
                      }}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--slushie-500) 70%, transparent)' }}
                    />
                  </div>
                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                      Input
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--slushie-500) 70%, transparent)' }} />
                      Output
                    </span>
                  </div>
                </div>
              )}

              {/* Per-model breakdown */}
              {tokenStats.per_model && tokenStats.per_model.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Usage by Model</p>
                  <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
                    {tokenStats.per_model.map((m) => {
                      const pricing = lookupPricing(m.model_name);
                      const cost = modelCost(m.input_tokens, m.output_tokens, m.model_name);
                      const totalUsed = tokenStats.input_tokens + tokenStats.output_tokens;
                      const modelUsed = m.input_tokens + m.output_tokens;
                      const pct = totalUsed > 0 ? Math.round((modelUsed / totalUsed) * 100) : 0;
                      return (
                        <div key={`${m.provider}-${m.model_name}`} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate">{pricing?.label ?? m.model_name}</span>
                              <span className="text-[10px] text-muted-foreground capitalize shrink-0">{m.provider}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                              <span>{formatTokens(m.input_tokens)} in</span>
                              <span>{formatTokens(m.output_tokens)} out</span>
                              <span>{m.message_count} msg{m.message_count !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <p className="text-xs font-semibold tabular-nums">{formatTokens(m.total_tokens)}</p>
                            <p className="text-[10px] text-muted-foreground">{pct}% of total</p>
                          </div>
                          {cost !== null && (
                            <div className="text-right shrink-0 min-w-[48px]">
                              <p className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                                {cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`}
                              </p>
                              <p className="text-[10px] text-muted-foreground">est.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tokenStats.total_tokens === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No AI conversations yet — token usage will appear here after your first analysis.</p>
              )}

              {!pricingInfo && tokenStats.model_name && (
                <p className="text-xs text-muted-foreground">
                  Cost estimation is not available for <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">{tokenStats.model_name}</Badge> — pricing data not configured for this model.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Unable to load token stats.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
