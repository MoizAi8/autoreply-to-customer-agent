"""Store draft processing activity and atomic daily AI budgets."""

from alembic import op
import sqlalchemy as sa

revision = "20261125_draft_jobs"
down_revision = "20261125_review_identity"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "draft_budgets",
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("scope", sa.String(72), nullable=False),
        sa.Column("used", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("day", "scope", name="pk_draft_budgets"),
    )
    op.create_table(
        "draft_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_id", sa.Uuid(), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid()),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("trigger", sa.String(24), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("error", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint("id", name="pk_draft_jobs"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name="fk_draft_jobs_business_id_businesses", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], name="fk_draft_jobs_review_id_reviews", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name="fk_draft_jobs_actor_id_users", ondelete="SET NULL"),
    )
    op.create_index("ix_draft_jobs_business_created", "draft_jobs", ["business_id", "created_at"])
    op.create_index("ix_draft_jobs_state", "draft_jobs", ["state"])


def downgrade():
    op.drop_index("ix_draft_jobs_state", table_name="draft_jobs")
    op.drop_index("ix_draft_jobs_business_created", table_name="draft_jobs")
    op.drop_table("draft_jobs")
    op.drop_table("draft_budgets")
