import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  Sparkles, Send, Plus, Bot, Loader2, StopCircle,
  MessageSquarePlus, ChevronDown, X, CheckCheck,
  Cpu, Database, Users, Box, Trash2, ArrowRightLeft,
  ShieldAlert, Network, KeyRound, FlaskConical, Lock, AlertTriangle, FileText,
  ScanSearch, GitBranch,
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

function inlineMarkdown(text: string): React.ReactNode {
  // Handles: **bold**, __bold__, *italic*, _italic_, `code`
  const parts = text.split(/(\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\*[\s\S]+?\*|_[\s\S]+?_)/g);
  return parts.map((part, i) => {
    if (/^(\*\*|__)/.test(part) && /(\*\*|__)$/.test(part))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part))
      return <code key={i} className="font-mono text-[0.82em] bg-muted px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
    if (/^(\*|_)[\s\S]+(\*|_)$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function parseTableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|/.test(line) && /[-]{2,}/.test(line);
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let codeLines: string[] = [];
  let inCodeBlock = false;
  // Table state
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let key = 0;

  const flushList = () => {
    if (!listBuffer.length) return;
    const Tag = listType === 'ul' ? 'ul' : 'ol';
    elements.push(
      <Tag key={key++} className={`my-1.5 pl-4 space-y-0.5 ${listType === 'ul' ? 'list-disc' : 'list-decimal'}`}>
        {listBuffer.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed">{inlineMarkdown(item)}</li>
        ))}
      </Tag>
    );
    listBuffer = [];
    listType = null;
  };

  const flushCode = () => {
    elements.push(
      <pre key={key++} className="my-2 rounded-lg bg-muted/70 border border-border/40 px-3 py-2 overflow-x-auto">
        <code className="font-mono text-[0.8em] leading-relaxed whitespace-pre">{codeLines.join('\n')}</code>
      </pre>
    );
    codeLines = [];
    inCodeBlock = false;
  };

  const flushTable = () => {
    if (!tableHeaders.length) return;
    elements.push(
      <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border/50">
              {tableHeaders.map((h, i) => (
                <th key={i} className="px-3 py-1.5 text-left font-semibold text-foreground/90 whitespace-nowrap">
                  {inlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-muted/20'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 border-t border-border/30 align-top">
                    {inlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeaders = [];
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    // Fenced code block toggle
    if (/^```/.test(line)) {
      flushTable();
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table detection: a line with pipes is a table row or separator
    if (/^\|/.test(line) || (/\|/.test(line) && inTable)) {
      if (isTableSeparator(line)) {
        // Separator row — the preceding line was the header
        inTable = true;
        continue;
      }
      const cells = parseTableRow(line);
      if (!inTable) {
        // First pipe row becomes header (separator comes next)
        flushList();
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    }

    // Non-pipe line exits table mode
    if (inTable || tableHeaders.length) flushTable();

    // Headings (#### → #)
    if (/^#{1,4}\s/.test(line)) {
      flushList();
      const level = (line.match(/^(#+)/)?.[1].length ?? 1);
      const content = line.replace(/^#+\s/, '');
      const cls = level <= 1
        ? 'text-base font-semibold mt-3 mb-1'
        : level === 2
        ? 'text-[0.95rem] font-semibold mt-3 mb-1'
        : 'text-sm font-semibold mt-2 mb-0.5';
      elements.push(<p key={key++} className={cls}>{inlineMarkdown(content)}</p>);
      continue;
    }
    // Blockquote
    if (/^>\s?/.test(line)) {
      flushList();
      elements.push(
        <blockquote key={key++} className="border-l-2 border-primary/40 pl-3 my-1 text-muted-foreground text-sm italic">
          {inlineMarkdown(line.replace(/^>\s?/, ''))}
        </blockquote>
      );
      continue;
    }
    // Bullet list
    if (/^[-*+]\s/.test(line)) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(line.replace(/^[-*+]\s/, ''));
      continue;
    }
    // Ordered list
    if (/^\d+[.)]\s/.test(line)) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(line.replace(/^\d+[.)]\s/, ''));
      continue;
    }
    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
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
  flushTable();
  if (inCodeBlock) flushCode();
  return elements;
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
        {isUser ? (() => {
          // Strip the hidden context prefix before displaying — the AI still received it
          const CONTEXT_RE = /^\[CONTEXT:[^\]]+\]\n\n/;
          const hasContext = CONTEXT_RE.test(message.content);
          const displayText = message.content.replace(CONTEXT_RE, '');
          const focusMatch = message.content.match(/Focus analysis only on these diagram elements: ([^.]+)\./);
          return (
            <>
              {hasContext && focusMatch && (
                <div className="flex items-center gap-1 mb-2 text-primary-foreground/70 text-[10px]">
                  <span>✦</span>
                  <span>Focused on: {focusMatch[1]}</span>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
            </>
          );
        })()
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

function StreamingBubble({ content, thinkingStep, thinkingHistory }: { content: string; thinkingStep?: string; thinkingHistory?: string[] }) {
  const steps = thinkingHistory ?? [];
  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">AI Analyst</span>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60 ml-1" />
      </div>

      {/* Thinking steps log — visible while working */}
      {steps.length > 0 && (
        <div className="max-w-[92%] w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-2 space-y-1">
          {steps.map((step, i) => {
            const isActive = i === steps.length - 1 && !content;
            return (
              <div key={i} className={`flex items-center gap-2 text-[11px] ${isActive ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {isActive ? (
                  <span className="flex gap-0.5 shrink-0">
                    <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : (
                  <svg className="h-3 w-3 shrink-0 text-emerald-500" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <span className="truncate">{step}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Response content */}
      {(content || steps.length === 0) && (
        <div className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border/60 shadow-xs">
          {content
            ? <div className="space-y-1">{renderMarkdown(content)}<span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-text-bottom" /></div>
            : <div className="flex items-center gap-2 text-muted-foreground text-sm py-0.5">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>{thinkingStep || 'Thinking…'}</span>
              </div>
          }
        </div>
      )}
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

type DiagramNodeRef = { id: string; label: string; type: string };

interface AIChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: number | null;
  activeModelId: number | null;
  frameworkId: number | null;
  portalContainer?: HTMLElement | null;
  unanalyzedNodes?: DiagramNodeRef[];
  newNodesSinceSave?: DiagramNodeRef[];
  onModelCreated?: (modelId: number, model: { id: number; name: string; framework_id: number; framework_name: string }) => void;
  onProposalApproved?: () => void;
  focusedNodeIds?: string[];
  focusedNodeLabels?: string[];
  onClearFocus?: () => void;
}

function buildIncrementalPrompt(nodes: DiagramNodeRef[], kind: 'unanalyzed' | 'new'): string {
  const list = nodes.map(n => `- ${n.label} (${n.type}, id: ${n.id})`).join('\n');
  if (kind === 'new') {
    return `The following elements were recently added to the diagram and haven't been analyzed yet. Please analyse only these new elements for threats and mitigations and add them to the existing model:\n${list}`;
  }
  return `The following diagram elements currently have no threat coverage. Please analyse only these elements for threats and mitigations using the active model and framework:\n${list}`;
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
  {
    icon: FileText,
    label: 'Executive Summary',
    description: 'Plain-language summary for stakeholders',
    prompt: 'Write a concise executive summary (3-5 sentences) of this threat model in plain, non-technical language, suitable for a management or compliance report. Highlight the key risk areas, overall security posture, mitigation coverage, and one clear recommendation.',
  },
];

export default function AIChatSheet({
  open, onOpenChange, diagramId, activeModelId, frameworkId,
  portalContainer, unanalyzedNodes = [], newNodesSinceSave = [],
  onModelCreated, onProposalApproved,
  focusedNodeIds = [], focusedNodeLabels = [], onClearFocus,
}: AIChatSheetProps) {
  const {
    conversations, activeConvId, messages, streamingContent, thinkingStep, thinkingHistory,
    isStreaming, isLoading, pendingCount, pendingRemovalCount, pendingModelCount,
    effectiveModelId,
    sendMessage, selectConversation,
    createConversation, deleteConversation, approveProposal, dismissProposal, approveAll, stopStreaming,
  } = useAIChat({ diagramId, activeModelId, frameworkId, onModelCreated, onProposalApproved });

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
    let messageContent = content;
    if (focusedNodeIds.length > 0) {
      const elementNames = focusedNodeLabels.slice(0, 2).join(', ') +
        (focusedNodeLabels.length > 2 ? ` +${focusedNodeLabels.length - 2} more` : '');
      messageContent = `[CONTEXT: Focus analysis only on these diagram elements: ${elementNames}. Ignore all other elements.]\n\n${content}`;
    }
    await sendMessage(messageContent);
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

        {/* ── AI Focus bar ── */}
        {focusedNodeIds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/20 shrink-0 gap-3" style={{ backgroundColor: 'color-mix(in srgb, #3b82f6 8%, transparent)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">🎯</span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
                AI focused on {focusedNodeIds.length} element{focusedNodeIds.length !== 1 ? 's' : ''}
                {focusedNodeLabels.length > 0 && (
                  <> · {focusedNodeLabels.slice(0, 2).join(', ')}{focusedNodeLabels.length > 2 ? ` +${focusedNodeLabels.length - 2} more` : ''}</>
                )}
              </span>
            </div>
            <button
              className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-lg text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-500/15"
              onClick={onClearFocus}
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Incremental analysis banners ── */}
        {newNodesSinceSave.length > 0 && !isStreaming && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-amber-500/20 shrink-0 gap-3" style={{ backgroundColor: 'color-mix(in srgb, var(--lemon-500) 6%, transparent)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--risk-medium)' }} />
              <span className="text-xs font-medium truncate" style={{ color: 'var(--risk-medium)' }}>
                {newNodesSinceSave.length} new element{newNodesSinceSave.length !== 1 ? 's' : ''} added since last save
              </span>
            </div>
            <button
              className="text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--risk-medium)', backgroundColor: 'color-mix(in srgb, var(--lemon-500) 15%, transparent)' }}
              onClick={() => sendMessage(buildIncrementalPrompt(newNodesSinceSave, 'new'))}
            >
              Analyze changes
            </button>
          </div>
        )}
        {newNodesSinceSave.length === 0 && unanalyzedNodes.length > 0 && messages.length > 0 && !isStreaming && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-primary/15 shrink-0 gap-3" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 4%, transparent)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <ScanSearch className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-xs font-medium text-primary truncate">
                {unanalyzedNodes.length} element{unanalyzedNodes.length !== 1 ? 's' : ''} with no threat coverage
              </span>
            </div>
            <button
              className="text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg text-primary transition-colors"
              style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
              onClick={() => sendMessage(buildIncrementalPrompt(unanalyzedNodes, 'unanalyzed'))}
            >
              Analyze now
            </button>
          </div>
        )}

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
              {/* Incremental analysis callout — shown when unanalyzed nodes exist */}
              {(newNodesSinceSave.length > 0 || unanalyzedNodes.length > 0) && (
                <div className="w-full max-w-lg mb-2">
                  {newNodesSinceSave.length > 0 ? (
                    <button
                      onClick={() => sendMessage(buildIncrementalPrompt(newNodesSinceSave, 'new'))}
                      className="w-full text-left border rounded-xl px-4 py-3 transition-all group"
                      style={{ borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)', backgroundColor: 'color-mix(in srgb, var(--lemon-500) 5%, transparent)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <GitBranch className="h-4 w-4 shrink-0" style={{ color: 'var(--risk-medium)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--risk-medium)' }}>
                          {newNodesSinceSave.length} new element{newNodesSinceSave.length !== 1 ? 's' : ''} since last save
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-6">Analyze only the newly added elements against the active threat model</p>
                    </button>
                  ) : (
                    <button
                      onClick={() => sendMessage(buildIncrementalPrompt(unanalyzedNodes, 'unanalyzed'))}
                      className="w-full text-left border border-primary/20 rounded-xl px-4 py-3 hover:bg-primary/5 transition-all group"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 3%, transparent)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ScanSearch className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-primary">
                          {unanalyzedNodes.length} element{unanalyzedNodes.length !== 1 ? 's' : ''} with no threat coverage
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-6">Run a targeted analysis on only the uncovered elements</p>
                    </button>
                  )}
                </div>
              )}

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
              {isStreaming && <StreamingBubble content={streamingContent} thinkingStep={thinkingStep} thinkingHistory={thinkingHistory} />}
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
