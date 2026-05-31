# ThreatAtlas Tool

This directory contains the source code for the ThreatAtlas web application—a collaborative platform for community-driven threat modeling.

## 🚀 Getting Started

If you want to run the application immediately using Docker:

```bash
docker compose up -d
```
Access the UI at [http://localhost:3000](http://localhost:3000).

---

## 📖 Documentation

For detailed guides, please refer to:

- **[Installation Guide](docs/installation.md)**: How to deploy ThreatAtlas (Docker, Environment Variables, Production).
- **[Development Guide](docs/development.md)**: How to set up a local development environment and contribute code.
- **[User Guide](docs/user-guide.md)**: How to use the Web UI to manage products, diagrams, and threats.
- **[CI/CD Integration](docs/ci-integration.md)**: Gate your pipelines on a product's threat-model posture (GitHub Actions / GitLab CI).

---

## 🏗 Project Structure

- **`backend/`**: FastAPI application, PostgreSQL models, and database migrations.
- **`frontend/`**: React application built with TypeScript, Tailwind CSS, and ReactFlow.
- **`docs/`**: Detailed documentation for users and developers.
