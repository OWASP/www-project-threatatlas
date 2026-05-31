import { createContext, useContext, useState, useCallback } from 'react';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
  /** If true, renders an editable input instead of a static label */
  editable?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}

interface BreadcrumbContextValue {
  extra: BreadcrumbCrumb[];
  setExtra: (crumbs: BreadcrumbCrumb[]) => void;
  clearExtra: () => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  extra: [],
  setExtra: () => {},
  clearExtra: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtraState] = useState<BreadcrumbCrumb[]>([]);
  const setExtra = useCallback((crumbs: BreadcrumbCrumb[]) => setExtraState(crumbs), []);
  const clearExtra = useCallback(() => setExtraState([]), []);
  return (
    <BreadcrumbContext.Provider value={{ extra, setExtra, clearExtra }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
