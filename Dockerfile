# Stage 1: build the React frontend (vite only; tsc gates in dev/CI)
FROM node:20-slim AS frontend-build
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npx vite build

# Stage 2: the Python backend, serving the built SPA same-origin
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY principles/ ./principles/
COPY scripts/ ./scripts/
COPY --from=frontend-build /fe/dist ./frontend/dist
EXPOSE 8080
CMD ["uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8080"]
