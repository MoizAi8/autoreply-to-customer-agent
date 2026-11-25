"""Create the original application schema."""

from alembic import op
import sqlalchemy as sa

revision = "20261125_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if not op.get_context().as_sql and sa.inspect(bind).has_table("reviews"):
        existing = set(sa.inspect(bind).get_table_names())
        expected = {'businesses', 'users', 'reviews', 'replies', 'brand_voices', 'platform_connections',
                    'knowledge_base_entries', 'audit_logs', 'usage_metrics', 'api_keys'}
        if not expected <= existing:
            raise RuntimeError("Existing database has an incomplete schema. Restore or repair it before migration.")
        return
    op.create_table('businesses',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=False),
    sa.Column('industry', sa.String(length=255), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('plan', sa.String(length=50), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('settings', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_businesses'))
    )
    op.create_index(op.f('ix_businesses_slug'), 'businesses', ['slug'], unique=True)
    op.create_table('api_keys',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('key_hash', sa.String(length=255), nullable=False),
    sa.Column('key_prefix', sa.String(length=10), nullable=False),
    sa.Column('scopes', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_api_keys_business_id_businesses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_api_keys'))
    )
    op.create_index(op.f('ix_api_keys_business_id'), 'api_keys', ['business_id'], unique=False)
    op.create_table('brand_voices',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('tone', sa.String(length=50), nullable=False),
    sa.Column('style', sa.String(length=50), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('personality', sa.Text(), nullable=True),
    sa.Column('values', sa.JSON(), nullable=True),
    sa.Column('keywords', sa.JSON(), nullable=True),
    sa.Column('forbidden_terms', sa.JSON(), nullable=True),
    sa.Column('custom_rules', sa.JSON(), nullable=True),
    sa.Column('greeting_template', sa.Text(), nullable=True),
    sa.Column('closing_template', sa.Text(), nullable=True),
    sa.Column('sample_replies', sa.JSON(), nullable=True),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_brand_voices_business_id_businesses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_brand_voices'))
    )
    op.create_index(op.f('ix_brand_voices_business_id'), 'brand_voices', ['business_id'], unique=False)
    op.create_table('knowledge_base_entries',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('category', sa.String(length=100), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('embedding', sa.JSON(), nullable=True),
    sa.Column('metadata', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_knowledge_base_entries_business_id_businesses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_knowledge_base_entries'))
    )
    op.create_index(op.f('ix_knowledge_base_entries_business_id'), 'knowledge_base_entries', ['business_id'], unique=False)
    op.create_index(op.f('ix_knowledge_base_entries_category'), 'knowledge_base_entries', ['category'], unique=False)
    op.create_table('platform_connections',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('platform', sa.String(length=50), nullable=False),
    sa.Column('platform_account_name', sa.String(length=255), nullable=False),
    sa.Column('platform_account_id', sa.String(length=255), nullable=True),
    sa.Column('encrypted_access_token', sa.Text(), nullable=True),
    sa.Column('encrypted_refresh_token', sa.Text(), nullable=True),
    sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('scopes', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('platform_metadata', sa.JSON(), nullable=True),
    sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_platform_connections_business_id_businesses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_platform_connections'))
    )
    op.create_index(op.f('ix_platform_connections_business_id'), 'platform_connections', ['business_id'], unique=False)
    op.create_table('reviews',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('platform_review_id', sa.String(length=255), nullable=False),
    sa.Column('platform', sa.String(length=50), nullable=False),
    sa.Column('customer_name', sa.String(length=255), nullable=False),
    sa.Column('customer_email', sa.String(length=255), nullable=True),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=True),
    sa.Column('sentiment', sa.String(length=50), nullable=True),
    sa.Column('sentiment_score', sa.Float(), nullable=True),
    sa.Column('risk_level', sa.String(length=20), nullable=True),
    sa.Column('is_flagged', sa.Boolean(), nullable=False),
    sa.Column('flag_reason', sa.Text(), nullable=True),
    sa.Column('is_processed', sa.Boolean(), nullable=False),
    sa.Column('platform_metadata', sa.JSON(), nullable=True),
    sa.Column('review_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_reviews_business_id_businesses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_reviews'))
    )
    op.create_index(op.f('ix_reviews_business_id'), 'reviews', ['business_id'], unique=False)
    op.create_index(op.f('ix_reviews_platform'), 'reviews', ['platform'], unique=False)
    op.create_index(op.f('ix_reviews_platform_review_id'), 'reviews', ['platform_review_id'], unique=False)
    op.create_table('usage_metrics',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('metric_type', sa.String(length=50), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=True),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('total_tokens', sa.Integer(), nullable=True),
    sa.Column('cost', sa.Float(), nullable=True),
    sa.Column('duration_ms', sa.Integer(), nullable=True),
    sa.Column('metadata', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_usage_metrics_business_id_businesses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_usage_metrics'))
    )
    op.create_index(op.f('ix_usage_metrics_business_id'), 'usage_metrics', ['business_id'], unique=False)
    op.create_index(op.f('ix_usage_metrics_metric_type'), 'usage_metrics', ['metric_type'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_verified', sa.Boolean(), nullable=False),
    sa.Column('is_superuser', sa.Boolean(), nullable=False),
    sa.Column('mfa_enabled', sa.Boolean(), nullable=False),
    sa.Column('mfa_secret', sa.String(length=255), nullable=True),
    sa.Column('business_id', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_users_business_id_businesses'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('audit_logs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('action', sa.String(length=100), nullable=False),
    sa.Column('resource_type', sa.String(length=50), nullable=False),
    sa.Column('resource_id', sa.String(length=255), nullable=True),
    sa.Column('details', sa.JSON(), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_audit_logs_business_id_businesses'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_logs_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs'))
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_business_id'), 'audit_logs', ['business_id'], unique=False)
    op.create_table('replies',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('business_id', sa.Uuid(), nullable=False),
    sa.Column('review_id', sa.Uuid(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('quality_score', sa.Float(), nullable=True),
    sa.Column('safety_score', sa.Float(), nullable=True),
    sa.Column('ai_metadata', sa.JSON(), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('platform_reply_id', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('fk_replies_business_id_businesses'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['review_id'], ['reviews.id'], name=op.f('fk_replies_review_id_reviews'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_replies')),
    sa.UniqueConstraint('review_id', name=op.f('uq_replies_review_id'))
    )
    op.create_index(op.f('ix_replies_business_id'), 'replies', ['business_id'], unique=False)


def downgrade():
    raise RuntimeError("Restore from a database backup to remove the application schema.")
