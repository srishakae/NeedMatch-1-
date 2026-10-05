"""initial schema

Revision ID: db8f5382a644
Revises:
Create Date: 2026-10-06 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "db8f5382a644"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- profiles -----------------------------------------------------------
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_profiles")),
        sa.UniqueConstraint("email", name=op.f("uq_profiles_email")),
    )

    # --- requirements (selected_offer_id FK is added at the end: circular with offers) ---
    op.create_table(
        "requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("budget_min", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("budget_max", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=False),
        sa.Column("urgency", sa.Text(), server_default="Medium", nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("status", sa.Text(), server_default="Open", nullable=False),
        sa.Column("selected_offer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("budget_min > 0", name=op.f("ck_requirements_budget_min_positive")),
        sa.CheckConstraint("budget_max >= budget_min", name=op.f("ck_requirements_budget_range")),
        sa.CheckConstraint("urgency IN ('Low', 'Medium', 'High')", name=op.f("ck_requirements_urgency_valid")),
        sa.CheckConstraint(
            "status IN ('Open', 'Receiving Offers', 'Shortlisting', 'Under Negotiation', 'Selected', 'Closed')",
            name=op.f("ck_requirements_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["requester_id"], ["profiles.id"],
            name=op.f("fk_requirements_requester_id_profiles"), ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_requirements")),
    )
    op.create_index(op.f("ix_requirements_requester_id"), "requirements", ["requester_id"])
    op.create_index(op.f("ix_requirements_category"), "requirements", ["category"])
    op.create_index(op.f("ix_requirements_deadline"), "requirements", ["deadline"])
    op.create_index(op.f("ix_requirements_status"), "requirements", ["status"])
    op.create_index(op.f("ix_requirements_selected_offer_id"), "requirements", ["selected_offer_id"])
    op.create_index(op.f("ix_requirements_created_at"), "requirements", ["created_at"])

    # --- offers -------------------------------------------------------------
    op.create_table(
        "offers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("requirement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("delivery_days", sa.Integer(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="Active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("price > 0", name=op.f("ck_offers_price_positive")),
        sa.CheckConstraint("delivery_days > 0", name=op.f("ck_offers_delivery_days_positive")),
        sa.CheckConstraint(
            "status IN ('Active', 'Negotiating', 'Selected', 'Not selected')",
            name=op.f("ck_offers_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["requirement_id"], ["requirements.id"],
            name=op.f("fk_offers_requirement_id_requirements"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["profiles.id"],
            name=op.f("fk_offers_provider_id_profiles"), ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_offers")),
    )
    op.create_index(op.f("ix_offers_requirement_id"), "offers", ["requirement_id"])
    op.create_index(op.f("ix_offers_provider_id"), "offers", ["provider_id"])
    op.create_index(op.f("ix_offers_status"), "offers", ["status"])

    # Now that offers exists, close the circular reference.
    op.create_foreign_key(
        op.f("fk_requirements_selected_offer_id_offers"),
        "requirements", "offers", ["selected_offer_id"], ["id"], ondelete="SET NULL",
    )

    # --- shortlists ---------------------------------------------------------
    op.create_table(
        "shortlists",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("requirement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("offer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["requirement_id"], ["requirements.id"],
            name=op.f("fk_shortlists_requirement_id_requirements"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["offer_id"], ["offers.id"],
            name=op.f("fk_shortlists_offer_id_offers"), ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shortlists")),
        sa.UniqueConstraint("requirement_id", "offer_id", name="uq_shortlists_requirement_id_offer_id"),
    )
    op.create_index(op.f("ix_shortlists_requirement_id"), "shortlists", ["requirement_id"])
    op.create_index(op.f("ix_shortlists_offer_id"), "shortlists", ["offer_id"])

    # --- negotiation_messages -----------------------------------------------
    op.create_table(
        "negotiation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("requirement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("offer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("proposal", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("accepted", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["requirement_id"], ["requirements.id"],
            name=op.f("fk_negotiation_messages_requirement_id_requirements"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["offer_id"], ["offers.id"],
            name=op.f("fk_negotiation_messages_offer_id_offers"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"], ["profiles.id"],
            name=op.f("fk_negotiation_messages_sender_id_profiles"), ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_negotiation_messages")),
    )
    op.create_index(op.f("ix_negotiation_messages_requirement_id"), "negotiation_messages", ["requirement_id"])
    op.create_index(op.f("ix_negotiation_messages_sender_id"), "negotiation_messages", ["sender_id"])
    op.create_index(
        "ix_negotiation_messages_offer_id_created_at", "negotiation_messages", ["offer_id", "created_at"]
    )

    # --- provider_listings --------------------------------------------------
    op.create_table(
        "provider_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("starting_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("delivery_days", sa.Integer(), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("availability", sa.Text(), server_default="Available", nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("document_url", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), server_default="Published", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("starting_price > 0", name=op.f("ck_provider_listings_starting_price_positive")),
        sa.CheckConstraint("delivery_days > 0", name=op.f("ck_provider_listings_delivery_days_positive")),
        sa.CheckConstraint(
            "availability IN ('Available', 'Limited availability', 'Unavailable')",
            name=op.f("ck_provider_listings_availability_valid"),
        ),
        sa.CheckConstraint("status IN ('Published', 'Paused')", name=op.f("ck_provider_listings_status_valid")),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["profiles.id"],
            name=op.f("fk_provider_listings_provider_id_profiles"), ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_listings")),
    )
    op.create_index(op.f("ix_provider_listings_provider_id"), "provider_listings", ["provider_id"])
    op.create_index(op.f("ix_provider_listings_category"), "provider_listings", ["category"])
    op.create_index(op.f("ix_provider_listings_status"), "provider_listings", ["status"])


def downgrade() -> None:
    op.drop_table("provider_listings")
    op.drop_table("negotiation_messages")
    op.drop_table("shortlists")
    op.drop_constraint(op.f("fk_requirements_selected_offer_id_offers"), "requirements", type_="foreignkey")
    op.drop_table("offers")
    op.drop_table("requirements")
    op.drop_table("profiles")
