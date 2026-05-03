import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  Sparkles, Send, Plus, Bot, Loader2, StopCircle,
  MessageSquarePlus, ChevronDown, X, CheckCheck,
  Cpu, Database, Users, Box, Trash2, ArrowRightLeft,
  ShieldAlert, Network, KeyRound, FlaskConical, Lock, AlertTriangle,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAIChat, type ChatMessage } from '@/hooks/useAIChat';
import AIProposalCard from '@/components/AIProposalCard';
import { getElementColor } from '@/lib/designSystem';

// ── Lightweight markdown renderer ────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer.length) return;
    if (listType === 'ul') {
      elements.push(
        <ul key={key++} className="my-1.5 pl-4 space-y-0.5 list-disc">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{inlineMarkdown(item)}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={key++} className="my-1.5 pl-4 space-y-0.5 list-decimal">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{inlineMarkdown(item)}</li>
          ))}
        </ol>
      );
    }
    listBuffer = [];
    listType = null;
  };

  for (const line of lines) {
    // Headings
    if (/^###\s/.test(line)) {
      flushList();
      elements.push(<h4 key={key++} className="text-sm font-semibold mt-3 mb-1">{line.replace(/^###\s/, '')}</h4>);
      continue;
    }
    if (/^##\s/.test(line)) {
      flushList();
      elements.push(<h3 key={key++} className="text-sm font-semibold mt-3 mb-1">{line.replace(/^##\s/, '')}</h3>);
      continue;
    }
    if (/^#\s/.test(line)) {
      flushList();
      elements.push(<h2 key={key++} className="text-base font-semibold mt-3 mb-1">{line.replace(/^#\s/, '')}</h2>);
      continue;
    }
    // Bullet list
    if (/^[-*]\s/.test(line)) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(line.replace(/^[-*]\s/, ''));
      continue;
    }
    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(line.replace(/^\d+\.\s/, ''));
      continue;
    }
    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList();
      elements.push(<Separator key={key++} className="my-2 opacity-40" />);
      continue;
    }
    flushList();
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1.5" />);
    } else {
      elements.push(<p key={key++} className="text-sm leading-relaxed">{inlineMarkdown(line)}</p>);
    }
  }
  flushList();
  return elements;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Split by bold (**), italic (*), and inline code (`)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part))
      return <code key={i} className="font-mono text-[0.82em] bg-muted px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
    return part;
  });
}

// ── Element type icons ────────────────────────────────────────────────────────

const ELEMENT_ICONS: Record<string, { icon: React.ElementType; colorVar: string; label: string }> = {
  process:         { icon: Cpu,             colorVar: 'var(--primary)',           label: 'Process' },
  datastore:       { icon: Database,        colorVar: 'var(--element-datastore)', label: 'Data Store' },
  data_store:      { icon: Database,        colorVar: 'var(--element-datastore)', label: 'Data Store' },
  external:        { icon: Users,           colorVar: 'var(--element-external)',  label: 'External Entity' },
  external_entity: { icon: Users,           colorVar: 'var(--element-external)',  label: 'External Entity' },
  boundary:        { icon: Box,             colorVar: 'var(--ds-stone-gray)',     label: 'Trust Boundary' },
  trust_boundary:  { icon: Box,             colorVar: 'var(--ds-stone-gray)',     label: 'Trust Boundary' },
  edge:            { icon: ArrowRightLeft,  colorVar: 'var(--slushie-800)',       label: 'Data Flow' },
  data_flow:       { icon: ArrowRightLeft,  colorVar: 'var(--slushie-800)',       label: 'Data Flow' },
  dataflow:        { icon: ArrowRightLeft,  colorVar: 'var(--slushie-800)',       label: 'Data Flow' },
  unknown:         { icon: Box,             colorVar: 'var(--muted-foreground)',  label: 'Element' },
};

// ── Grouped proposals component ───────────────────────────────────────────────

import type { Proposal } from '@/hooks/useAIChat';

function ProposalGroup({
  proposals, messageId, approvedCount, pendingCount, onApprove, onDismiss,
}: {
  proposals: Proposal[];
  messageId: number;
  approvedCount: number;
  pendingCount: number;
  onApprove: (msgId: number, propId: string) => void;
  onDismiss: (msgId: number, propId: string) => void;
}) {
  const isIdLikeLabel = (label: string | undefined, elementId: string): boolean => {
    if (!label) return true;
    const normalized = label.trim();
    if (!normalized) return true;
    if (normalized === elementId) return true;
    if (/^drawio-[A-Za-z0-9_-]+$/.test(normalized)) return true;
    if (!/\s/.test(normalized) && /^[A-Za-z0-9_-]{12,}$/.test(normalized)) return true;
    return false;
  };

  const modelProposals = proposals.filter(p => p.type === 'create_model');
  const otherProposals = proposals.filter(p => p.type !== 'create_model');

  // Group non-model proposals by element_id maintaining insertion order
  const elementMap = new Map<string, Proposal[]>();
  for (const p of otherProposals) {
    if (!elementMap.has(p.element_id)) elementMap.set(p.element_id, []);
    elementMap.get(p.element_id)!.push(p);
  }

  return (
    <div className="w-full max-w-[92%] space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-medium text-muted-foreground">
          {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
        </span>
        {approvedCount > 0 && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5" style={{ color: 'var(--risk-low)', borderColor: 'color-mix(in srgb, var(--matcha-600) 35%, transparent)' }}>
            {approvedCount} added
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5" style={{ color: 'var(--risk-medium)', borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)' }}>
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {/* Model creation proposals — shown first so user sets up the model before approving threats */}
      {modelProposals.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)' }}>
          <div className="flex items-center gap-2 px-3.5 py-2 border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}>
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wide">Model Setup Required</span>
          </div>
          <div className="p-3.5 space-y-2">
            {modelProposals.map(p => (
              <AIProposalCard key={p.id} proposal={p} messageId={messageId} onApprove={onApprove} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}

      {/* Per-element blocks */}
      {Array.from(elementMap.entries()).map(([elementId, elementProposals]) => {
        const threats    = elementProposals.filter(p => p.type === 'threat');
        const kbThreats  = elementProposals.filter(p => p.type === 'suggest_kb_threat');
        const mitigations = elementProposals.filter(p => p.type === 'mitigation');
        const removals   = elementProposals.filter(p => p.type === 'remove_threat' || p.type === 'remove_mitigation');
        const riskAssessments = elementProposals.filter(
          (p) => p.type === 'update_risk' && p.status === 'pending'
        );

        // Derive element type/label — removals may carry technical IDs, prefer human labels from any proposal.
        const typeSource = [...threats, ...mitigations, ...removals][0];
        const labelSource =
          elementProposals.find((p) => !isIdLikeLabel(p.element_label, elementId)) ??
          elementProposals.find((p) => p.element_label && p.element_label.trim().length > 0) ??
          typeSource;
        const elementType  = typeSource?.element_type || 'unknown';
        const elementLabel = labelSource?.element_label || elementId;
        const meta = ELEMENT_ICONS[elementType] ?? ELEMENT_ICONS.unknown;
        const EIcon = meta.icon;

        return (
          <div key={elementId} className="rounded-xl border border-border/50 overflow-hidden">
            {/* Element header */}
            <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/40 border-b border-border/40">
              <EIcon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.colorVar }} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{meta.label}</span>
              <span className="text-xs font-semibold text-foreground truncate">{elementLabel}</span>
            </div>

            <div className="divide-y divide-border/30">
              {/* Per-element risk assessment quick-view */}
              {riskAssessments.length > 0 && (
                <div className="px-3.5 py-2.5 bg-muted/20">
                  <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.75rem] items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pb-1.5 border-b border-border/30">
                    <span className="truncate">T</span>
                    <span className="text-center">L</span>
                    <span className="text-center">I</span>
                    <span className="text-center">R</span>
                  </div>
                  <div className="pt-1.5 space-y-1">
                    {riskAssessments.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.75rem] items-center gap-2 text-[11px]"
                      >
                        <span className="truncate text-foreground/90">{p.name}</span>
                        <span className="text-center tabular-nums text-muted-foreground">{p.likelihood ?? '-'}</span>
                        <span className="text-center tabular-nums text-muted-foreground">{p.impact ?? '-'}</span>
                        <span className="text-center tabular-nums font-medium text-foreground/80">{p.risk_score ?? '-'}</span>
                      </div>
                    ))}
                    {riskAssessments.length > 4 && (
                      <p className="text-[10px] text-muted-foreground pt-0.5">
                        +{riskAssessments.length - 4} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Removal proposals — shown first so user can clean up before adding new items */}
              {removals.length > 0 && (
                <div className="px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-px flex-1" style={{ backgroundColor: 'color-mix(in srgb, var(--risk-high) 40%, transparent)' }} />
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--risk-high)' }}>Existing — remove?</span>
                    <div className="h-px flex-1" style={{ backgroundColor: 'color-mix(in srgb, var(--risk-high) 40%, transparent)' }} />
                  </div>
                  {removals.map(r => (
                    <AIProposalCard key={r.id} proposal={r} messageId={messageId} onApprove={onApprove} onDismiss={onDismiss} />
                  ))}
                </div>
              )}

              {/* New threats → their mitigations */}
              {threats.map(threat => {
                const linkedMits = mitigations.filter(m =>
                  m.for_threat_proposal_id === threat.id ||
                  (!m.for_threat_proposal_id && m.category === threat.category)
                );
                return (
                  <div key={threat.id}>
                    <div className="px-3.5 pt-3 pb-2">
                      <AIProposalCard proposal={threat} messageId={messageId} onApprove={onApprove} onDismiss={onDismiss} />
                    </div>
                    {linkedMits.length > 0 && (
                      <div className="pl-6 pr-3.5 pb-3 space-y-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="h-px flex-1 bg-border/40" />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mitigations</span>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                        {linkedMits.map(m => (
                          <AIProposalCard key={m.id} proposal={m} messageId={messageId} onApprove={onApprove} onDismiss={onDismiss} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unlinked new mitigations */}
              {(() => {
                const linkedIds = new Set(
                  threats.flatMap(t =>
                    mitigations
                      .filter(m => m.for_threat_proposal_id === t.id || (!m.for_threat_proposal_id && m.category === t.category))
                      .map(m => m.id)
                  )
                );
                const unlinked = mitigations.filter(m => !linkedIds.has(m.id));
                if (!unlinked.length) return null;
                return (
                  <div className="px-3.5 py-3 space-y-2">
                    {unlinked.map(m => (
                      <AIProposalCard key={m.id} proposal={m} messageId={messageId} onApprove={onApprove} onDismiss={onDismiss} />
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message, onApprove, onDismiss,
}: {
  message: ChatMessage;
  onApprove: (msgId: number, propId: string) => void;
  onDismiss: (msgId: number, propId: string) => void;
}) {
  const isUser = message.role === 'user';
  const pendingCount = message.proposals?.filter(p => p.status === 'pending').length ?? 0;
  const approvedCount = message.proposals?.filter(p => p.status === 'approved').length ?? 0;

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      {/* Role label */}
      <div className={cn('flex items-center gap-1.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
        <div className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full shrink-0',
          isUser ? 'bg-primary/15' : 'bg-primary/10'
        )}>
          {isUser
            ? <span className="text-[10px] font-bold text-primary">U</span>
            : <Bot className="h-3.5 w-3.5 text-primary" />
          }
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {isUser ? 'You' : 'AI Analyst'}
        </span>
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[92%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-card border border-border/60 rounded-tl-sm shadow-xs'
      )}>
        {isUser
          ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          : <div className="space-y-1">{renderMarkdown(message.content)}</div>
        }
      </div>

      {/* Proposals — grouped by element, threat → its mitigations → next threat */}
      {message.proposals && message.proposals.length > 0 && (
        <ProposalGroup
          proposals={message.proposals}
          messageId={message.id}
          approvedCount={approvedCount}
          pendingCount={pendingCount}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">AI Analyst</span>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60 ml-1" />
      </div>
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border/60 shadow-xs">
        {content
          ? <div className="space-y-1">{renderMarkdown(content)}<span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-text-bottom" /></div>
          : <div className="flex items-center gap-2 text-muted-foreground text-sm py-0.5">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span>Thinking…</span>
            </div>
        }
      </div>
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

interface AIChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: number | null;
  activeModelId: number | null;
  frameworkId: number | null;
  portalContainer?: HTMLElement | null;
  onModelCreated?: (modelId: number, model: { id: number; name: string; framework_id: number; framework_name: string }) => void;
}

const SUGGESTIONS: { icon: React.ElementType; label: string; description: string; prompt: string }[] = [
  {
    icon: ShieldAlert,
    label: 'Full STRIDE Analysis',
    description: 'Exhaustive STRIDE coverage for every element',
    prompt: 'Perform a full STRIDE analysis on every element and data flow in this diagram. Propose threats and mitigations from the knowledge base.',
  },
  {
    icon: Network,
    label: 'Data Flow Risks',
    description: 'Interception, tampering & injection on flows',
    prompt: 'Analyse all data flows in this diagram for security risks — focus on interception, tampering, injection, and replay attacks.',
  },
  {
    icon: Box,
    label: 'Trust Boundary Review',
    description: 'Identify what crosses boundaries with controls',
    prompt: 'Review all trust boundaries in this diagram. Identify what data and control flows cross them and what controls should be in place.',
  },
  {
    icon: KeyRound,
    label: 'Auth & Access Control',
    description: 'Authentication, authorisation & session risks',
    prompt: 'Analyse this diagram for authentication, authorisation, and session management weaknesses across all processes and external entities.',
  },
  {
    icon: Database,
    label: 'Data Store Security',
    description: 'Encryption, access, injection & audit logging',
    prompt: 'Review all data stores in this diagram for risks: access control, encryption at rest, injection vulnerabilities, audit logging, and data leakage.',
  },
  {
    icon: FlaskConical,
    label: 'OWASP Top 10',
    description: 'Map elements to OWASP Top 10 risks',
    prompt: 'Analyse this diagram against the OWASP Top 10. Map each applicable risk category to the relevant diagram elements and propose mitigations.',
  },
  {
    icon: Lock,
    label: 'Sensitive Data Exposure',
    description: 'PII, secrets & data-in-transit risks',
    prompt: 'Identify all paths where sensitive data (PII, credentials, tokens) could be exposed in transit or at rest, and propose mitigations.',
  },
  {
    icon: AlertTriangle,
    label: 'Top Critical Threats',
    description: 'Highest-impact risks with priority fixes',
    prompt: 'What are the 5 most critical security threats in this diagram? Rank them by risk level and suggest the most impactful mitigations.',
  },
];

export default function AIChatSheet({
  open, onOpenChange, diagramId, activeModelId, frameworkId,
  portalContainer, onModelCreated,
}: AIChatSheetProps) {
  const {
    conversations, activeConvId, messages, streamingContent,
    isStreaming, isLoading, pendingCount, pendingRemovalCount, pendingModelCount,
    effectiveModelId,
    sendMessage, selectConversation,
    createConversation, deleteConversation, approveProposal, dismissProposal, approveAll, stopStreaming,
  } = useAIChat({ diagramId, activeModelId, frameworkId, onModelCreated });

  const [input, setInput] = useState('');
  const [deleteDialogConvId, setDeleteDialogConvId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 120);
  }, [open]);

  // Return focus to textarea whenever streaming finishes
  useEffect(() => {
    if (!isStreaming && open) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [isStreaming, open]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = messages.length === 0 && !streamingContent;
  const deleteDialogConversation = conversations.find((conv) => conv.id === deleteDialogConvId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-[680px] sm:!max-w-[720px] flex flex-col p-0 gap-0 overflow-hidden"
        showCloseButton={false}
        portalContainer={portalContainer}
      >
        {/* ── Header ── */}
        <SheetHeader className="flex-row items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold leading-none">AI Threat Analysis</SheetTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {effectiveModelId ? 'Model active — proposals need your approval' : 'No model selected — AI will propose creating one'}
              </p>
            </div>
            {!effectiveModelId && (
              <Badge variant="outline" className="text-xs ml-1" style={{ color: 'var(--risk-medium)', borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)' }}>
                No model
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {conversations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    History
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {conversations.map((conv) => (
                    <DropdownMenuItem
                      key={conv.id}
                      className={cn('text-xs py-1.5 flex items-center justify-between gap-2', activeConvId === conv.id && 'bg-muted font-medium')}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <>
                        <button
                          className="flex-1 text-left truncate"
                          onClick={() => selectConversation(conv.id)}
                        >
                          {conv.title || `Conversation ${conv.id}`}
                        </button>
                        <button
                          className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete conversation"
                          onClick={(e) => { e.stopPropagation(); setDeleteDialogConvId(conv.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    </DropdownMenuItem>
                  ))}
                  <Separator className="my-1" />
                  <DropdownMenuItem onClick={() => createConversation()} className="text-xs py-2 text-primary">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New Conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => createConversation()} title="New conversation">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <AlertDialog open={deleteDialogConvId !== null} onOpenChange={(open) => !open && setDeleteDialogConvId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">
                  {deleteDialogConversation?.title || (deleteDialogConversation ? `Conversation ${deleteDialogConversation.id}` : 'this conversation')}
                </span>
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDialogConvId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteDialogConvId === null) return;
                  deleteConversation(deleteDialogConvId);
                  setDeleteDialogConvId(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Approve-all banner ── */}
        {(pendingCount > 0 || pendingRemovalCount > 0) && !isStreaming && (
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 shrink-0 bg-muted/30 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <CheckCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">{pendingCount} to add</span>
                </div>
              )}
              {pendingRemovalCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--risk-high)' }} />
                  <span className="font-medium" style={{ color: 'var(--risk-high)' }}>{pendingRemovalCount} removal{pendingRemovalCount !== 1 ? 's' : ''}</span>
                  <span className="text-muted-foreground text-xs">— review individually</span>
                </div>
              )}
            </div>
            {pendingCount > 0 && (
              <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg shrink-0" onClick={approveAll}>
                <CheckCheck className="h-3.5 w-3.5" />
                Approve All Additions
              </Button>
            )}
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-5">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">AI Threat Modeling Assistant</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-6">
                Analyse your diagram for security threats and get mitigation suggestions from the knowledge base.
                Every proposal requires your approval before being added.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      onClick={() => { setInput(''); sendMessage(s.prompt); }}
                      className="text-left border border-border/60 rounded-xl px-3.5 py-3 hover:bg-muted/60 hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-foreground/90 group-hover:text-primary transition-colors leading-tight">{s.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed pl-8">{s.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onApprove={approveProposal}
                  onDismiss={dismissProposal}
                />
              ))}
              {isStreaming && <StreamingBubble content={streamingContent} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="border-t border-border/60 px-5 py-4 shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="flex gap-2.5 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about threats, data flows, trust boundaries…"
              className="min-h-[48px] max-h-36 resize-none text-sm rounded-xl"
              disabled={isStreaming}
              rows={2}
            />
            <div className="flex flex-col gap-1.5">
              {isStreaming ? (
                <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl" onClick={stopStreaming} title="Stop">
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={handleSend} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2 text-center">
            ↵ Send · ⇧↵ New line · Proposals need your approval before being added to the diagram
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
