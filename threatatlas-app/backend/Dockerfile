FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PDM
RUN pip install --no-cache-dir pdm

# Copy dependency files
COPY pyproject.toml pdm.lock* /app/

# Install dependencies
RUN pdm install --prod --no-lock --no-editable

# Copy application code
COPY . /app

# Expose port
EXPOSE 8000

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Run migrations, seed knowledge base, then start server
CMD pdm run alembic upgrade head && pdm run python scripts/seed_knowledge_base.py && pdm run uvicorn app.main:app --host 0.0.0.0 --port 8000
