# syntax=docker/dockerfile:1.7
# Relay API: FastAPI on Python 3.12, installed from the workspace lockfile with uv.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

RUN pip install --no-cache-dir uv==0.11.28 \
    && useradd --create-home --uid 10001 relay

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml apps/api/pyproject.toml
COPY packages/engine/pyproject.toml packages/engine/pyproject.toml
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-workspace --package relay-api

COPY packages/engine packages/engine
COPY apps/api apps/api
COPY seed/data seed/data
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package relay-api \
    && chown -R relay /app

ENV PATH="/app/.venv/bin:$PATH" \
    RELAY_SEED_DIR=/app/seed/data

USER relay
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=20 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"
CMD ["relay-api", "serve", "--port", "8000"]
