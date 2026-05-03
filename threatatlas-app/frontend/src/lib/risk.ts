export function getSeverity(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 20) return 'critical';
  if (riskScore >= 12) return 'high';
  if (riskScore >= 6) return 'medium';
  return 'low';
}

export function getSeverityVariant(severity: string | null): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'outline';
  }
}

export function getSeverityColor(severity: string | null): string {
  switch (severity) {
    case 'critical':
      return 'var(--risk-critical)';
    case 'high':
      return 'var(--risk-high)';
    case 'medium':
      return 'var(--risk-medium)';
    case 'low':
      return 'var(--risk-low)';
    default:
      return 'var(--border)';
  }
}

export function getSeverityClasses(severity: string | null): string {
  switch (severity) {
    case 'critical': return 'severity-critical';
    case 'high': return 'severity-high';
    case 'medium': return 'severity-medium';
    case 'low': return 'severity-low';
    default: return '';
  }
}

export function getSeverityStripeClass(severity: string | null): string {
  switch (severity) {
    case 'critical': return 'severity-stripe-critical';
    case 'high': return 'severity-stripe-high';
    case 'medium': return 'severity-stripe-medium';
    case 'low': return 'severity-stripe-low';
    default: return 'bg-border';
  }
}

export function getStatusClasses(status: string): string {
  switch (status) {
    case 'identified': return 'status-identified';
    case 'mitigated': return 'status-mitigated';
    case 'accepted': return 'status-accepted';
    case 'proposed': return 'status-proposed';
    case 'implemented': return 'status-implemented';
    case 'verified': return 'status-verified';
    default: return '';
  }
}
