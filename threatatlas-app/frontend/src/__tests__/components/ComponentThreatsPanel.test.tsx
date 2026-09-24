import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ComponentThreatsPanel from '@/components/ComponentThreatsPanel';
import { componentTemplatesApi } from '@/lib/api';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/api', () => ({
  componentTemplatesApi: {
    get: vi.fn(),
    apply: vi.fn(),
  },
}));

const response = <T,>(data: T) => ({ data }) as AxiosResponse<T>;

describe('ComponentThreatsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(componentTemplatesApi.get).mockResolvedValue(response({
      id: 3,
      name: 'API',
      slug: 'api',
      category: 'Services',
      node_type: 'process',
      icon: null,
      description: null,
      threat_count: 1,
      is_custom: false,
      is_modified: false,
      threats: [{
        id: 11,
        name: 'Identity spoofing',
        description: null,
        category: 'Spoofing',
        framework_id: 1,
        framework_name: 'STRIDE',
      }],
      mitigations: [{
        id: 21,
        name: 'Strong authentication',
        description: null,
        category: 'Spoofing',
        framework_id: 1,
        framework_name: 'STRIDE',
      }],
    }));
    vi.mocked(componentTemplatesApi.apply).mockResolvedValue(response({
      threats_added: 1,
      mitigations_added: 1,
      threats_skipped: 0,
      mitigations_skipped: 0,
    }));
  });

  it('sends the displayed mitigation as a link to its threat', async () => {
    render(
      <ComponentThreatsPanel
        componentId={3}
        nodeName="API"
        nodeId="node-1"
        nodeType="process"
        diagramId={4}
        modelId={5}
        frameworkId={1}
        frameworkName="STRIDE"
        onClose={vi.fn()}
        onApplied={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Add to diagram' }));

    await waitFor(() => expect(componentTemplatesApi.apply).toHaveBeenCalledWith(3, {
      diagram_id: 4,
      model_id: 5,
      element_id: 'node-1',
      element_type: 'process',
      threat_ids: [11],
      mitigation_ids: [21],
      mitigation_links: [{ threat_id: 11, mitigation_id: 21 }],
    }));
  });
});
