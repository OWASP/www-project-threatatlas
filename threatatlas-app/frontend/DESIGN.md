# ThreatAtlas Design System

The UI is built on [shadcn/ui](https://ui.shadcn.com) (`radix-nova` style, `stone` base color, Tailwind v4).
All colors, radii and shadows are CSS variables defined in `src/index.css`; light and dark values live in
`:root` and `.dark`. Components consume them through Tailwind tokens (`bg-card`, `text-muted-foreground`, …).

## Principles

- **Use tokens, not raw colors.** No Tailwind palette classes (`text-green-600`, `bg-red-100`) and no
  `dark:` color overrides. A single token class works in both themes.
- **Don't edit `src/components/ui/`.** These are stock shadcn components. Add new ones with
  `pnpm dlx shadcn@latest add <name>` and decline overwriting existing files.
- **Compose, don't restyle.** Prefer shadcn primitives (`Card`, `Tabs`, `Sheet`, `Dialog`, `Calendar` +
  `Popover` for date pickers, `Sidebar` with `SidebarInset`) over custom markup.

## Color tokens

| Role | Token | Notes |
|---|---|---|
| Page / surfaces | `background`, `card`, `popover`, `muted`, `secondary`, `accent` | Neutral |
| Text | `foreground`, `muted-foreground` | |
| Brand / primary action | `primary`, `primary-foreground` | |
| Borders / inputs / focus | `border`, `input`, `ring` | |
| Destructive | `destructive` | Errors, rejection, critical |
| Status | `success`, `warning`, `caution`, `info`, `violet` | Each has light + dark values. No `*-foreground` token: use `text-white` on solid fills |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border`, … | |
| Charts | `chart-1` … `chart-5` | |

### Risk and severity

| Level | Token |
|---|---|
| Low | `--risk-low` (= success) |
| Medium | `--risk-medium` (= warning) |
| High | `--risk-high` (= caution) |
| Critical | `--risk-critical` (= destructive) |

Each has a `-muted` tint (`--risk-high-muted`, …). Helpers in `src/lib/risk.ts`: `getSeverity(score)`
(≥20 critical, ≥12 high, ≥6 medium, else low), `getSeverityColor`, `getSeverityVariant`,
`getSeverityClasses` (`.severity-*` badge classes) and `getStatusClasses` (`.status-*` badge classes).
Inherent and residual risk are both shown with these (see `RiskSummary`).

### DFD element colors

`--element-process`, `--element-datastore`, `--element-external`, `--element-boundary`,
`--element-threat`, `--element-mitigation`, `--element-removal`. Use `getElementColor(type)` from
`src/lib/designSystem.ts` for node types, or the variables directly.

## Typography

System sans stack (`--font-sans`); `Space Mono` for code (`--font-mono`). Headings are weight 600.
Page titles `text-2xl font-bold tracking-tight`; small uppercase labels
`text-[10px] font-bold uppercase tracking-wider text-muted-foreground`.

## Shape and elevation

- Radius: `--radius` = 0.625rem; cards use `rounded-xl`, inputs and buttons the shadcn default.
- Cards: `rounded-xl border-border/60 shadow-sm`. Empty states use a thin dashed border.
- Shadows follow Tailwind's scale, remapped in `index.css` (`shadow-sm`, `shadow-md`, …). Keep hover
  elevation subtle (`hover:shadow-md`).

## Layout

- App shell: `SidebarProvider` + `Sidebar` + `SidebarInset`, header with `SidebarTrigger` and breadcrumbs.
- **Every page root is full width:** `flex-1 w-full p-4 md:p-6 lg:p-8`. No `mx-auto` and no `max-w-*` on
  page roots. Components that render both standalone and inside another page (e.g. `UserManagement` in
  Settings) take no padding themselves; the parent supplies it.
- KPI cards: small uppercase label, token-colored icon, large number, muted sub-line (see Dashboard and
  Approvals).
- Capping width is fine for readable text blocks, dialogs and tooltips only.

## Accessibility

Keep visible focus rings, `aria-label`s on icon-only buttons, `role="alert"` on inline errors, and
keyboard-operable interactive rows. Respect `prefers-reduced-motion`.

## Legacy

`index.css` still defines a Clay-era swatch palette (`--matcha-*`, `--lemon-*`, `--pomegranate-*`, …),
`.bg-matcha`-style utilities and `.shadow-clay`. Only the severity and status badge classes still use
the swatches. Don't use them in new code.
