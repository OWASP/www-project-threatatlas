import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcceptRiskDialog from '@/components/AcceptRiskDialog';
import { productMembersApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  productMembersApi: { list: vi.fn() },
}));

const response = <T,>(data: T) => ({ data }) as AxiosResponse<T>;

describe('AcceptRiskDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productMembersApi.list).mockResolvedValue(response([{
      id: 7,
      email: 'reviewer@example.com',
      full_name: 'Risk Reviewer',
      username: 'reviewer',
    }]));
  });

  it('loads eligible approvers from the current product for standard users', async () => {
    render(
      <AcceptRiskDialog
        open
        threatName="Data disclosure"
        diagramThreatId={1}
        diagramId={2}
        productId={42}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => expect(productMembersApi.list).toHaveBeenCalledWith(42));
    fireEvent.click(screen.getByRole('combobox', { name: /approver/i }));
    expect(await screen.findByText('Risk Reviewer (reviewer@example.com)')).toBeInTheDocument();
  });
});
