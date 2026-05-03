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

const entryConfig: Record<ChangelogEntry['type'], { label: string; icon: React.ElementType; badgeStyle: React.CSSProperties; dotStyle: React.CSSProperties }> = {
  added: {
    label: 'Added',
    icon: Plus,
    badgeStyle: { color: 'var(--risk-low)', backgroundColor: 'var(--risk-low-muted)', borderColor: 'color-mix(in srgb, var(--matcha-600) 35%, transparent)' },
    dotStyle: { backgroundColor: 'var(--risk-low)' },
  },
  improved: {
    label: 'Improved',
    icon: Zap,
    badgeStyle: { color: 'var(--risk-high)', backgroundColor: 'var(--risk-high-muted)', borderColor: 'color-mix(in srgb, var(--pomegranate-400) 40%, transparent)' },
    dotStyle: { backgroundColor: 'var(--primary)' },
  },
  fixed: {
    label: 'Fixed',
    icon: Wrench,
    badgeStyle: { color: 'var(--risk-medium)', backgroundColor: 'var(--risk-medium-muted)', borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)' },
    dotStyle: { backgroundColor: 'var(--risk-medium)' },
  },
  removed: {
    label: 'Removed',
    icon: CheckCircle2,
    badgeStyle: { color: 'var(--risk-critical)', backgroundColor: 'var(--risk-critical-muted)', borderColor: 'color-mix(in srgb, var(--pomegranate-600) 40%, transparent)' },
    dotStyle: { backgroundColor: 'var(--risk-critical)' },
  },
};

const tagConfig: Record<ChangelogVersion['tag'], { label: string; badgeStyle: React.CSSProperties; icon: React.ElementType; iconStyle: React.CSSProperties }> = {
  unreleased: {
    label: 'Unreleased',
    icon: GitBranch,
    badgeStyle: { backgroundColor: 'color-mix(in srgb, var(--ube-800) 12%, transparent)', color: 'var(--ube-300)', borderColor: 'color-mix(in srgb, var(--ube-300) 40%, transparent)' },
    iconStyle: { color: 'var(--ube-300)' },
  },
  feature: {
    label: 'Feature Release',
    icon: Rocket,
    badgeStyle: { backgroundColor: 'var(--primary)', opacity: 0.1, color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)' },
    iconStyle: { color: 'var(--primary)' },
  },
  initial: {
    label: 'Initial Release',
    icon: Rocket,
    badgeStyle: { backgroundColor: 'var(--risk-low-muted)', color: 'var(--risk-low)', borderColor: 'color-mix(in srgb, var(--matcha-600) 35%, transparent)' },
    iconStyle: { color: 'var(--risk-low)' },
  },
  patch: {
    label: 'Patch',
    icon: Wrench,
    badgeStyle: { backgroundColor: 'var(--risk-medium-muted)', color: 'var(--risk-medium)', borderColor: 'color-mix(in srgb, var(--lemon-500) 40%, transparent)' },
    iconStyle: { color: 'var(--risk-medium)' },
  },
};

function VersionCard({ item, index }: { item: ChangelogVersion; index: number }) {
  const tag = tagConfig[item.tag] ?? tagConfig.feature;
  const TagIcon = tag.icon;
  const isUnreleased = item.tag === 'unreleased';
  // feature badge style needs special handling — bg-primary/10 can't be expressed as opacity on the element
  const featureBadgeStyle: React.CSSProperties = item.tag === 'feature'
    ? { backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)' }
    : tag.badgeStyle;

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
        className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-transform duration-200 hover:scale-110"
        style={isUnreleased
          ? { borderColor: 'var(--ube-300)', backgroundColor: 'color-mix(in srgb, var(--ube-800) 15%, transparent)' }
          : { borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)', backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }
        }
      >
        <TagIcon className="h-3.5 w-3.5" style={tag.iconStyle} />
      </div>

      <Card
        className="border-border/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
        style={isUnreleased ? { borderColor: 'color-mix(in srgb, var(--ube-300) 30%, transparent)' } : {}}
      >
        {/* Top accent bar */}
        <div
          className="h-0.5 w-full"
          style={isUnreleased
            ? { background: 'linear-gradient(to right, var(--ube-300), color-mix(in srgb, var(--ube-300) 50%, transparent))' }
            : { background: 'linear-gradient(to right, color-mix(in srgb, var(--primary) 60%, transparent), color-mix(in srgb, var(--primary) 20%, transparent))' }
          }
        />

        <CardContent className="p-5">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">
                {isUnreleased ? 'Unreleased' : `v${item.version}`}
              </h2>
              <Badge variant="outline" className="border text-xs font-semibold px-2 py-0.5" style={featureBadgeStyle}>
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
                        className="border text-xs font-semibold gap-1 px-2 py-0.5"
                        style={cfg.badgeStyle}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {grouped[type].map((entry, i) => (
                        <li key={i} className="flex items-start gap-2.5 group">
                          <span
                            className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125"
                            style={cfg.dotStyle}
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

