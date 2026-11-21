# Build context: repository root.   docker build -f deploy/ai-engine.Dockerfile .
# Python 3.13 matches the version the model was trained with (models/training_config.json).
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY src/ai_engine/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Layout must keep models/ at <root> and the app at <root>/src/ai_engine (see app/config.py)
COPY models/ /app/models/
COPY src/ai_engine/app /app/src/ai_engine/app
COPY src/ai_engine/knowledge_base /app/src/ai_engine/knowledge_base

RUN useradd --system --uid 10001 appuser
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"
# Single worker keeps one model copy in memory; scale with replicas instead.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src/ai_engine"]
