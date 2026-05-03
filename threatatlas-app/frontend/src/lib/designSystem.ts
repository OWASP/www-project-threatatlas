// Design System Color Utilities
// Centralized design system colors for consistent branding

export const designSystemColors = {
  // Semantic element colors
  threat: 'var(--element-threat)',
  mitigation: 'var(--element-mitigation)',
  removal: 'var(--element-removal)',

  // Process elements
  process: 'var(--primary)',
  datastore: 'var(--element-datastore)',
  external: 'var(--element-external)',
  boundary: 'var(--ds-stone-gray)',

  // Status colors
  success: 'var(--element-mitigation)',
  error: 'var(--element-threat)',
  warning: 'var(--element-removal)',

  // Text colors
  primary: 'var(--ds-near-black)',
  secondary: 'var(--ds-olive-gray)',
  tertiary: 'var(--ds-stone-gray)',
};

export const getElementColor = (elementType: string): string => {
  switch (elementType?.toLowerCase()) {
    case 'process':
      return designSystemColors.process;
    case 'datastore':
      return designSystemColors.datastore;
    case 'external':
      return designSystemColors.external;
    case 'boundary':
      return designSystemColors.boundary;
    default:
      return designSystemColors.process;
  }
};

export const getThreatStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'mitigated':
      return designSystemColors.success;
    case 'accepted':
      return designSystemColors.tertiary;
    case 'identified':
      return designSystemColors.error;
    default:
      return designSystemColors.warning;
  }
};

export const getMitigationStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'implemented':
    case 'verified':
      return designSystemColors.success;
    case 'proposed':
      return designSystemColors.warning;
    default:
      return designSystemColors.secondary;
  }
};

export const getProposalTypeColor = (type: string): { text: string; bg: string; border: string } => {
  const isRemoval = type === 'remove_threat' || type === 'remove_mitigation';
  const isThreat = type === 'threat';

  if (isRemoval) {
    return {
      text: designSystemColors.removal,
      bg: `color-mix(in srgb, var(--element-removal) 4%, transparent)`,
      border: `color-mix(in srgb, var(--element-removal) 20%, transparent)`,
    };
  }
  if (isThreat) {
    return {
      text: designSystemColors.error,
      bg: `color-mix(in srgb, var(--element-threat) 4%, transparent)`,
      border: `color-mix(in srgb, var(--element-threat) 20%, transparent)`,
    };
  }
  return {
    text: designSystemColors.success,
    bg: `color-mix(in srgb, var(--element-mitigation) 4%, transparent)`,
    border: `color-mix(in srgb, var(--element-mitigation) 20%, transparent)`,
  };
};

export const getChangeColor = (changeType: string): string => {
  switch (changeType?.toLowerCase()) {
    case 'added':
      return designSystemColors.success;
    case 'removed':
      return designSystemColors.error;
    case 'modified':
      return designSystemColors.warning;
    default:
      return designSystemColors.secondary;
  }
};
