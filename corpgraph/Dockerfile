FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN addgroup --system corpgraph && adduser --system --ingroup corpgraph corpgraph
COPY pyproject.toml README.md ./
COPY corpgraph ./corpgraph
RUN pip install --no-cache-dir .

USER corpgraph
EXPOSE 8000
CMD ["uvicorn", "corpgraph.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
