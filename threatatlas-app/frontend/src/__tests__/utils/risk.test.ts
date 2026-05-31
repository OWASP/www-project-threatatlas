import { describe, it, expect } from 'vitest';
import {
  getSeverity,
  getSeverityVariant,
  getSeverityColor,
  getSeverityClasses,
  getSeverityStripeClass,
  getStatusClasses,
} from '@/lib/risk';

describe('getSeverity', () => {
  it('returns critical for score >= 20', () => {
    expect(getSeverity(20)).toBe('critical');
    expect(getSeverity(25)).toBe('critical');
  });

  it('returns high for score 12–19', () => {
    expect(getSeverity(12)).toBe('high');
    expect(getSeverity(19)).toBe('high');
  });

  it('returns medium for score 6–11', () => {
    expect(getSeverity(6)).toBe('medium');
    expect(getSeverity(11)).toBe('medium');
  });

  it('returns low for score below 6', () => {
    expect(getSeverity(0)).toBe('low');
    expect(getSeverity(5)).toBe('low');
  });
});

describe('getSeverityVariant', () => {
  it('maps critical → destructive', () => expect(getSeverityVariant('critical')).toBe('destructive'));
  it('maps high → default', () => expect(getSeverityVariant('high')).toBe('default'));
  it('maps medium → secondary', () => expect(getSeverityVariant('medium')).toBe('secondary'));
  it('maps low → outline', () => expect(getSeverityVariant('low')).toBe('outline'));
  it('maps null → outline', () => expect(getSeverityVariant(null)).toBe('outline'));
  it('maps unknown → outline', () => expect(getSeverityVariant('unknown')).toBe('outline'));
});

describe('getSeverityClasses', () => {
  it('returns correct class for each severity', () => {
    expect(getSeverityClasses('critical')).toBe('severity-critical');
    expect(getSeverityClasses('high')).toBe('severity-high');
    expect(getSeverityClasses('medium')).toBe('severity-medium');
    expect(getSeverityClasses('low')).toBe('severity-low');
  });

  it('returns empty string for null/unknown', () => {
    expect(getSeverityClasses(null)).toBe('');
    expect(getSeverityClasses('unknown')).toBe('');
  });
});

describe('getSeverityStripeClass', () => {
  it('returns stripe class for each severity', () => {
    expect(getSeverityStripeClass('critical')).toBe('severity-stripe-critical');
    expect(getSeverityStripeClass('high')).toBe('severity-stripe-high');
    expect(getSeverityStripeClass('medium')).toBe('severity-stripe-medium');
    expect(getSeverityStripeClass('low')).toBe('severity-stripe-low');
  });

  it('falls back to bg-border for null/unknown', () => {
    expect(getSeverityStripeClass(null)).toBe('bg-border');
  });
});

describe('getStatusClasses', () => {
  const cases: [string, string][] = [
    ['identified', 'status-identified'],
    ['mitigated', 'status-mitigated'],
    ['accepted', 'status-accepted'],
    ['proposed', 'status-proposed'],
    ['implemented', 'status-implemented'],
    ['verified', 'status-verified'],
  ];

  it.each(cases)('maps %s → %s', (status, expected) => {
    expect(getStatusClasses(status)).toBe(expected);
  });

  it('returns empty string for unknown status', () => {
    expect(getStatusClasses('unknown')).toBe('');
  });
});
