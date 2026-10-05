import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("price > 0", name="price_positive"),
        CheckConstraint("delivery_days > 0", name="delivery_days_positive"),
        CheckConstraint(
            "status IN ('Active', 'Negotiating', 'Selected', 'Not selected')",
            name="status_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    delivery_days: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="Active", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
