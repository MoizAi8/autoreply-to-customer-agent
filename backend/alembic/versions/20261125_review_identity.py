"""Enforce tenant-scoped external review identity."""

from alembic import op
import sqlalchemy as sa

revision = "20261125_review_identity"
down_revision = "696585a2d35b"
branch_labels = None
depends_on = None

INDEX = "uq_reviews_business_platform_external_id"


def upgrade():
    if not op.get_context().as_sql:
        bind = op.get_bind()
        if any(index["name"] == INDEX for index in sa.inspect(bind).get_indexes("reviews")):
            return
        duplicate = bind.execute(sa.text(
            "SELECT 1 FROM reviews WHERE platform_review_id <> '' "
            "GROUP BY business_id, platform, platform_review_id HAVING COUNT(*) > 1 LIMIT 1"
        )).first()
        if duplicate:
            raise RuntimeError("Resolve duplicate external review IDs in a backed-up database before this migration.")
    op.create_index(
        INDEX, "reviews", ["business_id", "platform", "platform_review_id"], unique=True,
        postgresql_where=sa.text("platform_review_id <> ''"),
        sqlite_where=sa.text("platform_review_id <> ''"),
    )


def downgrade():
    op.drop_index(INDEX, table_name="reviews")
