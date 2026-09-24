import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThreatManagement from '@/components/ThreatManagement';
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


describe('ThreatManagement risk acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(diagramThreatsApi.list).mockResolvedValue(response([threat]));
    vi.mocked(diagramThreatsApi.update).mockResolvedValue(response(threat));
    vi.mocked(threatsApi.list).mockResolvedValue(response([]));
    vi.mocked(frameworksApi.list).mockResolvedValue(response([]));
    vi.mocked(diagramMitigationsApi.list).mockResolvedValue(response([]));
    vi.mocked(mitigationsApi.list).mockResolvedValue(response([]));
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
