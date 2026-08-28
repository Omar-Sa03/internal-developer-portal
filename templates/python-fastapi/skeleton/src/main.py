from fastapi import FastAPI, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    generate_latest,
)

app = FastAPI(title="${{ values.service_name }}")

REQUEST_COUNT = Counter(
    "${{ values.service_name | replace('-', '_') }}_requests_total",
    "Total number of HTTP requests",
)


@app.middleware("http")
async def count_requests(request, call_next):
    response = await call_next(request)

    REQUEST_COUNT.inc()

    return response


@app.get("/")
def root():
    return {
        "service": "${{ values.service_name }}",
        "environment": "${{ values.environment }}",
        "status": "healthy",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return Response(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )