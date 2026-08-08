"""
FAQCandidate — tracks a possible recurring question before it's promoted
to a real FAQ. Kept separate from the FAQ table so half-formed/rare
questions never clutter what students see; only ones asked (and paraphrased)
enough times, with confident-enough answers, graduate into real FAQs.
"""

from sqlalchemy import Column, Integer, String, Text, Float, DateTime
from datetime import datetime
from app.core.database import Base


class FAQCandidate(Base):
    __tablename__ = "faq_candidates"

    id = Column(Integer, primary_key=True, index=True)

    # The first-seen phrasing — becomes the FAQ's question text if promoted.
    representative_question = Column(Text, nullable=False)

    # JSON-encoded embedding vector (list of floats) for semantic matching
    # against future (possibly reworded) askings of the same question.
    embedding = Column(Text, nullable=False)

    # How many times this question (or a paraphrase of it) has been asked.
    count = Column(Integer, default=1)

    # The best (highest-confidence) answer seen so far — used as the FAQ's
    # answer if/when this candidate gets promoted.
    best_answer = Column(Text, nullable=True)
    best_confidence = Column(Float, default=0.0)

    category = Column(String(50), default="General")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
