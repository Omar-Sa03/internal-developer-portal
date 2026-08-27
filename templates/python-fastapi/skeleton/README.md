# {{ values.service_name }}

FastAPI service generated from the Internal Developer Platform Golden Path.

## Service Information

- **Service:** {{ values.service_name }}
- **Team:** {{ values.team }}
- **Environment:** {{ values.environment }}

## Development

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the service:

```bash
uvicorn src.main:app --reload
```

---

## Docker

Build and run locally with Docker:

```bash
# Build
docker build -t {{ values.service_name }} .

# Run
docker run -p 8000:8000 {{ values.service_name }}
```
 