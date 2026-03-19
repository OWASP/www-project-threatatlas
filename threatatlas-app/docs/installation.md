# ThreatAtlas Installation Guide

This guide explains how to install, configure, and run **ThreatAtlas** for both local usage and production environments.

---

## 🚀 Quick Start (Docker)

The recommended way to run ThreatAtlas is using Docker Compose. This starts the web application, the API, and the database automatically.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

### 2. Run the Application
```bash
git clone https://github.com/OWASP/www-project-threatatlas.git
cd www-project-threatatlas/threatatlas-app

# (Optional) copy and edit the environment file before starting
cp .env.example .env

# Build and start services
docker compose up -d
```

### 3. Access
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000) (Docs at `/docs`)

### 4. First Login

A default admin account is created automatically on first run:

| Field | Value |
|---|---|
| Email | `admin@acme.com` |
| Password | `Admin@1234` |

> ⚠️ **Change these credentials immediately** after your first login, especially in shared or production environments.

---

## ⚙️ Configuration

ThreatAtlas uses a `.env` file for configuration. Copy the example and update it as needed:

```bash
cp .env.example .env
```

### Important Settings:
- **`SECRET_KEY`**: Change this to a long random string for security.
- **`POSTGRES_PASSWORD`**: Change the default before any shared or production deployment.
- **`SMTP Settings`**: Required for email invitation links to work.

---

## 🛡️ Production Deployment

For production environments, ensure the following:

1. **Security**: Update the `POSTGRES_PASSWORD` and use a strong `SECRET_KEY`.
2. **Debug Mode**: Set `DEBUG=False` in your `.env`.
3. **HTTPS**: Use a reverse proxy like Nginx or Traefik to handle SSL certificates.
4. **Resources**: Define CPU and Memory limits in your `docker-compose.yml`.

---

## 💾 Database Management

### Manual Migrations
If the database doesn't populate automatically, run:
```bash
docker compose exec backend pdm run migrate
```

### Backup & Restore
```bash
# Backup
docker-compose exec postgres pg_dump -U threatatlas threatatlas > backup.sql

# Restore
docker-compose exec -T postgres psql -U threatatlas -d threatatlas < backup.sql
```

---

## 🛑 Stopping the Application

```bash
# Stop without removing data
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove ALL data (Cannot be undone)
docker compose down -v
```
