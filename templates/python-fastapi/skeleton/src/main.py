from time import perf_counter

from fastapi import FastAPI, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)

app = FastAPI(title="${{ values.service_name }}")


REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["service", "method", "path", "status"],
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["service", "method", "path"],
)


@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = perf_counter()

    try:
        response = await call_next(request)

    except Exception:
        REQUEST_COUNT.labels(
            "${{ values.service_name }}",
            request.method,
            request.url.path,
            "500",
        ).inc()

        raise

    duration = perf_counter() - start

    REQUEST_COUNT.labels(
        "${{ values.service_name }}",
        request.method,
        request.url.path,
        str(response.status_code),
    ).inc()

    REQUEST_LATENCY.labels(
        "${{ values.service_name }}",
        request.method,
        request.url.path,
    ).observe(duration)

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