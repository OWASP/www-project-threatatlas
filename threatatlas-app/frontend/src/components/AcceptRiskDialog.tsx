import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { toast } from 'sonner';

interface Member {
  id: number;
  email: string;
  full_name: string | null;
  username: string;
}

export interface AcceptRiskDialogProps {
  open: boolean;
  threatName: string;
  diagramThreatId: number;
  diagramId: number;
  productId: number;
  onConfirm: (data: {
    justification: string;
    approver_id?: number;
    review_date?: string;
  }) => void;
  onCancel: () => void;
}

export function AcceptRiskDialog({
  open,
  threatName,
  productId,
  onConfirm,
  onCancel,
}: AcceptRiskDialogProps) {
  const [justification, setJustification] = useState('');
  const [approverId, setApproverId] = useState<string>('none');
  const [reviewDate, setReviewDate] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!open) {
      setJustification('');
      setApproverId('none');
      setReviewDate('');
      return;
    }

    setLoadingMembers(true);
    usersApi
      .list()
      .then((res) => setMembers(res.data))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [open]);

  const isValid = justification.trim().length >= 10;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      justification: justification.trim(),
      approver_id: approverId && approverId !== 'none' ? parseInt(approverId) : undefined,
      review_date: reviewDate || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Accept Risk — {threatName}
          </DialogTitle>
          <DialogDescription>
            Document why this risk is being accepted. A justification is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Justification */}
          <div className="space-y-1.5">
            <Label htmlFor="justification">
              Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justification"
              placeholder="Explain why this risk is being accepted (minimum 10 characters)..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {justification.length > 0 && justification.trim().length < 10 && (
              <p className="text-xs text-destructive">
                Justification must be at least 10 characters.
              </p>
            )}
          </div>

          {/* Approver */}
          <div className="space-y-1.5">
            <Label htmlFor="approver">Approver <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={approverId} onValueChange={setApproverId} disabled={loadingMembers}>
              <SelectTrigger id="approver">
                <SelectValue placeholder={loadingMembers ? 'Loading members…' : 'Select approver'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.full_name ? `${m.full_name} (${m.email})` : m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Review date */}
          <div className="space-y-1.5">
            <Label htmlFor="review-date">Review Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="review-date"
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!isValid}
            onClick={handleConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Accept Risk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AcceptRiskDialog;
