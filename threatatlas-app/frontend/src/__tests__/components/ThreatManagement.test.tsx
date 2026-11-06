import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThreatManagement from '@/components/ThreatManagement';
import { toast } from 'sonner';
import {
  diagramMitigationsApi,
  diagramThreatsApi,
  frameworksApi,
  mitigationsApi,
  threatsApi,
} from '@/lib/api';

vi.mock('@/lib/api', () => ({
  diagramThreatsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  threatsApi: { list: vi.fn(), create: vi.fn() },
  frameworksApi: { list: vi.fn() },
  diagramMitigationsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mitigationsApi: { list: vi.fn(), create: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'editor@example.com', full_name: 'Diagram Editor' },
    canWrite: true,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/RiskSelector', () => ({
  RiskSelector: () => null,
}));

vi.mock('@/components/ResidualRiskAssessment', () => ({
  ResidualRiskAssessment: () => null,
}));

vi.mock('@/components/CommentSection', () => ({
  CommentSection: () => null,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@/components/AcceptRiskDialog', () => ({
  AcceptRiskDialog: ({
    open,
    productId,
    onConfirm,
  }: {
    open: boolean;
    productId: number;
    onConfirm: (data: {
      justification: string;
      approver_id?: number;
      review_date?: string;
    }) => void;
  }) => open ? (
    <div role="dialog" aria-label="Accept Risk">
      <span>Product {productId}</span>
      <button
        onClick={() => onConfirm({
          justification: 'Business owner approved this exception.',
          approver_id: 7,
          review_date: '2026-12-01',
        })}
      >
        Confirm acceptance
      </button>
    </div>
  ) : null,
}));

const threat = {
  id: 11,
  threat_id: 5,
  status: 'identified',
  comments: '',
  likelihood: 3,
  impact: 4,
  risk_score: 12,
  residual_likelihood: null,
  residual_impact: null,
  residual_risk_score: null,
  residual_severity: null,
  residual_comments: null,
  severity: 'high',
  element_id: 'node-1',
  threat: {
    id: 5,
    framework_id: 4,
    name: 'SQL injection',
    description: 'Unsanitized database input',
    category: 'Injection',
    is_custom: false,
  },
};
const response = <T,>(data: T) => ({ data }) as AxiosResponse<T>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const inspectorProps = {
  diagramId: 2, productId: 42, activeModelId: 3, modelFrameworkId: 4,
  elementId: 'node-1', elementType: 'node',
};

describe('ThreatManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(diagramThreatsApi.list).mockResolvedValue(response([threat]));
    vi.mocked(diagramThreatsApi.update).mockResolvedValue(response(threat));
    vi.mocked(threatsApi.list).mockResolvedValue(response([]));
    vi.mocked(frameworksApi.list).mockResolvedValue(response([]));
    vi.mocked(diagramMitigationsApi.list).mockResolvedValue(response([]));
    vi.mocked(mitigationsApi.list).mockResolvedValue(response([]));
  });

  it('keeps the latest element when an older load finishes last', async () => {
    const oldLoad = deferred<AxiosResponse<typeof threat[]>>();
    const current = { ...threat, id: 22, element_id: 'node-2', threat: { ...threat.threat, name: 'Current threat' } };
    vi.mocked(diagramThreatsApi.list)
      .mockReturnValueOnce(oldLoad.promise)
      .mockResolvedValueOnce(response([current]));
    const { rerender } = render(<ThreatManagement {...inspectorProps} />);
    rerender(<ThreatManagement {...inspectorProps} elementId="node-2" />);
    expect(await screen.findByText('Current threat')).toBeInTheDocument();
    await act(async () => oldLoad.resolve(response([threat])));
    expect(screen.getByText('Current threat')).toBeInTheDocument();
    expect(screen.queryByText('SQL injection')).not.toBeInTheDocument();
  });

  it('ignores obsolete errors without clearing the current loading state', async () => {
    const oldLoad = deferred<AxiosResponse<typeof threat[]>>();
    const currentLoad = deferred<AxiosResponse<typeof threat[]>>();
    vi.mocked(diagramThreatsApi.list)
      .mockReturnValueOnce(oldLoad.promise)
      .mockReturnValueOnce(currentLoad.promise);
    const { rerender } = render(<ThreatManagement {...inspectorProps} />);
    rerender(<ThreatManagement {...inspectorProps} elementId="node-2" />);
    await act(async () => oldLoad.reject(new Error('Obsolete request')));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText('No threats identified')).not.toBeInTheDocument();
    await act(async () => currentLoad.resolve(response([])));
    expect(screen.getByText('No threats identified')).toBeInTheDocument();
  });

  it('also ignores a stale batch delayed by mitigation loading', async () => {
    const oldMitigations = deferred<AxiosResponse<never[]>>();
    const current = { ...threat, id: 22, element_id: 'node-2', threat: { ...threat.threat, name: 'Current threat' } };
    vi.mocked(diagramThreatsApi.list)
      .mockResolvedValueOnce(response([threat]))
      .mockResolvedValueOnce(response([current]));
    vi.mocked(diagramMitigationsApi.list)
      .mockReturnValueOnce(oldMitigations.promise)
      .mockResolvedValueOnce(response([]));
    const { rerender } = render(<ThreatManagement {...inspectorProps} />);
    rerender(<ThreatManagement {...inspectorProps} elementId="node-2" />);
    await screen.findByText('Current threat');
    await act(async () => oldMitigations.resolve(response([])));
    expect(screen.getByText('Current threat')).toBeInTheDocument();
    expect(screen.queryByText('SQL injection')).not.toBeInTheDocument();
  });

  it('still reports errors for the current selection', async () => {
    const error = new Error('Current request failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(diagramThreatsApi.list).mockRejectedValueOnce(error);
      render(<ThreatManagement {...inspectorProps} />);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load threats'));
      expect(log).toHaveBeenCalledWith('Error loading threats:', error);
    } finally {
      log.mockRestore();
    }
  });

  it('reloads catalogues when only the framework changes', async () => {
    const { rerender } = render(<ThreatManagement {...inspectorProps} />);
    await screen.findByText('SQL injection');
    rerender(<ThreatManagement {...inspectorProps} modelFrameworkId={5} />);
    await waitFor(() => {
      expect(threatsApi.list).toHaveBeenLastCalledWith({ framework_id: 5 });
      expect(mitigationsApi.list).toHaveBeenLastCalledWith({ framework_id: 5 });
    });
  });

  it('ignores a pending load error after unmount', async () => {
    const pending = deferred<AxiosResponse<typeof threat[]>>();
    vi.mocked(diagramThreatsApi.list).mockReturnValueOnce(pending.promise);
    const { unmount } = render(<ThreatManagement {...inspectorProps} />);
    unmount();
    await act(async () => pending.reject(new Error('Unmounted request')));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('clears the previous selection when no diagram is selected', async () => {
    const { rerender } = render(<ThreatManagement {...inspectorProps} />);
    await screen.findByText('SQL injection');
    rerender(<ThreatManagement {...inspectorProps} diagramId={null} />);
    expect(await screen.findByText('No threats identified')).toBeInTheDocument();
    expect(screen.queryByText('SQL injection')).not.toBeInTheDocument();
  });

  it('requires the acceptance dialog before updating an accepted threat', async () => {
    render(
      <ThreatManagement
        diagramId={2}
        productId={42}
        activeModelId={3}
        modelFrameworkId={4}
        elementId="node-1"
        elementType="process"
      />,
    );

    fireEvent.click(await screen.findByText('SQL injection'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'accepted' } });

    expect(await screen.findByRole('dialog', { name: 'Accept Risk' })).toBeInTheDocument();
    expect(screen.getByText('Product 42')).toBeInTheDocument();
    expect(diagramThreatsApi.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm acceptance' }));

    await waitFor(() => expect(diagramThreatsApi.update).toHaveBeenCalledWith(11, {
      status: 'accepted',
      acceptance_justification: 'Business owner approved this exception.',
      acceptance_approver_id: 7,
      acceptance_review_date: '2026-12-01',
    }));
  });
});
