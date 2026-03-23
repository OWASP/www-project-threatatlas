import changelogData from '@/data/changelog.json';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Wrench, Zap, Rocket, CheckCircle2, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangelogEntry {
  type: 'added' | 'improved' | 'fixed' | 'removed';
  text: string;
}

interface ChangelogVersion {
  version: string;
  date: string;
  tag: 'unreleased' | 'feature' | 'initial' | 'patch';
  entries: ChangelogEntry[];
}

const entryConfig: Record<ChangelogEntry['type'], { label: string; icon: React.ElementType; className: string; dotClass: string }> = {
  added: {
    label: 'Added',
    icon: Plus,
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700/50',
    dotClass: 'bg-emerald-500',
  },
  improved: {
    label: 'Improved',
    icon: Zap,
    className: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-700/50',
    dotClass: 'bg-blue-500',
  },
  fixed: {
    label: 'Fixed',
    icon: Wrench,
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-700/50',
    dotClass: 'bg-amber-500',
  },
  removed: {
    label: 'Removed',
    icon: CheckCircle2,
    className: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/30 dark:border-red-700/50',
    dotClass: 'bg-red-500',
  },
};

const tagConfig: Record<ChangelogVersion['tag'], { label: string; className: string; icon: React.ElementType }> = {
  unreleased: {
    label: 'Unreleased',
    icon: GitBranch,
    className: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/50',
  },
  feature: {
    label: 'Feature Release',
    icon: Rocket,
    className: 'bg-primary/10 text-primary border-primary/30',
  },
  initial: {
    label: 'Initial Release',
    icon: Rocket,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50',
  },
  patch: {
    label: 'Patch',
    icon: Wrench,
    className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50',
  },
};

function VersionCard({ item, index }: { item: ChangelogVersion; index: number }) {
  const tag = tagConfig[item.tag] ?? tagConfig.feature;
  const TagIcon = tag.icon;
  const isUnreleased = item.tag === 'unreleased';

  const grouped = item.entries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    if (!acc[entry.type]) acc[entry.type] = [];
    acc[entry.type].push(entry);
    return acc;
  }, {});

  return (
    <div
      className="relative pl-10 animate-slideUp"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-transform duration-200 hover:scale-110',
          isUnreleased
            ? 'border-purple-400 bg-purple-100 dark:border-purple-600 dark:bg-purple-900/40'
            : 'border-primary/40 bg-primary/10 dark:border-primary/50 dark:bg-primary/20'
        )}
      >
        <TagIcon className={cn('h-3.5 w-3.5', isUnreleased ? 'text-purple-600 dark:text-purple-300' : 'text-primary')} />
      </div>

      <Card
        className={cn(
          'border-border/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden',
          isUnreleased && 'border-purple-200/60 dark:border-purple-700/30'
        )}
      >
        {/* Top accent bar */}
        <div
          className={cn(
            'h-0.5 w-full',
            isUnreleased
              ? 'bg-gradient-to-r from-purple-400 to-purple-300'
              : 'bg-gradient-to-r from-primary/60 to-primary/20'
          )}
        />

        <CardContent className="p-5">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">
                {isUnreleased ? 'Unreleased' : `v${item.version}`}
              </h2>
              <Badge variant="outline" className={cn('border text-xs font-semibold px-2 py-0.5', tag.className)}>
                {tag.label}
              </Badge>
            </div>
            <time
              dateTime={item.date}
              className="text-sm text-muted-foreground font-medium tabular-nums"
            >
              {new Date(item.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>

          {/* Entries grouped by type */}
          <div className="space-y-4">
            {(Object.keys(entryConfig) as ChangelogEntry['type'][])
              .filter((type) => grouped[type]?.length)
              .map((type) => {
                const cfg = entryConfig[type];
                const Icon = cfg.icon;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={cn('border text-xs font-semibold gap-1 px-2 py-0.5', cfg.className)}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {grouped[type].map((entry, i) => (
                        <li key={i} className="flex items-start gap-2.5 group">
                          <span
                            className={cn(
                              'mt-2 h-1.5 w-1.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125',
                              cfg.dotClass
                            )}
                          />
                          <span className="text-sm text-foreground/80 leading-relaxed">{entry.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Changelog() {
  const data = changelogData as ChangelogVersion[];

  return (
    <div className="flex-1 p-4 mx-auto w-full">

      {/* Timeline container */}
      <div className="relative space-y-6">
        {/* Vertical line */}
        <div className="absolute left-4 top-4 bottom-4 w-px bg-gradient-to-b from-primary/30 via-border to-transparent" />

        {data.map((item, index) => (
          <VersionCard key={item.version} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}

