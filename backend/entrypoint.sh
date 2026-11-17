#!/usr/bin/env sh
set -eu

echo "Running Alembic migrations..."
alembic upgrade head

echo "Seeding KHTN 8 KNTT curriculum and demo accounts (idempotent)..."
python -m app.seed

echo "Starting FastAPI Uvicorn server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
