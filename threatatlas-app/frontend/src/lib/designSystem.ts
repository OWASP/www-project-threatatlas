// Maps DFD element types to their theme color (see "DFD Element Colors" in index.css).
export const getElementColor = (elementType: string): string => {
  switch (elementType?.toLowerCase()) {
    case 'datastore':
      return 'var(--element-datastore)';
    case 'external':
      return 'var(--element-external)';
    case 'boundary':
      return 'var(--element-boundary)';
    case 'process':
    default:
      return 'var(--element-process)';
  }
};
