"""FinnPlay FastAPI service — load .env before any code reads os.environ."""
from pathlib import Path

from dotenv import load_dotenv

_py_root = Path(__file__).resolve().parent.parent
load_dotenv(_py_root / ".env")
# Same DB URL as Node/Prisma if you only maintain server/.env
load_dotenv(_py_root.parent / "server" / ".env", override=False)

from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest

from app.analytics import router as analytics_router
from app.dashboard import router as dashboard_router
from app.recommendations import router as recommendations_router

app = FastAPI(title="FinnPlay Recommender Service", version="1.0.0")
request_counter = Counter("finnplay_python_requests_total", "Total requests", ["path", "method"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "python-recommender"}


@app.middleware("http")
async def metrics_middleware(request, call_next):
    request_counter.labels(path=request.url.path, method=request.method).inc()
    return await call_next(request)


@app.get("/metrics")
def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(recommendations_router)
app.include_router(analytics_router)
app.include_router(dashboard_router)
