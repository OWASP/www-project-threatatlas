import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jiraApi, type JiraProject } from '@/lib/api';

// ── Jira logo ─────────────────────────────────────────────────────────────────

function JiraIcon({ className }: { className?: string }) {
  return <img src="/images/ticketing/jira.svg" alt="Jira" className={className} />;
}

// ── Priority badge colours ────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  Critical: 'text-red-700 border-red-300 bg-red-500/8',
  High:     'text-orange-700 border-orange-300 bg-orange-500/8',
  Medium:   'text-amber-700 border-amber-300 bg-amber-500/8',
  Low:      'text-emerald-700 border-emerald-300 bg-emerald-500/8',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface JiraIssuePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSummary: string;
  initialDescription: string;
  priority: string;
  issueType?: string;
  /**
   * Effective default project key to pre-select — caller resolves the
   * priority chain (product-level → global) before passing it here.
   */
  defaultProjectKey?: string | null;
  /** Called with the final edited values when user confirms */
  onConfirm: (summary: string, description: string, projectKey: string) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JiraIssuePreviewDialog({
  open,
  onOpenChange,
  initialSummary,
  initialDescription,
  priority,
  issueType = 'Bug',
  defaultProjectKey,
  onConfirm,
}: JiraIssuePreviewDialogProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [description, setDescription] = useState(initialDescription);
  const [projectKey, setProjectKey] = useState(defaultProjectKey ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Projects list state
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState('');

  // Refresh editable fields whenever the dialog opens with fresh data
  useEffect(() => {
    if (!open) return;
    setSummary(initialSummary);
    setDescription(initialDescription);
    setProjectKey(defaultProjectKey ?? '');

    // Fetch available projects
    setLoadingProjects(true);
    setProjectsError('');
    jiraApi.listProjects()
      .then(res => {
        setProjects(res.data);
        // Auto-select the default if it matches one in the list, otherwise keep it
        if (!defaultProjectKey && res.data.length > 0 && !projectKey) {
          // will stay empty — user must choose
        }
      })
      .catch(() => setProjectsError('Could not load projects. You can type the key manually.'))
      .finally(() => setLoadingProjects(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleConfirm() {
    const key = projectKey.trim().toUpperCase();
    if (!summary.trim() || !key) return;
    setSubmitting(true);
    try {
      await onConfirm(summary.trim(), description.trim(), key);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!summary.trim() && !!projectKey.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <JiraIcon className="h-4 w-4 shrink-0" />
            Create Jira Issue
          </DialogTitle>
          <DialogDescription>
            Review and edit the details below before submitting to Jira.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Type + Priority row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Type:</span>
              <Badge variant="outline" className="text-xs">{issueType}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Priority:</span>
              <Badge variant="outline" className={cn('text-xs', PRIORITY_BADGE[priority] ?? PRIORITY_BADGE['Medium'])}>
                {priority}
              </Badge>
            </div>
          </div>

          {/* Project selector */}
          <div className="space-y-1.5">
            <Label htmlFor="jira-project">
              Project / Board <span className="text-destructive">*</span>
            </Label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading projects…
              </div>
            ) : projects.length > 0 ? (
              <Select
                value={projectKey}
                onValueChange={setProjectKey}
                disabled={submitting}
              >
                <SelectTrigger id="jira-project">
                  <SelectValue placeholder="Select a project…" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{p.key}</span>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              /* Fallback: manual key entry when API fails or returns empty */
              <Input
                id="jira-project"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="e.g. SEC"
                disabled={submitting}
              />
            )}
            {projectsError && (
              <p className="text-xs text-muted-foreground">{projectsError}</p>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="jira-summary">
              Summary <span className="text-destructive">*</span>
            </Label>
            <Input
              id="jira-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Issue summary…"
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="jira-description">Description</Label>
            <Textarea
              id="jira-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Issue description…"
              className="resize-none font-mono text-xs min-h-[180px]"
              rows={10}
              disabled={submitting}
            />
          </div>

          {/* Inline validation hint */}
          {!canSubmit && (summary || projectKey) && (
            <p className="text-xs text-destructive">
              {!summary.trim() ? 'Summary is required.' : 'Project is required.'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            disabled={submitting || !canSubmit}
            onClick={handleConfirm}
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
            ) : (
              'Create Issue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
