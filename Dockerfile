# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + serve built frontend as static files ─────────────
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Drop the built React app into /app/static
COPY --from=frontend-builder /frontend/build ./static

RUN mkdir -p /data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
