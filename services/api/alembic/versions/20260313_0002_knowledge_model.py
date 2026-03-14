"""extend schema for reader-grade knowledge model

Revision ID: 20260313_0002
Revises: 20260313_0001
Create Date: 2026-03-13 16:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260313_0002"
down_revision = "20260313_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("source_identifier", sa.String(length=255), nullable=True))
    op.add_column("documents", sa.Column("slug", sa.String(length=255), nullable=True))
    op.add_column("documents", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("raw_content", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("normalized_content", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("plain_text", sa.Text(), nullable=True))
    op.add_column(
        "documents",
        sa.Column(
            "sections",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "links_out",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "documents",
        sa.Column(
            "media_references",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "documents",
        sa.Column("indexing_status", sa.String(length=32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "documents",
        sa.Column("embedding_status", sa.String(length=32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "documents",
        sa.Column("document_kind", sa.String(length=64), nullable=False, server_default="article"),
    )

    op.create_index("ix_documents_source_identifier", "documents", ["source_identifier"])
    op.create_index("ix_documents_slug", "documents", ["slug"])
    op.create_index("ix_documents_indexing_status", "documents", ["indexing_status"])
    op.create_index("ix_documents_embedding_status", "documents", ["embedding_status"])
    op.create_index("ix_documents_document_kind", "documents", ["document_kind"])

    op.execute("UPDATE documents SET source_identifier = canonical_id WHERE source_identifier IS NULL")
    op.execute("UPDATE documents SET slug = canonical_id WHERE slug IS NULL")
    op.execute("UPDATE documents SET indexing_status = status WHERE indexing_status = 'pending'")

    op.create_table(
        "document_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_slug", sa.String(length=255), nullable=False),
        sa.Column("link_text", sa.String(length=255), nullable=True),
        sa.Column("link_type", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_document_id", "target_slug", name="uq_document_links_source_target"),
    )
    op.create_index("ix_document_links_source_document_id", "document_links", ["source_document_id"])
    op.create_index("ix_document_links_target_document_id", "document_links", ["target_document_id"])
    op.create_index("ix_document_links_target_slug", "document_links", ["target_slug"])

    op.create_table(
        "collections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_collections_owner_user_id", "collections", ["owner_user_id"])
    op.create_index("ix_collections_title", "collections", ["title"])
    op.create_index("ix_collections_slug", "collections", ["slug"])

    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("linked_document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("content_html", sa.Text(), nullable=True),
        sa.Column("plain_text", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["linked_document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_notes_owner_user_id", "notes", ["owner_user_id"])
    op.create_index("ix_notes_linked_document_id", "notes", ["linked_document_id"])
    op.create_index("ix_notes_title", "notes", ["title"])
    op.create_index("ix_notes_slug", "notes", ["slug"])

    op.create_table(
        "collection_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("collection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_collection_items_collection_id", "collection_items", ["collection_id"])
    op.create_index("ix_collection_items_document_id", "collection_items", ["document_id"])
    op.create_index("ix_collection_items_note_id", "collection_items", ["note_id"])

    op.create_table(
        "highlights",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("annotation", sa.Text(), nullable=True),
        sa.Column("start_offset", sa.Integer(), nullable=True),
        sa.Column("end_offset", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_highlights_user_id", "highlights", ["user_id"])
    op.create_index("ix_highlights_document_id", "highlights", ["document_id"])
    op.create_index("ix_highlights_note_id", "highlights", ["note_id"])

    op.create_table(
        "attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("media_type", sa.String(length=128), nullable=True),
        sa.Column("storage_key", sa.String(length=1024), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attachments_document_id", "attachments", ["document_id"])
    op.create_index("ix_attachments_note_id", "attachments", ["note_id"])

    op.create_table(
        "search_index_state",
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("engine", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("indexed_count", sa.Integer(), nullable=False),
        sa.Column("last_cursor", sa.String(length=255), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_index("ix_search_index_state_engine", "search_index_state", ["engine"])
    op.create_index("ix_search_index_state_status", "search_index_state", ["status"])

    op.alter_column("documents", "sections", server_default=None)
    op.alter_column("documents", "tags", server_default=None)
    op.alter_column("documents", "links_out", server_default=None)
    op.alter_column("documents", "media_references", server_default=None)
    op.alter_column("documents", "indexing_status", server_default=None)
    op.alter_column("documents", "embedding_status", server_default=None)
    op.alter_column("documents", "document_kind", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_search_index_state_status", table_name="search_index_state")
    op.drop_index("ix_search_index_state_engine", table_name="search_index_state")
    op.drop_table("search_index_state")

    op.drop_index("ix_attachments_note_id", table_name="attachments")
    op.drop_index("ix_attachments_document_id", table_name="attachments")
    op.drop_table("attachments")

    op.drop_index("ix_highlights_note_id", table_name="highlights")
    op.drop_index("ix_highlights_document_id", table_name="highlights")
    op.drop_index("ix_highlights_user_id", table_name="highlights")
    op.drop_table("highlights")

    op.drop_index("ix_collection_items_note_id", table_name="collection_items")
    op.drop_index("ix_collection_items_document_id", table_name="collection_items")
    op.drop_index("ix_collection_items_collection_id", table_name="collection_items")
    op.drop_table("collection_items")

    op.drop_index("ix_notes_slug", table_name="notes")
    op.drop_index("ix_notes_title", table_name="notes")
    op.drop_index("ix_notes_linked_document_id", table_name="notes")
    op.drop_index("ix_notes_owner_user_id", table_name="notes")
    op.drop_table("notes")

    op.drop_index("ix_collections_slug", table_name="collections")
    op.drop_index("ix_collections_title", table_name="collections")
    op.drop_index("ix_collections_owner_user_id", table_name="collections")
    op.drop_table("collections")

    op.drop_index("ix_document_links_target_slug", table_name="document_links")
    op.drop_index("ix_document_links_target_document_id", table_name="document_links")
    op.drop_index("ix_document_links_source_document_id", table_name="document_links")
    op.drop_table("document_links")

    op.drop_index("ix_documents_document_kind", table_name="documents")
    op.drop_index("ix_documents_embedding_status", table_name="documents")
    op.drop_index("ix_documents_indexing_status", table_name="documents")
    op.drop_index("ix_documents_slug", table_name="documents")
    op.drop_index("ix_documents_source_identifier", table_name="documents")
    op.drop_column("documents", "document_kind")
    op.drop_column("documents", "embedding_status")
    op.drop_column("documents", "indexing_status")
    op.drop_column("documents", "media_references")
    op.drop_column("documents", "links_out")
    op.drop_column("documents", "tags")
    op.drop_column("documents", "sections")
    op.drop_column("documents", "plain_text")
    op.drop_column("documents", "normalized_content")
    op.drop_column("documents", "raw_content")
    op.drop_column("documents", "summary")
    op.drop_column("documents", "slug")
    op.drop_column("documents", "source_identifier")
