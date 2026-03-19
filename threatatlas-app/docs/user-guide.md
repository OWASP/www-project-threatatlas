# ThreatAtlas User Guide

Welcome to **ThreatAtlas** — a platform for community-driven threat modeling.

> 🛠 **Setting up ThreatAtlas?**  
> If you haven't installed the application yet, please follow the **[Installation Guide](installation.md)** first.

---

## 📖 Table of Contents

1. [First Login](#first-login)
2. [Using ThreatAtlas](#using-threatatlas)
   - [Products](#products)
   - [Data Flow Diagrams](#data-flow-diagrams)
   - [Threats and Mitigations](#threats-and-mitigations)
   - [Knowledge Base](#knowledge-base)
   - [Dashboard](#dashboard)
3. [Troubleshooting](#troubleshooting)

---

## First Login

### 1. Open ThreatAtlas
Navigate to your hosted URL (default: **http://localhost:3000** for local installs).

### 2. Log In

Public self-registration is disabled. On a fresh install, log in with the default admin account that is created automatically:

| Field | Value |
|---|---|
| Email | `admin@acme.com` |
| Password | `Admin@1234` |

> ⚠️ **Change these credentials immediately** after your first login. You can do this under your profile settings once logged in.

To add other users, go to **Admin → Invite User** and send an invitation link.

---

## Using ThreatAtlas

### Products

A **Product** is the top-level entity you threat-model. It could be a web application, microservice, API, or any software system.

#### Creating a Product

1. In the sidebar, click **Products**
2. Click **New Product**
3. Enter a name and description for your product
4. Click **Create**

#### Product Overview

The product detail page shows:
- All **diagrams** associated with the product
- A summary of **threats** and **mitigations** across all diagrams
- Threat severity breakdown

---

### Data Flow Diagrams

Each product can have one or more **Data Flow Diagrams (DFDs)**. Diagrams let you visually map out your system's components and the data flows between them, then attach threats to specific elements.

#### Creating a Diagram

1. Open a product
2. Click **New Diagram**
3. Give the diagram a name and click **Create**

#### The Diagram Canvas

The diagram editor provides an interactive canvas.

**Adding elements:**

- **Nodes**: Click the toolbar buttons to add process nodes, data stores, external entities, or trust boundary boxes
- **Edges**: Hover over a node's edge handle (the small dot on its border) and drag to another node to create a data flow arrow

**Selecting and renaming elements:**

- Click any node or edge to select it — a side panel opens on the right
- In the side panel, edit the element's **name** directly

**Moving and resizing:**

- Drag nodes to reposition them
- Boundary boxes (trust zones) can be resized by dragging their corners

---

### Threats and Mitigations

Threats and mitigations are attached to individual diagram elements (nodes or edges).

#### Adding a Threat to an Element

1. Click a node or edge on the diagram canvas — the side panel opens
2. In the **Threats** section, click **Add Threat**
3. Search or browse threats from the knowledge base
4. Select a threat and click **Add**

#### Viewing and Editing a Threat

Click any threat card in the side panel to open the **Threat Details Sheet**.

The sheet shows:
- Threat name, description, and category
- **Severity** (Low / Medium / High / Critical) based on the risk score
- **Status** (Identified / Mitigated / Accepted)
- **Linked Mitigations**

You can update the threat's status and notes directly in the sheet.

#### Managing Mitigations for a Threat

Inside the Threat Details Sheet:

- **Add a mitigation**: Click **Add Mitigation**, then search the knowledge base by framework, category, or keyword. Click a mitigation to attach it.
- **Edit a mitigation's status**: Use the status dropdown on each mitigation card (e.g., Proposed → Implemented → Verified)
- **Edit notes**: Click the notes area on a mitigation card and type your notes, then click **Save**
- **Remove a mitigation**: Click the trash icon on a mitigation card and confirm deletion

---

### Knowledge Base

The **Knowledge Base** is a library of pre-defined threats and mitigations organized by threat modeling framework (STRIDE, PASTA, OWASP Top 10, LINDDUN). The library is populated automatically on first startup.

#### Browsing the Knowledge Base

1. Click **Knowledge Base** in the sidebar
2. Select a **Framework** from the dropdown (e.g., STRIDE)
3. Use the **Threats** or **Mitigations** tabs to browse entries

#### Filtering and Searching

Each tab has a filter bar:

- **Search box**: Type to filter by name, description, or category
- **Category dropdown**: Narrow results to a specific category (e.g., "Spoofing", "Denial of Service")
- **Active filter chips**: Appear below the filter bar showing your active filters — click the × on any chip to clear it

#### Adding Custom Entries

You can add your own threats and mitigations to any framework:

1. Select the framework
2. Click **Add Custom Threat** (or **Add Custom Mitigation**)
3. Fill in the name, description, and category
4. Click **Save**

Custom entries appear alongside the pre-defined ones.

#### Editing and Deleting Entries

Click the **Edit** (pencil) or **Delete** (trash) icon on any row to modify or remove it.

---

### Dashboard

The **Dashboard** provides a unified view of all threats and mitigations across every product and diagram.

#### Filtering Threats

Use the filter bar to narrow the list:

- **Severity**: Filter by Low, Medium, High, or Critical
- **Status**: Filter by Identified, Mitigated, or Accepted
- **Search**: Type to search by threat name or description
- **Product / Diagram**: Narrow to a specific product or diagram

#### Threat Cards

Each threat card shows:
- A **colored left stripe** indicating severity (red = critical, orange = high, yellow = medium, green = low)
- The threat name, category, and description excerpt
- **Severity** and **Status** badges
- The product and diagram it belongs to
- Linked mitigations (click any mitigation to open the parent threat's details)

Click a threat card to open the **Threat Details Sheet** and manage it.

#### Summary Statistics

The top of the dashboard shows counts for:
- Total threats
- Threats by severity (Critical, High, Medium, Low)
- Mitigated threats

---

## Stopping the Application

To stop all services without removing data:

```bash
docker compose stop
```

To stop and remove the containers (data volume is preserved):

```bash
docker compose down
```

To stop and **remove all data** (including the database — cannot be undone):

```bash
docker compose down -v
```

---

## Troubleshooting

### A container is not starting

Check the logs for the failing service:

```bash
docker compose logs backend
docker compose logs postgres
docker compose logs frontend
```

### Cannot connect to http://localhost:3000

- Make sure Docker is running: `docker info`
- Check that the frontend container is up: `docker compose ps`
- Verify port 3000 is not in use by another application:
  ```bash
  lsof -i :3000   # macOS/Linux
  netstat -ano | findstr :3000   # Windows
  ```
- If port 3000 conflicts, change `FRONTEND_PORT` in your `.env` file and restart:
  ```bash
  docker compose down
  docker compose up -d
  ```

### Backend API errors or empty data

- Check backend logs: `docker compose logs backend`
- Ensure the database is healthy: `docker compose ps postgres`
- If migrations failed on first start, run them manually:
  ```bash
  docker compose exec backend pdm run migrate
  ```

### Knowledge base is empty

The knowledge base is seeded automatically on startup. If it appears empty:

1. Check the backend logs for seeding errors: `docker compose logs backend`
2. If the backend started before migrations completed, restart it:
   ```bash
   docker compose restart backend
   ```

### Resetting to a Clean State

If you need to start completely fresh:

```bash
docker compose down -v        # Remove containers and volumes
docker compose up -d          # Rebuild and start fresh
```

> **Warning**: This deletes all your data permanently.

### Viewing API Documentation

The backend provides interactive API docs at **http://localhost:8000/docs** (Swagger UI). This is useful for verifying the API is working correctly.

---

## Summary

| Task | Command |
|---|---|
| Start ThreatAtlas | `docker compose up -d` |
| Stop ThreatAtlas | `docker compose stop` |
| View logs | `docker compose logs -f` |
| Check status | `docker compose ps` |
| Remove everything | `docker compose down -v` |

Open **http://localhost:3000** to access ThreatAtlas after starting.
