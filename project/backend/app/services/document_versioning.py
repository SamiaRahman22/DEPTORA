"""
Document Versioning Service.
Manages document versions, activation, and rollback.
"""

from typing import List, Optional
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
from app.models.document import Document


class DocumentVersionService:
    """Manages document versions."""

    def create_version(
        self,
        db: Session,
        doc_id: str,
        filename: str,
        file_type: str,
        category: str = "general",
        uploaded_by: str = "admin",
        notes: str = "",
        valid_until: Optional[datetime] = None,
    ) -> Document:
        """
        Create a new document version.

        Returns: the newly created Document row (already committed).
        Callers that need to set additional fields (file_path, file_size, etc.)
        should update this same object and commit again — do NOT create a
        second Document row for the same upload.
        """
        # Find existing versions
        existing = db.query(Document).filter(
            Document.doc_id == doc_id,
            Document.is_active == True
        ).first()

        # Generate version number
        if existing:
            # Parse version (e.g., "2024.1" -> increment to "2024.2")
            parts = existing.version.split(".")
            new_patch = str(int(parts[-1]) + 1)
            new_version = ".".join(parts[:-1]) + "." + new_patch
        else:
            # First version
            year = datetime.utcnow().year
            new_version = f"{year}.1"

        # Create new document
        doc = Document(
            doc_id=doc_id,
            version=new_version,
            is_active=True,
            filename=filename,
            file_type=file_type,
            category=category,
            uploaded_by=uploaded_by,
            notes=notes,
            valid_until=valid_until,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        logger.info(f"Created document version: {doc_id} v{new_version}")
        return doc

    def deactivate_version(self, db: Session, doc_id: str, version: str) -> bool:
        """Deactivate a specific version."""
        doc = db.query(Document).filter(
            Document.doc_id == doc_id,
            Document.version == version
        ).first()

        if doc:
            doc.is_active = False
            db.commit()
            logger.info(f"Deactivated: {doc_id} v{version}")
            return True
        return False

    def activate_version(self, db: Session, doc_id: str, version: str) -> bool:
        """Activate a specific version."""
        # Deactivate all other versions
        db.query(Document).filter(
            Document.doc_id == doc_id,
            Document.version != version
        ).update({"is_active": False})

        # Activate target version
        doc = db.query(Document).filter(
            Document.doc_id == doc_id,
            Document.version == version
        ).first()

        if doc:
            doc.is_active = True
            db.commit()
            logger.info(f"Activated: {doc_id} v{version}")
            return True
        return False

    def get_versions(self, db: Session, doc_id: str) -> List[Document]:
        """Get all versions of a document."""
        return db.query(Document).filter(
            Document.doc_id == doc_id
        ).order_by(Document.version.desc()).all()

    def get_active_documents(self, db: Session) -> List[Document]:
        """Get all active document versions."""
        return db.query(Document).filter(
            Document.is_active == True
        ).all()


document_versioning = DocumentVersionService()