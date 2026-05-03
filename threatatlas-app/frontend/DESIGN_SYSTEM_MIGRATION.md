# Design System Migration Guide

This document tracks the migration of all frontend components to the Clay-inspired design system defined in DESIGN.md.

## Status: ✅ COMPLETE

All components have been migrated to the Clay design system (April 2026).

---

## What Changed

### Foundation (`index.css`)

- **Font:** Replaced `Roboto Variable` → `Plus Jakarta Sans Variable` (geometric sans-serif closest to Roobert) + `Space Mono` for monospace
- **Font features:** `font-feature-settings: "ss01", "ss03", "ss10", "ss11", "ss12"` applied globally on headings; body uses `"ss03", "ss10", "ss11", "ss12"`
- **Headings:** Now use `font-weight: 600` and `letter-spacing: -0.02em` (Clay display compression pattern)
- **Colors:** Full Clay swatch palette defined as CSS variables (`--matcha-*`, `--slushie-*`, `--lemon-*`, `--ube-*`, `--pomegranate-*`, `--blueberry-*`, `--dragonfruit-*`)
- **Shadows:** All `--shadow-*` variables now point to the Clay multi-layer signature shadow: `rgba(0,0,0,0.1) 0px 1px 1px, rgba(0,0,0,0.04) 0px -1px 1px inset, rgba(0,0,0,0.05) 0px -0.5px 1px` — Tailwind `shadow-sm`, `shadow-md` etc. automatically use Clay shadows
- **Background:** Warm Cream `#faf9f7` (never cool white/gray)
- **Border:** Oat Border `#dad4c8` as the default `--border` token
- **Severity badges:** `.severity-critical/high/medium/low` — use Clay swatches (Pomegranate, Lemon, Matcha)
- **Status badges:** `.status-identified/mitigated/accepted/proposed/implemented/verified` — use Clay swatches

### Semantic Color Mapping

| Semantic Role | Clay Swatch | CSS Variable |
|---|---|---|
| Success / Mitigated / Low risk | Matcha 600 | `var(--risk-low)` |
| Warning / Medium risk | Lemon 700 | `var(--risk-medium)` |
| High risk | Pomegranate 600 | `var(--risk-high)` |
| Critical risk | Pomegranate 800 | `var(--risk-critical)` |
| DFD Process | Matcha 600 | `var(--element-process)` |
| DFD DataStore | Lemon 700 | `var(--element-datastore)` |
| DFD External | Ube 800 | `var(--element-external)` |
| DFD Boundary | Warm Silver | `var(--element-boundary)` |
| Threat | Pomegranate 600 | `var(--element-threat)` |

---

## Components Updated

All components and pages have been migrated away from hardcoded Tailwind color classes:

### Pages
- **Dashboard.tsx** — Risk stat cards, severity filter buttons, empty state icons
- **Analytics.tsx** — KPI icons, chart header icons
- **Changelog.tsx** — Entry/tag badge styles, timeline dots
- **KnowledgeBase.tsx** — Empty state, modified badge, coverage strip
- **ProductDetails.tsx** — Stat cards, chart header icons
- **Products.tsx** — Colors migrated
- **Diagrams.tsx** — Node add buttons (DataStore/External/Boundary hover states)
- **Login.tsx** — Warm gradient background using Clay cream + Lemon + Matcha tints
- **UserManagement.tsx** — Active user check icon

### Components
- **DiagramNode.tsx** — All node styles use `--element-*` CSS vars; xyflow Handle elements use `!bg-[var(--element-*)]`
- **DiagramVersionComparison.tsx** — Diff card borders/backgrounds use Clay vars
- **DiagramVersionHistory.tsx** — Trend colors migrated
- **ThreatCard.tsx** — Shield/mitigation icon colors
- **ThreatDetailsSheet.tsx** — KB mitigation shield icons
- **ThreatManagement.tsx** — Already clean
- **MitigationManagement.tsx** — Already clean
- **AIChatSheet.tsx** — Proposal group badges, removal section, header badge
- **AIProposalCard.tsx** — Mitigation border color
- **ImportDrawioButton.tsx** — NODE_TYPES use `--element-*` vars
- **ModelSelector.tsx** — Already clean
- **Sidebar.tsx** — Already clean
- **CommentSection.tsx** — Already clean

---

## CSS Variable Reference

### Clay Swatch Variables
```
--clay-cream: #faf9f7          /* page background */
--clay-black: #000000          /* primary text */
--clay-white: #ffffff          /* card bg */
--oat-border: #dad4c8          /* primary border */
--oat-light:  #eee9df          /* secondary border */

--matcha-300: #84e7a5          /* light green */
--matcha-600: #078a52          /* mid green (primary) */
--matcha-800: #02492a          /* deep green */
--slushie-500: #3bd3fd         /* bright cyan */
--slushie-800: #0089ad         /* deep teal */
--lemon-400: #f8cc65           /* pale gold */
--lemon-500: #fbbd41           /* primary gold */
--lemon-700: #d08a11           /* deep amber */
--lemon-800: #9d6a09           /* dark amber */
--ube-300: #c1b0ff             /* soft lavender */
--ube-800: #43089f             /* deep purple */
--ube-900: #32037d             /* darkest purple */
--pomegranate-400: #fc7981     /* warm coral-pink */
--pomegranate-600: #e84c56     /* medium red */
--pomegranate-800: #c02228     /* deep red */
--blueberry-800: #01418d       /* deep navy */
--dragonfruit-500: #e91e8c     /* magenta */
```

### Semantic Risk Variables
```
--risk-low:            #078a52 (Matcha 600)
--risk-low-muted:      color-mix(in srgb, #078a52 15%, transparent)
--risk-medium:         #d08a11 (Lemon 700)
--risk-medium-muted:   color-mix(in srgb, #fbbd41 25%, transparent)
--risk-high:           #e84c56 (Pomegranate 600)
--risk-high-muted:     color-mix(in srgb, #fc7981 20%, transparent)
--risk-critical:       #c02228 (Pomegranate 800)
--risk-critical-muted: color-mix(in srgb, #e84c56 20%, transparent)
```

### Shadow System
All Tailwind shadow utilities (`shadow-sm`, `shadow-md`, `shadow-lg`) are automatically remapped to:
```
Clay shadow: rgba(0,0,0,0.1) 0px 1px 1px, rgba(0,0,0,0.04) 0px -1px 1px inset, rgba(0,0,0,0.05) 0px -0.5px 1px
```
Use `shadow-clay` for explicit Clay shadow, `shadow-clay-hover` for the hard offset hover state.

---

## Design System Do's and Don'ts

### Do
- Use `var(--risk-*)` or `.severity-*` / `.status-*` classes for semantic color
- Use `var(--element-*)` for DFD diagram node colors
- Use `style={{ color/backgroundColor: 'var(--swatch-name)' }}` for one-off color
- Let Tailwind `shadow-*` classes work normally — they now resolve to Clay shadows

### Don't
- Use hardcoded Tailwind palette classes: `text-green-*`, `bg-red-*`, `text-amber-*`, etc.
- Use cool gray backgrounds — only warm cream (`var(--background)` = `#faf9f7`)
- Use neutral gray borders — only oat (`var(--border)` = `#dad4c8`)
- Add `dark:` color variant classes — CSS variables handle dark mode automatically

---

## Future Maintenance

To change all colors in the design system:
1. Update CSS variables in `index.css` under the `:root` block
2. Dark mode overrides are in the `.dark` block
3. All components automatically pick up the changes via CSS variables
