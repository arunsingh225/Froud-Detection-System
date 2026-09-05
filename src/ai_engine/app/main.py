from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.logging_config import logger
from app.services.model_service import model_service
from app.api.routes import router
from app.api.investigator_routes import router as investigator_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown event lifecycle manager."""
    logger.info("Initializing FraudGuard AI Inference Engine...")
    try:
        model_service.load()
        logger.info("FraudGuard AI Engine is ready for inference requests.")
    except Exception as e:
        logger.critical(f"FATAL: Model initialization failed: {e}", exc_info=True)
        # Service starts in degraded state rather than hard crashing to allow health check diagnostics
    yield
    logger.info("Shutting down FraudGuard AI Inference Engine...")


app = FastAPI(
    title="FraudGuard AI — Fraud Detection Engine",
    description="High-performance machine learning inference microservice powering FraudGuard AI financial fraud detection.",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

import secrets

# CORS Middleware restricted to local backend microservice callers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Internal-Secret"],
)

# Public unauthenticated endpoints
PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}

@app.middleware("http")
async def verify_internal_secret_middleware(request: Request, call_next):
    # Exempt public health check and API documentation endpoints
    if request.url.path in PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    expected_secret = settings.FASTAPI_INTERNAL_SECRET
    provided_secret = request.headers.get("X-Internal-Secret")

    if not expected_secret:
        logger.error("FASTAPI_INTERNAL_SECRET environment variable is not configured!")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Microservice internal secret is not configured on server."}
        )

    if not provided_secret or not secrets.compare_digest(provided_secret, expected_secret):
        logger.warning(
            f"Unauthorized microservice request to {request.url.path} from "
            f"{request.client.host if request.client else 'unknown'}"
        )
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Unauthorized: Invalid or missing X-Internal-Secret header."}
        )

    return await call_next(request)

# Global Request Validation Error Handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Invalid request payload received: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": exc.errors()
        }
    )

# Generic Exception Handler
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing the request."
        }
    )

# Include API Routers
app.include_router(router)
app.include_router(investigator_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
