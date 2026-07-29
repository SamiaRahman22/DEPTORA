"""Document database model for uploaded files."""


from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text 
from sqlalchemy.orm import declarative_base
from datetime import datetime
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    
    # NEW: Versioning fields
    doc_id = Column(String(255), unique=False, nullable=False, index=True)  # e.g., "CSE-Handbook"
    version = Column(String(50), nullable=False)  # e.g., "2024.1"
    is_active = Column(Boolean, default=True)  # Can deactivate old versions
    
    # Existing fields
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)  # name as uploaded by the user
    file_size = Column(Integer, nullable=True)  # bytes
    file_type = Column(String(20))  # pdf, docx, txt
    uploaded_date = Column(DateTime, default=datetime.utcnow)
    indexed_at = Column(DateTime, nullable=True)  # set once RAG indexing completes
    file_path = Column(String(500))
    chunk_count = Column(Integer, default=0, nullable=True)
    status = Column(String(20), default="uploaded")  # uploaded, processing, indexed, failed
    page_count = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Metadata
    category = Column(String(100), nullable=True)  # academic-policies, procedures, etc.
    valid_until = Column(DateTime, nullable=True)  # When this version expires
    notes = Column(String(1000), nullable=True)  # Why this version was created
    
    # Tracking
    uploaded_by = Column(String(255))  # Admin email/name
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Document {self.doc_id} v{self.version} ({'active' if self.is_active else 'inactive'})>"
