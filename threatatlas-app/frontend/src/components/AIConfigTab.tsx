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

// Cost in USD per 1M tokens
const TOKEN_PRICING: Record<string, { input: number; output: number; label: string }> = {
  'gpt-5.4':           { input: 2.50,  output: 10.00, label: 'GPT-5.4' },
  'gpt-5.4-mini':      { input: 0.15,  output: 0.60,  label: 'GPT-5.4 Mini' },
  'gpt-5.4-nano':      { input: 0.10,  output: 0.40,  label: 'GPT-5.4 Nano' },
  'gpt-4o':            { input: 2.50,  output: 10.00, label: 'GPT-4o' },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60,  label: 'GPT-4o Mini' },
  'gpt-4.1':           { input: 2.00,  output: 8.00,  label: 'GPT-4.1' },
  'gpt-4.1-mini':      { input: 0.40,  output: 1.60,  label: 'GPT-4.1 Mini' },
  'claude-opus-4-7':   { input: 15.00, output: 75.00, label: 'Claude Opus 4.7' },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00, label: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5':  { input: 0.80,  output: 4.00,  label: 'Claude Haiku 4.5' },
};

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

function estimateCost(stats: TokenStats): string | null {
  if (!stats.model_name) return null;
  const pricing = TOKEN_PRICING[stats.model_name];
  if (!pricing) return null;
  const cost = (stats.input_tokens / 1_000_000) * pricing.input
             + (stats.output_tokens / 1_000_000) * pricing.output;
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`;
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
    logoClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models via Anthropic API',
    logo: 'AN',
    logoPath: '/images/ai-providers/anthropic.svg',
    logoClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI-Compatible',
    description: 'Custom endpoint (Ollama, LiteLLM, etc.)',
    logo: 'OC',
    logoPath: '/images/ai-providers/ollama.svg',
    logoClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
];

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

  const estimatedCost = tokenStats ? estimateCost(tokenStats) : null;
  const pricingInfo = tokenStats?.model_name ? TOKEN_PRICING[tokenStats.model_name] : null;

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
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--risk-low)' }}>
                <CheckCircle2 className="h-4 w-4" />
                {testMessage}
              </span>
            )}
            {testStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <XCircle className="h-4 w-4" />
                {testMessage}
              </span>
            )}
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
                      const pricing = TOKEN_PRICING[m.model_name];
                      const cost = pricing
                        ? (m.input_tokens / 1_000_000) * pricing.input + (m.output_tokens / 1_000_000) * pricing.output
                        : null;
                      const pct = tokenStats.total_tokens > 0
                        ? Math.round((m.total_tokens / (tokenStats.input_tokens + tokenStats.output_tokens)) * 100)
                        : 0;
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
