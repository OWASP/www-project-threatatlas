import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  Sparkles, Send, Plus, Bot, Loader2, StopCircle,
  MessageSquarePlus, ChevronDown, X, CheckCheck,
  Cpu, Database, Users, Box, Trash2, ArrowRightLeft,
  ShieldAlert, Network, KeyRound, FlaskConical, Lock, AlertTriangle, FileText,
  ScanSearch, GitBranch, Tag, Hash, Globe, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import ThreatManagement from '@/components/ThreatManagement';
import { getElementColor } from '@/lib/designSystem';

import type { Proposal } from '@/hooks/useAIChat';

// ── Types ─────────────────────────────────────────────────────────────────────

type DiagramNodeRef = { id: string; label: string; type: string };

export interface DiagramRightPanelProps {
  // Active tab control (lifted to parent)
  activeTab: 'inspector' | 'ai';
  onTabChange: (tab: 'inspector' | 'ai') => void;
  // AI chat props
  diagramId: number | null;
  activeModelId: number | null;
  frameworkId: number | null;
  unanalyzedNodes: DiagramNodeRef[];
  newNodesSinceSave: DiagramNodeRef[];
  focusedNodeIds: string[];
  focusedNodeLabels: string[];
  onClearFocus: () => void;
  onModelCreated: (modelId: number, model: { id: number; name: string; framework_id: number; framework_name: string }) => void;
  onProposalApproved: () => void;
  // Selected element (for inspector tab)
  selectedElement: {
    id: string;
    type: 'node' | 'edge';
    label: string;
    nodeType?: string;
    description?: string;
  } | null;
  onRename: (id: string, label: string) => void;
  onDescriptionChange: (id: string, desc: string) => void;
  onChangeNodeType: (id: string, newType: string) => void;
  onDeleteElement: () => void;
  // Other
  canWrite: boolean;
}

// ── Markdown renderer (copied from AIChatSheet) ───────────────────────────────

function inlineMarkdown(text: string): React.ReactNode {
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
    if (inCodeBlock) { codeLines.push(line); continue; }

    if (/^\|/.test(line) || (/\|/.test(line) && inTable)) {
      if (isTableSeparator(line)) { inTable = true; continue; }
      const cells = parseTableRow(line);
      if (!inTable) { flushList(); tableHeaders = cells; }
      else { tableRows.push(cells); }
      continue;
    }
    if (inTable || tableHeaders.length) flushTable();

    if (/^#{1,4}\s/.test(line)) {
      flushList();
      const level = (line.match(/^(#+)/)?.[1].length ?? 1);
      const content = line.replace(/^#+\s/, '');
      const cls = level <= 1 ? 'text-base font-semibold mt-3 mb-1'
        : level === 2 ? 'text-[0.95rem] font-semibold mt-3 mb-1'
        : 'text-sm font-semibold mt-2 mb-0.5';
      elements.push(<p key={key++} className={cls}>{inlineMarkdown(content)}</p>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushList();
      elements.push(
        <blockquote key={key++} className="border-l-2 border-primary/40 pl-3 my-1 text-muted-foreground text-sm italic">
          {inlineMarkdown(line.replace(/^>\s?/, ''))}
        </blockquote>
      );
      continue;
    }
    if (/^[-*+]\s/.test(line)) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(line.replace(/^[-*+]\s/, ''));
      continue;
    }
    if (/^\d+[.)]\s/.test(line)) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(line.replace(/^\d+[.)]\s/, ''));
      continue;
    }
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

// ── Grouped proposals ─────────────────────────────────────────────────────────

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
  const elementMap = new Map<string, Proposal[]>();
  for (const p of otherProposals) {
    if (!elementMap.has(p.element_id)) elementMap.set(p.element_id, []);
    elementMap.get(p.element_id)!.push(p);
  }

  return (
    <div className="w-full max-w-[97%] space-y-3">
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

      {Array.from(elementMap.entries()).map(([elementId, elementProposals]) => {
        const threats      = elementProposals.filter(p => p.type === 'threat');
        const mitigations  = elementProposals.filter(p => p.type === 'mitigation');
        const removals     = elementProposals.filter(p => p.type === 'remove_threat' || p.type === 'remove_mitigation');
        const riskAssessments = elementProposals.filter(p => p.type === 'update_risk' && p.status === 'pending');

        const typeSource  = [...threats, ...mitigations, ...removals][0];
        const labelSource =
          elementProposals.find((p) => !isIdLikeLabel(p.element_label, elementId)) ??
          elementProposals.find((p) => p.element_label && p.element_label.trim().length > 0) ??
          typeSource;
        const elementType  = typeSource?.element_type || 'unknown';
        const elementLabel = labelSource?.element_label || elementId;
        const meta  = ELEMENT_ICONS[elementType] ?? ELEMENT_ICONS.unknown;
        const EIcon = meta.icon;

        return (
          <div key={elementId} className="rounded-xl border border-border/50 overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/40 border-b border-border/40">
              <EIcon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.colorVar }} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{meta.label}</span>
              <span className="text-xs font-semibold text-foreground truncate">{elementLabel}</span>
            </div>
            <div className="divide-y divide-border/30">
              {riskAssessments.length > 0 && (
                <div className="px-3.5 py-2.5 bg-muted/20">
                  <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.75rem] items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pb-1.5 border-b border-border/30">
                    <span className="truncate">T</span><span className="text-center">L</span><span className="text-center">I</span><span className="text-center">R</span>
                  </div>
                  <div className="pt-1.5 space-y-1">
                    {riskAssessments.slice(0, 4).map((p) => (
                      <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.75rem] items-center gap-2 text-[11px]">
                        <span className="truncate text-foreground/90">{p.name}</span>
                        <span className="text-center tabular-nums text-muted-foreground">{p.likelihood ?? '-'}</span>
                        <span className="text-center tabular-nums text-muted-foreground">{p.impact ?? '-'}</span>
                        <span className="text-center tabular-nums font-medium text-foreground/80">{p.risk_score ?? '-'}</span>
                      </div>
                    ))}
                    {riskAssessments.length > 4 && <p className="text-[10px] text-muted-foreground pt-0.5">+{riskAssessments.length - 4} more</p>}
                  </div>
                </div>
              )}
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

function MessageBubble({ message, onApprove, onDismiss }: {
  message: ChatMessage;
  onApprove: (msgId: number, propId: string) => void;
  onDismiss: (msgId: number, propId: string) => void;
}) {
  const isUser = message.role === 'user';
  const pendingCount  = message.proposals?.filter(p => p.status === 'pending').length ?? 0;
  const approvedCount = message.proposals?.filter(p => p.status === 'approved').length ?? 0;

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div className={cn('flex items-center gap-1.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-full shrink-0', isUser ? 'bg-primary/15' : 'bg-primary/10')}>
          {isUser ? <span className="text-[10px] font-bold text-primary">U</span> : <Bot className="h-3.5 w-3.5 text-primary" />}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{isUser ? 'You' : 'AI Analyst'}</span>
      </div>
      <div className={cn('max-w-[97%] rounded-2xl px-4 py-3', isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border/60 rounded-tl-sm shadow-xs')}>
        {isUser ? (() => {
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
        })() : <div className="space-y-1">{renderMarkdown(message.content)}</div>}
      </div>
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
      {steps.length > 0 && (
        <div className="max-w-[97%] w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-2 space-y-1">
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
      {(content || steps.length === 0) && (
        <div className="max-w-[97%] rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border/60 shadow-xs">
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

// ── AI suggestions ────────────────────────────────────────────────────────────

function buildIncrementalPrompt(nodes: DiagramNodeRef[], kind: 'unanalyzed' | 'new'): string {
  const list = nodes.map(n => `- ${n.label} (${n.type}, id: ${n.id})`).join('\n');
  if (kind === 'new') {
    return `The following elements were recently added to the diagram and haven't been analyzed yet. Please analyse only these new elements for threats and mitigations and add them to the existing model:\n${list}`;
  }
  return `The following diagram elements currently have no threat coverage. Please analyse only these elements for threats and mitigations using the active model and framework:\n${list}`;
}

const SUGGESTIONS: { icon: React.ElementType; label: string; description: string; prompt: string }[] = [
  { icon: ShieldAlert,  label: 'Full STRIDE Analysis',   description: 'Exhaustive STRIDE coverage for every element',  prompt: 'Perform a full STRIDE analysis on every element and data flow in this diagram. Propose threats and mitigations from the knowledge base.' },
  { icon: Network,      label: 'Data Flow Risks',         description: 'Interception, tampering & injection on flows',   prompt: 'Analyse all data flows in this diagram for security risks — focus on interception, tampering, injection, and replay attacks.' },
  { icon: Box,          label: 'Trust Boundary Review',   description: 'Identify what crosses boundaries with controls', prompt: 'Review all trust boundaries in this diagram. Identify what data and control flows cross them and what controls should be in place.' },
  { icon: KeyRound,     label: 'Auth & Access Control',   description: 'Authentication, authorisation & session risks',  prompt: 'Analyse this diagram for authentication, authorisation, and session management weaknesses across all processes and external entities.' },
  { icon: Database,     label: 'Data Store Security',     description: 'Encryption, access, injection & audit logging',  prompt: 'Review all data stores in this diagram for risks: access control, encryption at rest, injection vulnerabilities, audit logging, and data leakage.' },
  { icon: FlaskConical, label: 'OWASP Top 10',            description: 'Map elements to OWASP Top 10 risks',             prompt: 'Analyse this diagram against the OWASP Top 10. Map each applicable risk category to the relevant diagram elements and propose mitigations.' },
  { icon: Lock,         label: 'Sensitive Data Exposure', description: 'PII, secrets & data-in-transit risks',           prompt: 'Identify all paths where sensitive data (PII, credentials, tokens) could be exposed in transit or at rest, and propose mitigations.' },
  { icon: AlertTriangle,label: 'Top Critical Threats',    description: 'Highest-impact risks with priority fixes',       prompt: 'What are the 5 most critical security threats in this diagram? Rank them by risk level and suggest the most impactful mitigations.' },
  { icon: FileText,     label: 'Executive Summary',       description: 'Plain-language summary for stakeholders',        prompt: 'Write a concise executive summary (3-5 sentences) of this threat model in plain, non-technical language, suitable for a management or compliance report. Highlight the key risk areas, overall security posture, mitigation coverage, and one clear recommendation.' },
];

// ── AI Panel ──────────────────────────────────────────────────────────────────

function AIPanel({
  diagramId, activeModelId, frameworkId,
  unanalyzedNodes, newNodesSinceSave,
  focusedNodeIds, focusedNodeLabels, onClearFocus,
  onModelCreated, onProposalApproved,
}: {
  diagramId: number | null;
  activeModelId: number | null;
  frameworkId: number | null;
  unanalyzedNodes: DiagramNodeRef[];
  newNodesSinceSave: DiagramNodeRef[];
  focusedNodeIds: string[];
  focusedNodeLabels: string[];
  onClearFocus: () => void;
  onModelCreated: (modelId: number, model: { id: number; name: string; framework_id: number; framework_name: string }) => void;
  onProposalApproved: () => void;
}) {
  const {
    conversations, activeConvId, messages, streamingContent, thinkingStep, thinkingHistory,
    isStreaming, isLoading, pendingCount, pendingRemovalCount,
    effectiveModelId,
    sendMessage, selectConversation,
    createConversation, deleteConversation, approveProposal, dismissProposal, approveAll, stopStreaming,
  } = useAIChat({ diagramId, activeModelId, frameworkId, onModelCreated, onProposalApproved });

  const [input, setInput] = useState('');
  const [deleteDialogConvId, setDeleteDialogConvId] = useState<number | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 120);
  }, []);

  useEffect(() => {
    if (!isStreaming) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [isStreaming]);

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
  const deleteDialogConversation = conversations.find(c => c.id === deleteDialogConvId);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* AI panel header row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold leading-none">AI Threat Analysis</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {effectiveModelId ? 'Model active' : 'No model — AI will propose one'}
            </p>
          </div>
          {!effectiveModelId && (
            <Badge variant="outline" className="text-[10px] ml-1" style={{ color: 'var(--risk-medium)', borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)' }}>
              No model
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {conversations.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground px-2">
                  <MessageSquarePlus className="h-3 w-3" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {conversations.map((conv) => (
                  <DropdownMenuItem
                    key={conv.id}
                    className={cn('text-xs py-1.5 flex items-center justify-between gap-2', activeConvId === conv.id && 'bg-muted font-medium')}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <button className="flex-1 text-left truncate" onClick={() => selectConversation(conv.id)}>
                      {conv.title || `Conversation ${conv.id}`}
                    </button>
                    <button
                      className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDeleteDialogConvId(conv.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => createConversation()} title="New conversation">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogConvId !== null} onOpenChange={(open) => !open && setDeleteDialogConvId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deleteDialogConversation?.title || (deleteDialogConversation ? `Conversation ${deleteDialogConversation.id}` : 'this conversation')}
              </span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogConvId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteDialogConvId !== null) { deleteConversation(deleteDialogConvId); setDeleteDialogConvId(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Focus bar */}
      {focusedNodeIds.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-blue-500/20 shrink-0 gap-2" style={{ backgroundColor: 'color-mix(in srgb, #3b82f6 8%, transparent)' }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0">🎯</span>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate">
              Focused on {focusedNodeIds.length} element{focusedNodeIds.length !== 1 ? 's' : ''}
              {focusedNodeLabels.length > 0 && (
                <> · {focusedNodeLabels.slice(0, 2).join(', ')}{focusedNodeLabels.length > 2 ? ` +${focusedNodeLabels.length - 2} more` : ''}</>
              )}
            </span>
          </div>
          <button className="text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-500/15" onClick={onClearFocus}>
            Clear
          </button>
        </div>
      )}

      {/* Incremental analysis banners */}
      {newNodesSinceSave.length > 0 && !isStreaming && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-500/20 shrink-0 gap-2" style={{ backgroundColor: 'color-mix(in srgb, var(--lemon-500) 6%, transparent)' }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch className="h-3 w-3 shrink-0" style={{ color: 'var(--risk-medium)' }} />
            <span className="text-[11px] font-medium truncate" style={{ color: 'var(--risk-medium)' }}>
              {newNodesSinceSave.length} new element{newNodesSinceSave.length !== 1 ? 's' : ''} since last save
            </span>
          </div>
          <button
            className="text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded transition-colors"
            style={{ color: 'var(--risk-medium)', backgroundColor: 'color-mix(in srgb, var(--lemon-500) 15%, transparent)' }}
            onClick={() => sendMessage(buildIncrementalPrompt(newNodesSinceSave, 'new'))}
          >
            Analyze
          </button>
        </div>
      )}
      {newNodesSinceSave.length === 0 && unanalyzedNodes.length > 0 && messages.length > 0 && !isStreaming && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-primary/15 shrink-0 gap-2" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 4%, transparent)' }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <ScanSearch className="h-3 w-3 shrink-0 text-primary" />
            <span className="text-[11px] font-medium text-primary truncate">
              {unanalyzedNodes.length} element{unanalyzedNodes.length !== 1 ? 's' : ''} with no coverage
            </span>
          </div>
          <button
            className="text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded text-primary transition-colors"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
            onClick={() => sendMessage(buildIncrementalPrompt(unanalyzedNodes, 'unanalyzed'))}
          >
            Analyze
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-sm mb-1.5">AI Threat Analysis</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-4">
              Analyse your diagram for security threats. Every proposal requires your approval.
            </p>
            {(newNodesSinceSave.length > 0 || unanalyzedNodes.length > 0) && (
              <div className="w-full mb-3">
                {newNodesSinceSave.length > 0 ? (
                  <button
                    onClick={() => sendMessage(buildIncrementalPrompt(newNodesSinceSave, 'new'))}
                    className="w-full text-left border rounded-xl px-3 py-2.5 transition-all"
                    style={{ borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)', backgroundColor: 'color-mix(in srgb, var(--lemon-500) 5%, transparent)' }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <GitBranch className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--risk-medium)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--risk-medium)' }}>
                        {newNodesSinceSave.length} new element{newNodesSinceSave.length !== 1 ? 's' : ''} since save
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pl-5">Analyze only newly added elements</p>
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(buildIncrementalPrompt(unanalyzedNodes, 'unanalyzed'))}
                    className="w-full text-left border border-primary/20 rounded-xl px-3 py-2.5 hover:bg-primary/5 transition-all"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 3%, transparent)' }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ScanSearch className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-[11px] font-semibold text-primary">
                        {unanalyzedNodes.length} element{unanalyzedNodes.length !== 1 ? 's' : ''} with no coverage
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pl-5">Run targeted analysis on uncovered elements</p>
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-1.5 w-full">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => { setInput(''); sendMessage(s.prompt); }}
                    className="text-left border border-border/60 rounded-lg px-3 py-2 hover:bg-muted/60 hover:border-primary/30 transition-all group flex items-center gap-2"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-foreground/90 group-hover:text-primary transition-colors leading-tight block">{s.label}</span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed truncate">{s.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onApprove={approveProposal} onDismiss={dismissProposal} />
            ))}
            {isStreaming && <StreamingBubble content={streamingContent} thinkingStep={thinkingStep} thinkingHistory={thinkingHistory} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Approve-all banner — shown after AI response, above the input */}
      {(pendingCount > 0 || pendingRemovalCount > 0) && !isStreaming && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 shrink-0 bg-muted/30 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1">
                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-primary text-xs">{pendingCount} to add</span>
              </div>
            )}
            {pendingRemovalCount > 0 && (
              <div className="flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--risk-high)' }} />
                <span className="font-medium text-xs" style={{ color: 'var(--risk-high)' }}>{pendingRemovalCount} removal{pendingRemovalCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {pendingCount > 0 && (
            <Button size="sm" className="h-6 text-[11px] gap-1 rounded shrink-0" onClick={approveAll}>
              <CheckCheck className="h-3 w-3" />
              Approve All
            </Button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/60 px-3 py-3 shrink-0 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about threats, data flows…"
            className="min-h-[40px] max-h-28 resize-none text-sm rounded-lg"
            disabled={isStreaming}
            rows={2}
          />
          <div className="flex flex-col gap-1">
            {isStreaming ? (
              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-lg" onClick={stopStreaming} title="Stop">
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={handleSend} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          ↵ Send · ⇧↵ New line
        </p>
      </div>
    </div>
  );
}

// ── Inspector Panel ───────────────────────────────────────────────────────────

const NODE_TYPES_CONFIG = [
  { value: 'process',   label: 'Process',   Icon: Cpu,      colorVar: 'var(--primary)' },
  { value: 'datastore', label: 'Data Store', Icon: Database, colorVar: 'var(--element-datastore)' },
  { value: 'external',  label: 'External',  Icon: Globe,    colorVar: 'var(--element-external)' },
  { value: 'boundary',  label: 'Boundary',  Icon: Shield,   colorVar: 'var(--element-boundary)' },
] as const;

function getNodeIcon(nodeType?: string): React.ElementType {
  switch (nodeType?.toLowerCase()) {
    case 'process': case 'service': return Cpu;
    case 'store': case 'database': return Database;
    case 'external': case 'user': case 'actor': return Globe;
    case 'boundary': case 'trust': return Shield;
    default: return Box;
  }
}

function getNodeColorStyle(nodeType?: string): React.CSSProperties {
  const color = getElementColor(nodeType);
  return {
    backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
    color: color,
  };
}

function InspectorPanel({
  selectedElement, diagramId, activeModelId, activeModelFrameworkId, canWrite,
  onRename, onDescriptionChange, onChangeNodeType, onDeleteElement,
}: {
  selectedElement: DiagramRightPanelProps['selectedElement'];
  diagramId: number | null;
  activeModelId: number | null;
  activeModelFrameworkId: number | null;
  canWrite: boolean;
  onRename: (id: string, label: string) => void;
  onDescriptionChange: (id: string, desc: string) => void;
  onChangeNodeType: (id: string, newType: string) => void;
  onDeleteElement: () => void;
}) {
  const [elementName, setElementName] = useState('');
  const [elementDescription, setElementDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeInnerTab, setActiveInnerTab] = useState('properties');

  useEffect(() => {
    if (selectedElement) {
      setElementName(selectedElement.label);
      setElementDescription(selectedElement.description ?? '');
    }
    setActiveInnerTab('properties');
  }, [selectedElement?.id]);

  if (!selectedElement) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
          <Box className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No element selected</p>
        <p className="text-xs text-muted-foreground/70">Click a node or edge to inspect it</p>
      </div>
    );
  }

  const NodeIcon = getNodeIcon(selectedElement.nodeType);
  const nodeColorStyle = getNodeColorStyle(selectedElement.nodeType);

  const handleDescriptionBlur = () => {
    if (elementDescription !== (selectedElement.description ?? '')) {
      onDescriptionChange(selectedElement.id, elementDescription);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Element header */}
      <div className="px-3 pt-3 pb-2 border-b shrink-0">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={nodeColorStyle}>
            <NodeIcon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-snug truncate">{selectedElement.label || 'Element'}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {selectedElement.nodeType && (
                <Badge variant="secondary" className="text-[10px] capitalize">{selectedElement.nodeType}</Badge>
              )}
              <Badge variant="outline" className="text-[10px] capitalize">{selectedElement.type}</Badge>
              {activeModelId ? (
                <Badge variant="outline" className="text-[10px]" style={{ color: 'var(--risk-low)', borderColor: 'color-mix(in srgb, var(--risk-low) 35%, transparent)', backgroundColor: 'color-mix(in srgb, var(--risk-low) 12%, transparent)' }}>
                  Model active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">No model</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Properties / Threats */}
      <Tabs value={activeInnerTab} onValueChange={setActiveInnerTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="px-3 pt-1.5 border-b shrink-0">
          <TabsList variant="line">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="threats">Threats &amp; Mitigations</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="properties" className="flex-1 overflow-y-auto mt-0 px-3 py-3 space-y-3">
          {/* Name */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
              <Tag className="h-2.5 w-2.5" /> ELEMENT NAME
            </p>
            <Input
              value={elementName}
              onChange={(e) => setElementName(e.target.value)}
              onBlur={() => canWrite && onRename(selectedElement.id, elementName)}
              onKeyDown={(e) => e.key === 'Enter' && canWrite && onRename(selectedElement.id, elementName)}
              placeholder="Enter element name"
              className="h-8 rounded-lg text-sm"
              readOnly={!canWrite}
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
              <Tag className="h-2.5 w-2.5" /> DESCRIPTION
            </p>
            <Textarea
              value={elementDescription}
              onChange={(e) => setElementDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Describe this element…"
              rows={3}
              className="rounded-lg resize-y text-sm"
              readOnly={!canWrite}
            />
          </div>

          <Separator />

          {/* Type picker — nodes only */}
          {selectedElement.type === 'node' && canWrite && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1">
                <Box className="h-2.5 w-2.5" /> ELEMENT TYPE
              </p>
              <div className="grid grid-cols-4 gap-1">
                {NODE_TYPES_CONFIG.map(({ value, label, Icon, colorVar }) => {
                  const active = (selectedElement.nodeType ?? 'process') === value;
                  return (
                    <button
                      key={value}
                      onClick={() => !active && onChangeNodeType(selectedElement.id, value)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-lg border text-[9px] font-semibold transition-all',
                        active ? 'border-transparent shadow-sm' : 'border-border/50 hover:border-border bg-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                      )}
                      style={active ? {
                        backgroundColor: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
                        borderColor: `color-mix(in srgb, ${colorVar} 40%, transparent)`,
                        color: colorVar,
                      } : {}}
                      title={`Change to ${label}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Element ID */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
              <Hash className="h-2.5 w-2.5" /> ELEMENT ID
            </p>
            <div className="flex items-center h-8 bg-muted/50 px-2.5 rounded-lg border overflow-hidden">
              <code className="text-[10px] font-mono truncate text-muted-foreground">{selectedElement.id}</code>
            </div>
          </div>

          {canWrite && (
            <>
              <Separator />
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-xs font-semibold text-destructive">Danger Zone</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Permanently deletes this element and all associated threats and mitigations.
                </p>
                <Button variant="destructive" size="sm" className="w-full gap-1.5 h-7 text-xs" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Element
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="threats" className="flex-1 overflow-y-auto mt-0 px-3 py-3">
          {diagramId ? (
            <ThreatManagement
              diagramId={diagramId}
              activeModelId={activeModelId}
              modelFrameworkId={activeModelFrameworkId}
              elementId={selectedElement.id}
              elementType={selectedElement.type}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted mb-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold mb-1">No diagram selected</p>
              <p className="text-xs text-muted-foreground">Open a diagram to manage threats.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Element</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold">"{selectedElement.label}"</span>? All threats and mitigations will also be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setDeleteDialogOpen(false); onDeleteElement(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main DiagramRightPanel ────────────────────────────────────────────────────

export default function DiagramRightPanel({
  activeTab, onTabChange,
  diagramId, activeModelId, frameworkId,
  unanalyzedNodes, newNodesSinceSave,
  focusedNodeIds, focusedNodeLabels, onClearFocus,
  onModelCreated, onProposalApproved,
  selectedElement,
  onRename, onDescriptionChange, onChangeNodeType, onDeleteElement,
  canWrite,
}: DiagramRightPanelProps) {
  const pendingAICount = unanalyzedNodes.length + newNodesSinceSave.length;

  return (
    <aside className="w-[440px] border-l border-border/50 bg-background flex flex-col shrink-0 min-h-0 overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-border/50 shrink-0">
        <button
          onClick={() => onTabChange('inspector')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
            activeTab === 'inspector'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Box className="h-3.5 w-3.5" />
          Inspector
          {selectedElement && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary ml-0.5" />
          )}
        </button>
        <button
          onClick={() => onTabChange('ai')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
            activeTab === 'ai'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Analysis
          {pendingAICount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {pendingAICount > 9 ? '9+' : pendingAICount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'inspector' ? (
          <InspectorPanel
            selectedElement={selectedElement}
            diagramId={diagramId}
            activeModelId={activeModelId}
            activeModelFrameworkId={frameworkId}
            canWrite={canWrite}
            onRename={onRename}
            onDescriptionChange={onDescriptionChange}
            onChangeNodeType={onChangeNodeType}
            onDeleteElement={onDeleteElement}
          />
        ) : (
          <AIPanel
            diagramId={diagramId}
            activeModelId={activeModelId}
            frameworkId={frameworkId}
            unanalyzedNodes={unanalyzedNodes}
            newNodesSinceSave={newNodesSinceSave}
            focusedNodeIds={focusedNodeIds}
            focusedNodeLabels={focusedNodeLabels}
            onClearFocus={onClearFocus}
            onModelCreated={onModelCreated}
            onProposalApproved={onProposalApproved}
          />
        )}
      </div>
    </aside>
  );
}
