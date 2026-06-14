# syntax=docker/dockerfile:1
FROM python:3.12-slim

# System deps: fastembed/onnxruntime needs libgomp; build tools for any wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DB_PATH=/data/nexus.db \
    FASTEMBED_CACHE_PATH=/data/.fastembed_cache

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# /data is the Fly volume mount (SQLite + embedding model cache live here)
RUN mkdir -p /data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
