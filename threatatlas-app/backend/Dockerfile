# 1. Use the full python image to dodge the blocked apt-get steps completely
FROM python:3.11

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 2. Install PDM using Trusted Host flags so pip can pass through the firewall
RUN pip install --no-cache-dir \
    --trusted-host pypi.org \
    --trusted-host pypi.python.org \
    --trusted-host files.pythonhosted.org \
    pdm

# Copy dependency files
COPY pyproject.toml pdm.lock* /app/

# 3. Turn off SSL verification for PDM's internal package downloader
RUN pdm config pypi.verify_ssl False

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

# Streamlined startup command
CMD ["pdm", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
