FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE ${PORT:-8000}

# シェル形式で $PORT を展開（Railway は $PORT を動的に注入する）
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
