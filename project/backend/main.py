"""
DeptAI - AI-Powered Administrative Assistant
Main FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from app.core.config import settings
from app.core.database import SessionLocal, create_tables
from app.api import auth, chat, faqs, procedures, documents, admin
from app.rag.pipeline import rag_pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    
    # Initialize database
    create_tables()
    logger.info("✅ Database tables created/verified")
    
    # Initialize RAG pipeline
    try:
        db = SessionLocal()
        try:
            await rag_pipeline.initialize(db)
            logger.info("✅ RAG pipeline initialized")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"⚠️  RAG pipeline init warning: {e} — will retry on first use")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down DeptAI...")
    rag_pipeline.save_index()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Administrative Assistant with RAG pipeline and Ollama LLM",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ── CORS ──
logger.info(f"CORS allowed origins: {settings.cors_origins_list}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTERS ──
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(faqs.router, prefix="/api/faqs", tags=["FAQs"])
app.include_router(procedures.router, prefix="/api/procedures", tags=["Procedures"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "rag_ready": rag_pipeline.is_ready,
        "ollama_url": settings.OLLAMA_BASE_URL,
    }


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME} API", "docs": "/api/docs"}