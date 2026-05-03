/**
 * AI Chat hook — manages conversation state and SSE streaming.
 *
 * Uses raw fetch() for the streaming endpoint because axios does not support
 * Server-Sent Events. The Bearer token is read directly from localStorage,
 * matching the pattern used by AuthContext.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, aiConversationsApi } from '@/lib/api';
import { toast } from 'sonner';

export interface Proposal {
  id: string;
  type: 'threat' | 'mitigation' | 'remove_threat' | 'remove_mitigation' | 'create_model' | 'suggest_kb_threat' | 'suggest_kb_mitigation' | 'update_risk';
  element_id: string;
  element_type: string;
  element_label?: string;
  threat_id?: number;
  mitigation_id?: number;
  diagram_item_id?: number;
  diagram_threat_id?: number;
  name: string;
  description: string;
  category?: string;
  model_id?: number;
  framework_id?: number;
  framework_name?: string;
  reasoning?: string;
  for_threat_proposal_id?: string;
  likelihood?: number;
  impact?: number;
  risk_score?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'dismissed';
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  proposals?: Proposal[];
  created_at: string;
}

export interface Conversation {
  id: number;
  diagram_id: number;
  user_id: number;
  title: string | null;
  created_at: string;
}

interface UseAIChatOptions {
  diagramId: number | null;
  activeModelId: number | null;
  frameworkId: number | null;
  onModelCreated?: (modelId: number, model: { id: number; name: string; framework_id: number; framework_name: string }) => void;
}

export function useAIChat({ diagramId, activeModelId, frameworkId, onModelCreated }: UseAIChatOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Tracks a model created mid-conversation so subsequent messages use the right model_id
  const [createdModelId, setCreatedModelId] = useState<number | null>(null);
  const [createdFrameworkId, setCreatedFrameworkId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const effectiveModelId = createdModelId ?? activeModelId;
  const effectiveFrameworkId = createdFrameworkId ?? frameworkId;

  // Load conversations when diagram changes
  useEffect(() => {
    if (!diagramId) return;
    loadConversations();
  }, [diagramId]);

  const loadConversations = useCallback(async () => {
    if (!diagramId) return;
    try {
      const res = await aiConversationsApi.list({ diagram_id: diagramId });
      setConversations(res.data);
    } catch {
      // silently ignore
    }
  }, [diagramId]);

  const loadMessages = useCallback(async (convId: number) => {
    try {
      setIsLoading(true);
      const res = await aiConversationsApi.getMessages(convId);
      setMessages(res.data);
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (): Promise<number | null> => {
    if (!diagramId) return null;
    try {
      const res = await aiConversationsApi.create({ diagram_id: diagramId });
      const conv: Conversation = res.data;
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      return conv.id;
    } catch {
      toast.error('Failed to start conversation');
      return null;
    }
  }, [diagramId]);

  const selectConversation = useCallback(async (convId: number) => {
    setActiveConvId(convId);
    await loadMessages(convId);
  }, [loadMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    const token = localStorage.getItem('token');

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: convId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    abortRef.current = new AbortController();

    const params = new URLSearchParams();
    if (effectiveModelId) params.append('active_model_id', String(effectiveModelId));
    if (effectiveFrameworkId) params.append('framework_id', String(effectiveFrameworkId));

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ai-conversations/${convId}/messages/?${params}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
          signal: abortRef.current.signal,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              accumulatedText += data.delta;
              setStreamingContent(accumulatedText);
            } else if (data.done && data.message) {
              setStreamingContent('');
              // Replace temp user msg + add real assistant message
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
                return [
                  ...filtered,
                  { ...tempUserMsg, id: (data.message.id - 1) || tempUserMsg.id },
                  {
                    id: data.message.id,
                    conversation_id: convId!,
                    role: 'assistant' as const,
                    content: data.message.content,
                    proposals: data.message.proposals,
                    created_at: data.message.created_at,
                  },
                ];
              });
              // Refresh conversations list to update title
              await loadConversations();
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (parseErr) {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setStreamingContent('');
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      toast.error(err.message || 'AI request failed');
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [activeConvId, isStreaming, effectiveModelId, effectiveFrameworkId, createConversation, loadConversations]);

  const approveProposal = useCallback(async (
    messageId: number, proposalId: string
  ) => {
    if (!activeConvId) return;
    try {
      const res = await aiConversationsApi.approveProposal(activeConvId, messageId, proposalId);
      const result = res.data as any;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          let updatedProposals = m.proposals?.map((p) =>
            p.id === proposalId ? { ...p, status: 'approved' as const } : p
          );
          // When a model is created, patch sibling proposals with the new model_id
          if (result?.type === 'create_model' && result?.id) {
            updatedProposals = updatedProposals?.map((p) =>
              (!p.model_id && (p.type === 'threat' || p.type === 'mitigation'))
                ? { ...p, model_id: result.id }
                : p
            );
          }
          return { ...m, proposals: updatedProposals };
        })
      );

      if (result?.type === 'create_model') {
        setCreatedModelId(result.id);
        setCreatedFrameworkId(result.framework_id);
        onModelCreated?.(result.id, {
          id: result.id,
          name: result.name,
          framework_id: result.framework_id,
          framework_name: result.framework_name,
        });
        toast.success(`Threat model "${result.name}" created`);
      } else if (result?.type === 'update_risk') {
        toast.success('Risk assessment updated');
      } else if (result?.type === 'remove_threat') {
        toast.success('Threat removed from diagram');
      } else if (result?.type === 'remove_mitigation') {
        toast.success('Mitigation removed from diagram');
      } else {
        toast.success('Added to diagram');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve proposal');
    }
  }, [activeConvId, onModelCreated]);

  const dismissProposal = useCallback(async (
    messageId: number, proposalId: string
  ) => {
    if (!activeConvId) return;
    try {
      await aiConversationsApi.dismissProposal(activeConvId, messageId, proposalId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== messageId ? m : {
            ...m,
            proposals: m.proposals?.map((p) =>
              p.id === proposalId ? { ...p, status: 'dismissed' as const } : p
            ),
          }
        )
      );
    } catch {
      toast.error('Failed to dismiss proposal');
    }
  }, [activeConvId]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const deleteConversation = useCallback(async (convId: number) => {
    try {
      await aiConversationsApi.delete(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
        setCreatedModelId(null);
        setCreatedFrameworkId(null);
      }
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    }
  }, [activeConvId]);

  const approveAll = useCallback(async () => {
    if (!activeConvId) return;
    try {
      const res = await aiConversationsApi.approveAll(activeConvId);
      const { created_threats, created_mitigations, created_models } = res.data as any;

      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          proposals: m.proposals?.map((p) =>
            p.status === 'pending' && p.type !== 'remove_threat' && p.type !== 'remove_mitigation'
              ? { ...p, status: 'approved' as const }
              : p
          ),
        }))
      );

      if (created_models?.length > 0) {
        const latest = created_models[created_models.length - 1];
        setCreatedModelId(latest.id);
        setCreatedFrameworkId(latest.framework_id);
        onModelCreated?.(latest.id, latest);
      }

      const parts: string[] = [];
      if (created_models?.length) parts.push(`${created_models.length} model${created_models.length !== 1 ? 's' : ''} created`);
      parts.push(`${created_threats} threat${created_threats !== 1 ? 's' : ''}`);
      parts.push(`${created_mitigations} mitigation${created_mitigations !== 1 ? 's' : ''} added`);
      toast.success(`Approved all — ${parts.join(', ')}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve all proposals');
    }
  }, [activeConvId, onModelCreated]);

  // Pending model-creation proposals (shown separately — must be approved before threats)
  const pendingModelCount = messages.reduce(
    (sum, m) => sum + (m.proposals?.filter(
      (p) => p.status === 'pending' && p.type === 'create_model'
    ).length ?? 0),
    0
  );

  // Pending add-proposals (removals and model creation excluded — those need individual approval)
  const pendingCount = messages.reduce(
    (sum, m) => sum + (m.proposals?.filter(
      (p) => p.status === 'pending' && p.type !== 'remove_threat' && p.type !== 'remove_mitigation'
    ).length ?? 0),
    0
  );

  const pendingRemovalCount = messages.reduce(
    (sum, m) => sum + (m.proposals?.filter(
      (p) => p.status === 'pending' && (p.type === 'remove_threat' || p.type === 'remove_mitigation')
    ).length ?? 0),
    0
  );

  return {
    conversations,
    activeConvId,
    messages,
    streamingContent,
    isStreaming,
    isLoading,
    pendingCount,
    pendingRemovalCount,
    pendingModelCount,
    effectiveModelId,
    sendMessage,
    selectConversation,
    createConversation,
    deleteConversation,
    approveProposal,
    dismissProposal,
    approveAll,
    stopStreaming,
  };
}
