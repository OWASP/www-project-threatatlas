# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes are kept in sync with the in-app changelog (`threatatlas-app/frontend/src/data/changelog.json`).

## [0.5.0] - 2026-04-28

### Added

- AI Threat Modeling Assistant: a conversational AI chat panel embedded in the diagram editor that performs deep, framework-exhaustive threat analysis across every element and data flow.
- AI-assisted diagram import: when importing a DrawIO file, the AI automatically classifies each element into the correct DFD type (process, datastore, external entity, data flow, trust boundary).
- DrawIO to DFD import: upload any .drawio or .xml file and convert it into a fully editable Data Flow Diagram with element type mapping.
- OWASP LLM Top 10 framework added to the knowledge base with threats and mitigations covering prompt injection, insecure output handling, training data poisoning, and more.
- AI configuration panel in Settings (admin only): configure provider (OpenAI, Anthropic, OpenAI-compatible), model, API key, temperature, and max tokens; API keys are stored encrypted.
- Streaming AI responses via Server-Sent Events for a real-time, token-by-token chat experience.
- AI proposal removal: the AI can propose removing outdated or duplicate threats and mitigations already on the diagram.

### Changed

- Diagram elements now show threat (T) and mitigation (M) count badges directly on the canvas for at-a-glance risk visibility.
- Version history now tracks threat and mitigation changes (added, removed, modified) in addition to diagram structure, with dedicated Threats and Mitigations diff tabs in the comparison view.
- Overall UI refresh: updated component styles, layout consistency, and visual hierarchy across the diagram editor, settings, and knowledge base pages.
- Conversation persistence: AI chat history is stored per diagram and restored across sessions.
- Redis-backed knowledge base cache: KB threats and mitigations are cached per framework to reduce database load during AI analysis.

## [0.4.0] - 2026-03-29

### Added

- Risk matrix (Likelihood × Impact heatmap) on the Analytics page and in the product-level Analytics tab.
- Expanded knowledge base to 7 frameworks (MITRE ATT&CK, CVSS Risk Framework, OWASP ASVS) with 200+ new threats and mitigations.
- Coverage chart in Knowledge Base showing threats vs mitigations per category.
- Toast notifications for all user actions across the application.
- Skeleton loading states and error boundaries on all pages.
- Product-level analytics tab with risk, threat, and mitigation charts.
- Shared ThreatCard component with compact mitigation chips and progress tracking.
- Smart mitigation search pre-filtered by threat framework and category.

### Changed

- Full UI redesign: Dashboard, ProductDetails, Login, and ThreatDetailsSheet with modern shadcn components.
- Theme management migrated to next-themes for proper dark mode and shadcn Sonner compatibility.
- Accessibility and responsive design audit: aria-labels, mobile breakpoints, and keyboard navigation.

### Fixed

- Dark mode toast styling and missing frameworks in new diagram dialog.
- Product sharing and visibility: public/private flag persisted correctly, access checks respect visibility, and the share dialog toggles visibility and collaborator management reliably.
- User invitations: accepting an invitation no longer fails with a server error when checking expiration (UTC-aware datetime handling).

## [0.3.0] - 2026-03-23

### Added

- Changelog page with interactive timeline view in the sidebar navigation.
- Analytics page with global threat statistics and charts.
- Comments on threats and mitigations.

## [0.2.0] - 2026-03-21

### Added

- User-specific ownership and access control: custom frameworks, threats, and mitigations are now scoped to their creator.
- Full screen mode to the diagram editor.
- Export diagram to JSON format.

### Changed

- All threats from different frameworks are now shown in ALL ANALYSES mode.
- History and version comparison feature improved in the diagram editor.
- Diagram node rendering refined: proper zIndex layering and improved element selection behavior.
- Access control layer enforced at both API and UI level for all user-owned resources.
- Diagram elements have four connection points instead of 2.

### Fixed

- Trust boundary layer overlapping while editing the boundaries.

## [0.1.0] - 2026-03-18

### Added

- Custom frameworks support: users can now create, edit, and manage their own threat/mitigation frameworks.
- Risk assessment fields on diagram threats: likelihood, impact, and computed risk score.
- Product collaborators: share products with other users and control their access level.
- Diagram versioning: snapshot and restore previous versions of a diagram's threat model.
- Threat-to-mitigation linking: mitigations can now be explicitly linked to specific threats in a diagram.
- RBAC (Role-Based Access Control) and invitation system for team collaboration.
- User authentication with JWT, password hashing, and admin/member roles.
- Threat modeling models (STRIDE, PASTA, LINDDUN, etc.) with framework associations.
- Initial project setup for ThreatAtlas OWASP project.
- Root project structure, GitHub issue and pull request templates.
- Backend FastAPI architecture with PostgreSQL integration and Alembic migrations.
- Frontend React + TypeScript application with ReactFlow for interactive diagram editing.
- Docker and Docker Compose support for easy local and production deployment.
- Core threat modeling features: Products, Data Flow Diagrams (DFDs).
- STRIDE and PASTA framework support out of the box.
- Knowledge Base page for browsing threats and mitigations by framework.
- Analytics dashboard with global threat statistics and charts.
- License updated to Apache 2.0.
