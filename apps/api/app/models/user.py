import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
