import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Requirement(Base):
    __tablename__ = "requirements"
    __table_args__ = (
        CheckConstraint("budget_min > 0", name="budget_min_positive"),
        CheckConstraint("budget_max >= budget_min", name="budget_range"),
        CheckConstraint("urgency IN ('Low', 'Medium', 'High')", name="urgency_valid"),
        CheckConstraint(
            "status IN ('Open', 'Receiving Offers', 'Shortlisting', "
            "'Under Negotiation', 'Selected', 'Closed')",
            name="status_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    budget_min: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    budget_max: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    deadline: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    urgency: Mapped[str] = mapped_column(Text, nullable=False, server_default="Medium")
    tags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="Open", index=True)
    # Circular reference with offers.requirement_id, so the FK is added after both tables exist.
    selected_offer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("offers.id", ondelete="SET NULL", use_alter=True),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
