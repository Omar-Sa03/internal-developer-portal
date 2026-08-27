from fastapi import FastAPI

app = FastAPI(title="{{ values.service_name }}")


@app.get("/")
def root():
    return {
        "service": "{{ values.service_name }}",
        "environment": "{{ values.environment }}",
        "status": "healthy",
    }


@app.get("/health")
def health():
    return {"status": "ok"}