import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThreatCard from '@/components/ThreatCard';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock sonner toast so we don't need a Toaster in the tree
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock the Jira API
vi.mock('@/lib/api', () => ({
  jiraApi: {
    createIssue: vi.fn(),
  },
}));

const makeThreat = (overrides = {}) => ({
  id: 1,
  status: 'identified',
  comments: '',
  severity: 'high' as const,
  risk_score: 15,
  threat: {
    name: 'SQL Injection',
    description: 'Attacker can inject SQL',
    category: 'Injection',
  },
  ...overrides,
});

const makeMitigation = (name = 'Parameterized queries', status = 'implemented') => ({
  id: 1,
  status,
  comments: '',
  mitigation: { name, description: 'Use parameterized queries', category: 'Input Validation' },
});

const defaultProps = {
  threat: makeThreat(),
  linkedMitigations: [],
  onOpen: vi.fn(),
};

function renderCard(props = {}) {
  return render(
    <TooltipProvider>
      <ThreatCard {...defaultProps} {...props} />
    </TooltipProvider>
  );
}

// ── Rendering ──────────────────────────────────────────────────────────────────

describe('ThreatCard rendering', () => {
  it('displays the threat name', () => {
    renderCard();
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('displays the threat description', () => {
    renderCard();
    expect(screen.getByText('Attacker can inject SQL')).toBeInTheDocument();
  });

  it('displays the category badge', () => {
    renderCard();
    expect(screen.getByText('Injection')).toBeInTheDocument();
  });

  it('hides progress bar when there are no mitigations', () => {
    renderCard();
    expect(document.querySelector('[role="progressbar"]')).not.toBeInTheDocument();
  });

  it('shows mitigation count and progress when mitigations exist', () => {
    renderCard({
      linkedMitigations: [
        makeMitigation('Fix A', 'implemented'),
        makeMitigation('Fix B', 'identified'),
      ],
    });
    expect(screen.getByText('2 Mitigations')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

// ── Mitigation progress calculation ───────────────────────────────────────────

describe('mitigation progress bar', () => {
  it('counts implemented and verified as done', () => {
    renderCard({
      linkedMitigations: [
        makeMitigation('A', 'implemented'),
        makeMitigation('B', 'verified'),
        makeMitigation('C', 'identified'),
      ],
    });
    expect(screen.getByText('67%')).toBeInTheDocument(); // round(2/3*100)
  });

  it('shows 0% when all mitigations are pending', () => {
    renderCard({
      linkedMitigations: [
        makeMitigation('A', 'identified'),
        makeMitigation('B', 'proposed'),
      ],
    });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});

// ── JIRA button visibility ─────────────────────────────────────────────────────
// ThreatCard renders an inline Jira action (aria-label "Create Jira issue")
// only when jiraConfigured is true; clicking it opens the Jira dialog.

describe('JIRA integration', () => {
  it('does not show the Jira action when jiraConfigured=false', () => {
    renderCard({ jiraConfigured: false });
    expect(screen.queryByLabelText('Create Jira issue')).not.toBeInTheDocument();
  });

  it('shows the Jira action when jiraConfigured=true', () => {
    renderCard({ jiraConfigured: true });
    expect(screen.getByLabelText('Create Jira issue')).toBeInTheDocument();
  });
});

// ── GitHub deep-link ───────────────────────────────────────────────────────────
// ThreatCard renders an inline GitHub action (aria-label "Create GitHub issue")
// wrapping an <a> that deep-links to the repo's new-issue page. It is hidden
// entirely when no repoUrl is provided.

describe('GitHub deep-link', () => {
  it('renders a GitHub new-issue link when repoUrl is valid', () => {
    const { container } = renderCard({ repoUrl: 'https://github.com/owner/repo' });
    expect(screen.getByLabelText('Create GitHub issue')).toBeInTheDocument();
    const link = container.querySelector('a[href*="issues/new"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.href).toContain('github.com/owner/repo/issues/new');
  });

  it('hides the GitHub action when no repoUrl', () => {
    const { container } = renderCard({ repoUrl: null });
    expect(screen.queryByLabelText('Create GitHub issue')).not.toBeInTheDocument();
    expect(container.querySelector('a[href*="issues/new"]')).toBeNull();
  });
});

// ── onOpen callback ────────────────────────────────────────────────────────────

describe('onOpen callback', () => {
  it('calls onOpen when card is clicked', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });
    fireEvent.click(screen.getByText('SQL Injection'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
