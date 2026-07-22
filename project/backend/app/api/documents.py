"""Document upload and management endpoints."""

import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_admin
from app.core.config import settings
from app.models.document import Document
from app.models.user import User
from app.rag.pipeline import rag_pipeline
from app.services.document_versioning import document_versioning

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def doc_to_dict(d: Document) -> dict:
    return {
        "id": d.id,
        "filename": d.filename,
        "original_filename": d.original_filename,
        "file_type": d.file_type,
        "file_size": d.file_size,
        "status": d.status,
        "chunk_count": d.chunk_count,
        "page_count": d.page_count,
        "error_message": d.error_message,
        "uploaded_date": d.uploaded_date.isoformat() if d.uploaded_date else None,
        "indexed_at": d.indexed_at.isoformat() if d.indexed_at else None,
        # NEW  - Versioning fields
        "doc_id": getattr(d, 'doc_id', None),
        "version": getattr(d, 'version', None),
        "is_active": getattr(d, 'is_active', True),
        "category": getattr(d, 'category', None),
        "notes": getattr(d, 'notes', None),
    }


@router.get("/", response_model=List[dict])
async def list_documents(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # Show only active documents by default
    docs = db.query(Document).filter(
        Document.is_active == True
    ).order_by(Document.uploaded_date.desc()).all()
    return [doc_to_dict(d) for d in docs]


@router.post("/upload", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Upload a document and trigger async indexing."""
    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, DOCX, TXT"
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    # Save file
    ext = ALLOWED_TYPES[content_type]
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(settings.DOCUMENTS_PATH, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    # NEW: Create versioned document
    # Extract document name from filename (without extension)
    doc_name = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename
    doc_id = doc_name.upper().replace(" ", "-")  # e.g., "CSE-Handbook"
    
    # Create new version using versioning service
    version = document_versioning.create_version(
        db=db,
        doc_id=doc_id,
        filename=unique_name,
        file_type=ext,
        category="general",  # Default category
        uploaded_by=admin.email,  # Assumes admin has email field
        notes=f"Uploaded: {file.filename}",
    )
    
    # Create DB record with versioning
    doc = Document(
        filename=unique_name,
        original_filename=file.filename,
        file_type=ext,
        file_size=len(content),
        file_path=file_path,
        status="uploaded",
        uploaded_by=admin.id,
        doc_id=doc_id,  # NEW
        version=version,  # NEW
        is_active=True,  # NEW
        category="general",  # NEW
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Trigger async indexing
    background_tasks.add_task(_index_document, doc.id, file_path, ext)

    return doc_to_dict(doc)


@router.post("/{doc_id}/reindex")
async def reindex_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Trigger re-indexing of an existing document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    doc.status = "processing"
    doc.error_message = None
    db.commit()

    background_tasks.add_task(_index_document, doc.id, doc.file_path, doc.file_type)
    return {"message": "Re-indexing started", "document_id": doc_id}


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()


@router.get("/stats")
async def index_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    docs = db.query(Document).all()
    indexed = [d for d in docs if d.status == "indexed"]
    return {
        "total_documents": len(docs),
        "indexed": len(indexed),
        "processing": len([d for d in docs if d.status == "processing"]),
        "failed": len([d for d in docs if d.status == "failed"]),
        "total_chunks": sum(d.chunk_count or 0 for d in indexed),
        "rag_ready": rag_pipeline.is_ready,
    }


# ── NEW: VERSIONING ENDPOINTS ──
@router.get("/{doc_id}/versions", response_model=List[dict])
async def get_document_versions(
    doc_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Get all versions of a document."""
    versions = document_versioning.get_versions(db, doc_id)
    return [doc_to_dict(v) for v in versions]


@router.post("/{doc_id}/{version}/activate", status_code=200)
async def activate_version(
    doc_id: str,
    version: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Activate a specific version of a document."""
    success = document_versioning.activate_version(db, doc_id, version)
    if not success:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")
    
    logger.info(f"Activated {doc_id} v{version}")
    return {"message": f"Activated {doc_id} v{version}"}


@router.get("/active", response_model=List[dict])
async def get_active_documents(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Get all active document versions."""
    docs = document_versioning.get_active_documents(db)
    return [doc_to_dict(d) for d in docs]



# ── BACKGROUND INDEXING ──
async def _index_document(doc_id: int, file_path: str, file_type: str):
    """Background task: extract, chunk, embed, index into FAISS."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        doc.status = "processing"
        db.commit()

        result = await rag_pipeline.index_document(file_path, file_type)

        doc.status = "indexed"
        doc.chunk_count = result.chunk_count
        doc.page_count = result.page_count
        doc.indexed_at = datetime.utcnow()
        db.commit()
        logger.info(f"✅ Indexed document {doc_id}: {result.chunk_count} chunks")

    except Exception as e:
        logger.error(f"❌ Failed to index document {doc_id}: {e}")
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()
