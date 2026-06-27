# ThreatAtlas — Change Notes (May 2026)

## Bug Fixes

### Draw.io / XML Import
- Replaced `linkedom` DOMParser with native browser `DOMParser` — root cause of "XML parse error" on valid files
- Fixed `mxfile > diagram` CSS child combinator (not supported in linkedom) — replaced with `getElementsByTagName`
- Fixed `textContent` returning empty for uncompressed draw.io XML — now uses `XMLSerializer` to serialize child DOM nodes
- Fixed broken boundary sort comparator `(-1|1) - (-1|1)` (always 0) → `(0|1) - (0|1)`
- Fixed `maybeDecompress` inconsistency — stripped variable `t` now used consistently for the `<` check
- Fixed `file.text()` always decoding as UTF-8 — now sniffs the XML encoding declaration and re-reads with the declared charset

### Threat Management
- Fixed `elementType` in `ElementPropertiesSheet` being passed as `'node'`/`'edge'` (ReactFlow selection type) instead of the actual DFD type (`'process'`, `'external'`, etc.) — this was silently blocking threat creation from the element panel

---

## New Features

### Threat Dragon JSON Import (`ImportDrawioButton.tsx`)
- Supports Threat Dragon v1 (`diagramJson.cells`) and v2 (`cells` directly on diagram) formats
- Maps TD shapes to DFD types: `tm.Process` → process, `tm.Store` → datastore, `tm.Actor` → external, `trust-boundary-box` → boundary, `flow` → edge
- Extracts threats from `cell.data.threats[]` on every cell including data flows
- After import: auto-creates a model named after the diagram, creates each threat as a custom knowledge base entry (description + mitigation combined), and attaches it to the correct element
- Coordinate normalization: shifts diagrams with negative Y coordinates so all nodes are visible in the ReactFlow viewport
- Parallel edge fan-out: multiple flows between the same two nodes get different bezier curvature offsets so they render as separate visible lines

### ThreatAtlas Export JSON Import (`ImportDrawioButton.tsx`)
- Detects `{ product, exported_at, diagrams }` format (ThreatAtlas own export)
- Imports nodes/edges directly without draw.io re-centering math — positions are used as-is

### Edge Reconnection (`Diagrams.tsx`)
- All edges are now `reconnectable: true` — users can drag flow endpoints to different nodes or different handles on the same node

### Fit View on Load (`Diagrams.tsx`)
- `fitView` is called automatically when a diagram loads, ensuring all nodes are visible regardless of their coordinate range

---

## UI Text Updates

Updated in `Diagrams.tsx`, `Products.tsx`, `ProductDetails.tsx`, `CreateProductWizard.tsx`:
- Wizard description: "Start with a blank canvas or import an existing Draw.io/JSON file."
- Import option title: "Import Draw.io or JSON"
- Import option subtitle: ".drawio, .xml or .json file"

---

## Files Changed

| File | Type |
|------|------|
| `frontend/src/components/ImportDrawioButton.tsx` | Bug fix + New feature |
| `frontend/src/components/ElementPropertiesSheet.tsx` | Bug fix |
| `frontend/src/components/DiagramNode.tsx` | Minor (debug log added/removed) |
| `frontend/src/pages/Diagrams.tsx` | New feature + UI text |
| `frontend/src/pages/Products.tsx` | UI text |
| `frontend/src/pages/ProductDetails.tsx` | UI text |
| `frontend/src/components/CreateProductWizard.tsx` | UI text |

---

## Additional Changes (Post-Initial Session)

### PDF & HTML Report with Embedded Diagrams (`ProductDetails.tsx`, `diagramSvg.ts`)
- Replaced the old backend-generated "Full report (HTML)" with two new frontend-generated options:
  - **Full report (HTML)** — downloads an HTML file with all diagrams rendered as inline SVG
  - **Full report (PDF)** — opens a browser print dialog pre-loaded with the full report for Save as PDF
- New `diagramSvg.ts` utility renders ReactFlow node/edge data as SVG:
  - Resolves absolute positions by walking the `parentId` chain (fixes child nodes appearing outside boundaries)
  - Expands boundary boxes to contain all their child nodes
  - Wraps long labels into multiple lines to prevent text overflow
  - Renders process (circle), datastore (parallel lines), external entity (rectangle), and trust boundary (dashed box) shapes
  - Draws edges with dashed lines, arrowheads, and truncated labels

### Editable Edge Paths (`EditableEdge.tsx`, `Diagrams.tsx`)
- New `EditableEdge` custom edge component with a draggable midpoint handle
- Drag the midpoint dot to reshape any data flow path
- Drag the edge label independently to reposition it
- Double-click the midpoint to reset the path back to straight
- Waypoint and label offset positions are saved with the diagram

### Multiple Data Flows per Node (`Diagrams.tsx`)
- Replaced `addEdge` (which deduplicated by handle) with a direct push using a unique ID
- Users can now draw multiple data flows from/to the same node handle

### Edge Reconnection (`Diagrams.tsx`)
- All edges set `reconnectable: true` — drag either endpoint to move a flow to a different node

### Fit View on Diagram Load (`Diagrams.tsx`)
- `fitView` triggered automatically when `selectedDiagram` changes, ensuring all nodes are visible

### Wizard & UI Text Updates
- All four wizard locations updated: `Diagrams.tsx`, `Products.tsx`, `ProductDetails.tsx`, `CreateProductWizard.tsx`
- Import option renamed to "Import Draw.io or JSON" with subtitle ".drawio, .xml or .json file"

---

## Further Fixes

### Threat Dragon Import — Separate Threats & Mitigations (`ImportDrawioButton.tsx`)
- Previously: threat description and mitigation text were combined into one field with `**Mitigation:**` prefix
- Now: threat description goes into the threat's description field only; mitigation text creates a separate `DiagramMitigation` record named "Mitigate: {threat title}", linked to the threat via `threat_id` with status `proposed`
- Added `mitigationsApi` and `diagramMitigationsApi` imports

### Threat Dragon Import — Missing Data Flows (`ImportDrawioButton.tsx`)
- Fixed: nodes with `position: undefined` (valid in some TD exports) were being skipped, causing their connected flows to be dropped
- Removed the `if (!position && !isBoundary) continue` guard — nodes without explicit position now default to `{x:0, y:0}` instead of being excluded

### JSON Import — Diagram-level Export Format (`ImportDrawioButton.tsx`)
- Fixed: importing a JSON downloaded from the diagram canvas (Download button) threw "Unrecognised JSON format"
- Added Format 0 handler for `{ name, nodes, edges, productId, exportedAt, version }` — the diagram-level export structure
- This format is now recognised before the ThreatAtlas product export and Threat Dragon formats

### Diagram JSON Export — Include Threats & Mitigations (`Diagrams.tsx`, `ImportDrawioButton.tsx`)
- Diagram-level JSON export (canvas Download button) now fetches and includes all threats and mitigations in the file (`version: '1.1'`)
- On re-import, threats and mitigations are restored to the new diagram using their existing `threat_id`/`mitigation_id` references
- Import success toast shows element, threat, and mitigation counts

### SVG Diagram Renderer Improvements (`diagramSvg.ts`)
- Edge labels now sit at the geometric midpoint of each edge, 8px above the line — matching canvas behaviour
- If a label was manually dragged on the canvas (`labelOffsetX`/`labelOffsetY` saved in edge data), that position is preserved in the report
- Added SVG `clipPath` per node so text never overflows shape boundaries
- Edge arrows now connect to the actual shape boundary (circle edge for processes, rectangle edge for others) instead of node centers
- Boundary boxes auto-expand to contain all child nodes with padding
- Absolute positions resolved by walking `parentId` chain so child nodes render at correct canvas coordinates
- SVG bounding box accounts for edge label positions to prevent flows clipping outside the canvas area

### Diagram JPG Export (`Diagrams.tsx`, `ProductDetails.tsx`)
- Added "Download (JPG)" button to the diagram canvas toolbar (image icon, next to JSON download)
- Added "Diagrams (JPG)" option to the product-level Download dropdown — exports one JPG per diagram
- Uses SVG → canvas → JPEG pipeline at 2× resolution for crisp output
- Uses `data:` URL encoding instead of blob URLs to avoid canvas CORS taint issues

### Framework Selection Scroll Fix (`ProductDetails.tsx`)
- Fixed: the framework list in the New Diagram wizard (step 2) had no height limit, making it impossible to scroll when many frameworks were present
- Added `max-h-64 overflow-y-auto` to the framework list container

### Create Product Wizard Scroll Fix (`CreateProductWizard.tsx`)
- Fixed: "Show additional details" section had no height limit, pushing content off-screen with no way to scroll
- Added `max-h-[60vh] overflow-y-auto` to the step content container so it scrolls within the dialog

### Reviewer & Contributors Fields (`backend`, `CreateProductWizard.tsx`, `api.ts`)
- Added `reviewer` (String 500) and `contributors` (Text, comma-separated) columns to the `products` table via Alembic migration `h3i4j5k6l7m8`
- Updated `ProductBase` schema and `Product` SQLAlchemy model to include the new fields
- Added `reviewer` and `contributors` to the `ProductInput` TypeScript interface in `api.ts`
- Added both fields to the "Show additional details" section of `CreateProductWizard.tsx`:
  - Reviewer: single name/role field with description "Person who reviewed and approved this threat model"
  - Contributors: comma-separated names field with description "Team members who contributed to this threat model"
- Both fields are included in the product create API call
