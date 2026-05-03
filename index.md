---

layout: col-sidebar
title: OWASP ThreatAtlas
tags: threat-modeling
level: 2
type: tool
pitch: Open-source web platform for collaborative threat modeling—diagrams, frameworks, mitigations, and optional AI assistance in one place.

---

**OWASP ThreatAtlas** is an open-source web application for team-based threat modeling. Organizations run structured sessions by inviting developers, DevOps, architects, and security engineers to map systems, record threats and mitigations, and review risk in one place—instead of scattering notes across documents and slides.

The project is **Apache 2.0** licensed. The [application source](https://github.com/OWASP/www-project-threatatlas/tree/main/threatatlas-app) ships as a modern stack (FastAPI, PostgreSQL, React) and is designed to be **self-hosted** so data stays under your control.

---

## 🌟 Mission

Bridge the gap between security frameworks and real architectures: make it easy to **draw** data flows, **attach** threats and mitigations from recognized knowledge bases, **collaborate** with clear ownership and history, and **review** how risk changes over time.

![ThreatAtlas](/assets/images/threatatlas.png)

---

## 🧭 What ThreatAtlas offers

- **Data Flow Diagrams (DFDs)** — Interactive diagrams for processes, data stores, external entities, flows, and trust boundaries (including **Draw.io / .drawio import** to jump-start models).
- **Threats, mitigations, and risk** — Link mitigations to threats; record likelihood and impact; see risk-oriented views in **analytics** (including a likelihood × impact matrix where configured).
- **Knowledge base** — Browse and apply content from multiple frameworks (e.g. STRIDE, PASTA, LINDDUN, OWASP references, MITRE-oriented material, CVSS-oriented guidance—see the app and docs for the current catalog).
- **Collaboration** — Products shared with teammates; **RBAC**, invitations, and visibility controls aligned with how teams actually work.
- **History** — **Diagram versioning** with comparison, including visibility into threat and mitigation changes—not only canvas edits.
- **Comments** — Discussion on threats and mitigations for async review.
- **Custom frameworks** — Define organization-specific methodology and reuse it across diagrams.
- **Optional AI assistant** — When enabled by an administrator, a conversational assistant in the diagram editor can help explore threats and proposals; provider and keys are configured in-app (see deployment and security notes in the docs).

---

## 🏗 Why OWASP ThreatAtlas?

- **Open source and self-hosted** — Inspect the code, adapt it, and run it in your environment.
- **Many frameworks, one workspace** — Combine diagramming, a structured threat/mitigation model, and a growing knowledge base instead of maintaining separate spreadsheets and diagrams.
- **Built as a product, not a static site** — Authentication, teams, persistence, and UI workflows for day-to-day threat modeling—not only reference pages.
- **Extensible methodology** — Custom frameworks sit alongside built-in catalogs so teams can encode their own standards.
- **Practical outputs** — Analytics, versioning, and structured data (e.g. diagram export) support reviews, onboarding, and continuous refinement of a threat model.

---

## 🌳 Repository layout

- **[ThreatAtlas application (`threatatlas-app/`)](https://github.com/OWASP/www-project-threatatlas/tree/main/threatatlas-app)** — Backend, frontend, Docker Compose, and tool documentation.

---

## 📖 Documentation

### 🛠 Installation & setup

Run ThreatAtlas locally or in your infrastructure:

👉 **[Installation guide](https://github.com/OWASP/www-project-threatatlas/tree/main/threatatlas-app/docs/installation.md)**

### 💻 Development & contributing

Build, test, and submit changes:

👉 **[Development guide](https://github.com/OWASP/www-project-threatatlas/tree/main/threatatlas-app/docs/development.md)**

### 👤 User guide

Learn the main UI flows (products, diagrams, threats, mitigations, settings):

👉 **[User guide](https://github.com/OWASP/www-project-threatatlas/tree/main/threatatlas-app/docs/user-guide.md)**

### 📋 Releases

What changed in each version:

👉 **[Changelog](CHANGELOG.md)**

---
