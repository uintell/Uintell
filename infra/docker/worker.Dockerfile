FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY . /workspace

RUN pip install --upgrade pip && \
    pip install -e /workspace/packages/ai && \
    pip install -e /workspace/services/api && \
    pip install -e /workspace/services/worker[dev]

WORKDIR /workspace/services/worker
CMD ["python", "-m", "worker_app.main"]
