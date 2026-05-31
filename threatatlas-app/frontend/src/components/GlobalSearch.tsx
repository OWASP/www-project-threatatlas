import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Box, Grid3x3, AlertTriangle, Shield, Search, Loader2 } from 'lucide-react';
import { searchApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProductResult {
  id: number;
  name: string;
  description: string | null;
  type: 'product';
}

interface DiagramResult {
  id: number;
  name: string;
  product_id: number;
  product_name: string;
  type: 'diagram';
}

interface ThreatResult {
  id: number;
  name: string;
  category: string;
  framework_name: string;
  type: 'threat';
}

interface MitigationResult {
  id: number;
  name: string;
  category: string;
  type: 'mitigation';
}

type SearchResult = ProductResult | DiagramResult | ThreatResult | MitigationResult;

interface SearchResults {
  products: ProductResult[];
  diagrams: DiagramResult[];
  threats: ThreatResult[];
  mitigations: MitigationResult[];
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function flattenResults(results: SearchResults): SearchResult[] {
  return [
    ...results.products,
    ...results.diagrams,
    ...results.threats,
    ...results.mitigations,
  ];
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ products: [], diagrams: [], threats: [], mitigations: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allResults = flattenResults(results);
  const hasResults = allResults.length > 0;
  const showEmpty = query.length >= 2 && !loading && !hasResults;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({ products: [], diagrams: [], threats: [], mitigations: [] });
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults({ products: [], diagrams: [], threats: [], mitigations: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.search(query);
        setResults(res.data);
        setActiveIndex(0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigateToResult = useCallback((result: SearchResult) => {
    onOpenChange(false);
    switch (result.type) {
      case 'product':
        navigate(`/products/${result.id}`);
        break;
      case 'diagram':
        navigate(`/diagrams?product=${(result as DiagramResult).product_id}&diagram=${result.id}`);
        break;
      case 'threat':
      case 'mitigation':
        navigate('/knowledge');
        break;
    }
  }, [navigate, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults.length > 0) {
      e.preventDefault();
      navigateToResult(allResults[activeIndex]);
    }
  };

  // Flatten all results into indexed list for keyboard nav
  let globalIndex = 0;

  function ResultSection<T extends SearchResult>({
    title,
    items,
    icon,
    renderMeta,
  }: {
    title: string;
    items: T[];
    icon: React.ReactNode;
    renderMeta: (item: T) => string;
  }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-1">
        <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
          {icon}
          {title}
        </div>
        {items.map((item) => {
          const idx = globalIndex++;
          const isActive = idx === activeIndex;
          return (
            <button
              key={item.id}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
              )}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => navigateToResult(item)}
            >
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                isActive ? 'bg-primary/15' : 'bg-muted'
              )}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground truncate">{renderMeta(item)}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                {item.type}
              </Badge>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" aria-describedby={undefined}>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          {loading
            ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            : <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, diagrams, threats, mitigations..."
            className="border-0 shadow-none focus-visible:ring-0 p-0 text-sm h-auto"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {(hasResults || showEmpty) && (
          <div className="max-h-[400px] overflow-y-auto p-2">
            {showEmpty ? (
              <div className="py-10 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No results for "{query}"</p>
              </div>
            ) : (
              <>
                <ResultSection
                  title="Products"
                  items={results.products}
                  icon={<Box className="h-3.5 w-3.5" />}
                  renderMeta={(p) => p.description ?? ''}
                />
                <ResultSection
                  title="Diagrams"
                  items={results.diagrams}
                  icon={<Grid3x3 className="h-3.5 w-3.5" />}
                  renderMeta={(d) => (d as DiagramResult).product_name}
                />
                <ResultSection
                  title="Threats"
                  items={results.threats}
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  renderMeta={(t) => `${(t as ThreatResult).framework_name} · ${(t as ThreatResult).category}`}
                />
                <ResultSection
                  title="Mitigations"
                  items={results.mitigations}
                  icon={<Shield className="h-3.5 w-3.5" />}
                  renderMeta={(m) => (m as MitigationResult).category}
                />
              </>
            )}
          </div>
        )}

        {/* Hint when empty query */}
        {query.length < 2 && !loading && (
          <div className="py-8 text-center px-4">
            <p className="text-sm text-muted-foreground">
              Type at least 2 characters to search across products, diagrams, threats, and mitigations.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default GlobalSearch;
