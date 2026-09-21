from dataclasses import dataclass

from app.database.errors import (
    TableAccessDeniedError,
    UnknownTableError,
)


@dataclass(frozen=True)
class TableDefinition:
    physical_name: str
    readable_columns: tuple[str, ...]
    allowed_roles: frozenset[str]
    default_order_column: str


TABLE_REGISTRY: dict[str, dict[str, TableDefinition]] = {
    "leafy_core": {
        "finance_categories": TableDefinition(
            physical_name="finance_categories",
            readable_columns=(
                "id", "category_code", "name",
                "transaction_type", "is_active",
                "created_at", "updated_at",
            ),
            allowed_roles=frozenset({"admin", "superadmin"}),
            default_order_column="id",
        ),
        "finance_transactions": TableDefinition(
            physical_name="finance_transactions",
            readable_columns=(
                "id", "transaction_code", "transaction_type",
                "category_id", "client_id", "counterparty",
                "description", "amount", "currency",
                "transaction_date", "payment_method",
                "reference_number", "status", "notes",
                "created_at", "updated_at", "void_reason",
                "voided_at",
            ),
            allowed_roles=frozenset({"admin", "superadmin"}),
            default_order_column="id",
        ),
        "clients": TableDefinition(
            physical_name="clients",
            readable_columns=(
                "id", "client_code", "name", "business_type",
                "phone", "email", "city", "source", "status",
                "notes", "created_at", "updated_at",
            ),
            allowed_roles=frozenset({"admin", "superadmin"}),
            default_order_column="id",
        ),
        "outreach_logs": TableDefinition(
            physical_name="outreach_logs",
            readable_columns=(
                "id", "client_id", "channel", "direction",
                "message_summary", "outcome", "contacted_at",
                "follow_up_at", "created_at",
            ),
            allowed_roles=frozenset({"admin", "superadmin"}),
            default_order_column="id",
        ),
        "knowledge_documents": TableDefinition(
            physical_name="knowledge_documents",
            readable_columns=(
                "id", "document_code", "short_code",
                "original_name", "safe_name", "mime_type",
                "document_type", "file_size", "status",
                "uploaded_by", "created_at", "updated_at",
            ),
            allowed_roles=frozenset({"admin", "superadmin"}),
            default_order_column="id",
        ),
        "knowledge_chunks": TableDefinition(
            physical_name="knowledge_chunks",
            readable_columns=(
                "id", "document_id", "chunk_index", "content",
                "token_count", "created_at",
            ),
            allowed_roles=frozenset({"admin", "superadmin"}),
            default_order_column="id",
        ),
        "pending_actions": TableDefinition(
            physical_name="pending_actions",
            readable_columns=(
                "id", "action_id", "requested_by", "action_type",
                "database_id", "resource_id", "status",
                "expires_at", "confirmed_at", "created_at",
            ),
            allowed_roles=frozenset({"superadmin"}),
            default_order_column="id",
        ),
    },
}


def list_allowed_tables(
    database_id: str,
    role: str,
) -> dict[str, TableDefinition]:
    database_tables = TABLE_REGISTRY.get(database_id)

    if database_tables is None:
        raise UnknownTableError

    return {
        table_id: definition
        for table_id, definition in database_tables.items()
        if role in definition.allowed_roles
    }


def get_table_definition(
    database_id: str,
    table_id: str,
    role: str,
) -> TableDefinition:
    database_tables = TABLE_REGISTRY.get(database_id)

    if database_tables is None:
        raise UnknownTableError

    table = database_tables.get(table_id)

    if table is None:
        raise UnknownTableError

    if role not in table.allowed_roles:
        raise TableAccessDeniedError

    return table
