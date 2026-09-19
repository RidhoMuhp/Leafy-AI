from typing import Any
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text

from app.database.connection import database_transaction
from app.database.registry import get_database_config
from app.database.tables import get_table_definition


class DocumentNotFoundError(Exception):
    pass


class DocumentParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    database_id: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[a-z][a-z0-9_]*$",
    )


class ListDocumentsParameters(DocumentParameters):
    search: str | None = Field(
        default=None,
        max_length=200,
    )
    status: str | None = Field(
        default=None,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
    )
    offset: int = Field(
        default=0,
        ge=0,
        le=100_000,
    )

    @field_validator("search")
    @classmethod
    def normalize_search(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            return None

        return normalized


class GetDocumentParameters(DocumentParameters):
    document_code: str = Field(
        min_length=5,
        max_length=64,
        pattern=r"^DOC-[A-Z0-9]+$",
    )


class SearchKnowledgeParameters(DocumentParameters):
    search_text: str = Field(
        min_length=2,
        max_length=200,
    )
    document_code: str | None = Field(
        default=None,
        max_length=64,
        pattern=r"^DOC-[A-Z0-9]+$",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=20,
    )
    offset: int = Field(
        default=0,
        ge=0,
        le=10_000,
    )

    @field_validator("search_text")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        normalized = " ".join(value.split())

        if len(normalized) < 2:
            raise ValueError(
                "Query minimal 2 karakter"
            )

        return normalized


def ensure_document_access(
    database_id: str,
    role: str,
) -> tuple[str, str]:
    if role not in {"admin", "superadmin"}:
        raise PermissionError

    get_database_config(database_id, role)

    documents_table = get_table_definition(
        database_id,
        "knowledge_documents",
        role,
    )
    chunks_table = get_table_definition(
        database_id,
        "knowledge_chunks",
        role,
    )

    return (
        documents_table.physical_name,
        chunks_table.physical_name,
    )


def list_documents(
    role: str,
    database_id: str,
    search: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    documents_table, chunks_table = (
        ensure_document_access(
            database_id,
            role,
        )
    )

    conditions = []
    parameters: dict[str, Any] = {
        "limit": limit,
        "offset": offset,
    }

    if search is not None:
        conditions.append(
            """
            (
                INSTR(
                    LOWER(d.`document_code`),
                    LOWER(:search)
                ) > 0
                OR INSTR(
                    LOWER(d.`original_name`),
                    LOWER(:search)
                ) > 0
            )
            """
        )
        parameters["search"] = search

    if status is not None:
        conditions.append(
            "d.`status` = :status"
        )
        parameters["status"] = status

    where_clause = (
        "WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    count_statement = text(
        f"""
        SELECT COUNT(*) AS `total`
        FROM `{documents_table}` AS d
        {where_clause}
        """
    )

    list_statement = text(
        f"""
        SELECT
            d.`id`,
            d.`document_code`,
            d.`original_name`,
            d.`safe_name`,
            d.`mime_type`,
            d.`file_size`,
            d.`status`,
            d.`created_at`,
            d.`updated_at`,
            COUNT(c.`id`) AS `chunk_count`,
            COALESCE(
                SUM(CHAR_LENGTH(c.`content`)),
                0
            ) AS `character_count`
        FROM `{documents_table}` AS d
        LEFT JOIN `{chunks_table}` AS c
            ON c.`document_id` = d.`id`
        {where_clause}
        GROUP BY
            d.`id`,
            d.`document_code`,
            d.`original_name`,
            d.`safe_name`,
            d.`mime_type`,
            d.`file_size`,
            d.`status`,
            d.`created_at`,
            d.`updated_at`
        ORDER BY d.`id` DESC
        LIMIT :limit
        OFFSET :offset
        """
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        total = connection.execute(
            count_statement,
            parameters,
        ).scalar_one()

        rows = connection.execute(
            list_statement,
            parameters,
        ).mappings().all()

    return {
        "database_id": database_id,
        "documents": [
            dict(row)
            for row in rows
        ],
        "pagination": {
            "total": int(total),
            "limit": limit,
            "offset": offset,
            "returned": len(rows),
        },
    }


def get_document(
    role: str,
    database_id: str,
    document_code: str,
) -> dict[str, Any]:
    documents_table, chunks_table = (
        ensure_document_access(
            database_id,
            role,
        )
    )

    document_statement = text(
        f"""
        SELECT
            d.`id`,
            d.`document_code`,
            d.`original_name`,
            d.`safe_name`,
            d.`mime_type`,
            d.`file_size`,
            d.`status`,
            d.`created_at`,
            d.`updated_at`,
            COUNT(c.`id`) AS `chunk_count`,
            COALESCE(
                SUM(c.`token_count`),
                0
            ) AS `estimated_token_count`,
            COALESCE(
                SUM(CHAR_LENGTH(c.`content`)),
                0
            ) AS `character_count`
        FROM `{documents_table}` AS d
        LEFT JOIN `{chunks_table}` AS c
            ON c.`document_id` = d.`id`
        WHERE d.`document_code` = :document_code
        GROUP BY
            d.`id`,
            d.`document_code`,
            d.`original_name`,
            d.`safe_name`,
            d.`mime_type`,
            d.`file_size`,
            d.`status`,
            d.`created_at`,
            d.`updated_at`
        LIMIT 1
        """
    )

    preview_statement = text(
        f"""
        SELECT
            `chunk_index`,
            LEFT(`content`, 500) AS `content`
        FROM `{chunks_table}`
        WHERE `document_id` = :document_id
        ORDER BY `chunk_index` ASC
        LIMIT 1
        """
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        document = connection.execute(
            document_statement,
            {
                "document_code": document_code,
            },
        ).mappings().first()

        if document is None:
            raise DocumentNotFoundError(
                document_code
            )

        preview = connection.execute(
            preview_statement,
            {
                "document_id": document["id"],
            },
        ).mappings().first()

    document_result = dict(document)

    return {
        "database_id": database_id,
        "document": document_result,
        "preview": (
            dict(preview)
            if preview is not None
            else None
        ),
    }


def create_search_snippet(
    content: str,
    query: str,
    maximum_length: int = 500,
) -> str:
    normalized_content = content.strip()
    match_position = normalized_content.lower().find(
        query.lower()
    )

    if match_position < 0:
        return normalized_content[:maximum_length]

    context_size = maximum_length // 2
    start = max(
        0,
        match_position - context_size,
    )
    end = min(
        len(normalized_content),
        start + maximum_length,
    )

    if end - start < maximum_length:
        start = max(
            0,
            end - maximum_length,
        )

    snippet = normalized_content[start:end]

    if start > 0:
        snippet = f"...{snippet}"

    if end < len(normalized_content):
        snippet = f"{snippet}..."

    return snippet

def normalize_search_terms(
    search_text: str,
    ) -> list[str]:
        stopwords = {
            "apa",
            "apakah",
            "yang",
            "mana",
            "berapa",
            "siapa",
            "dalam",
            "dari",
            "pada",
            "dengan",
            "untuk",
            "lebih",
            "kurang",
            "bawah",
            "atas",
            "data",
            "dokumen",
            "produk",
            "tersebut",
            "tersedia",
            "tampilkan",
            "carikan",
        }

        raw_terms = re.findall(
            r"[a-zA-Z0-9]+",
            search_text.lower(),
        )

        normalized_terms: list[str] = []

        for term in raw_terms:
            # Contoh: "stoknya" menjadi "stok".
            if term.endswith("nya") and len(term) > 5:
                term = term[:-3]

            if (
                len(term) >= 3
                and term not in stopwords
                and term not in normalized_terms
            ):
                normalized_terms.append(term)

        return normalized_terms[:5]

def search_knowledge(
    role: str,
    database_id: str,
    search_text: str,
    document_code: str | None = None,
    limit: int = 5,
    offset: int = 0,
) -> dict[str, Any]:
    query = search_text.strip()

    documents_table, chunks_table = (
        ensure_document_access(
            database_id,
            role,
        )
    )

    search_terms = normalize_search_terms(
        query
    )

    if not search_terms:
        search_terms = [query.lower()]

    term_conditions: list[str] = []

    parameters: dict[str, Any] = {
        "limit": limit,
        "offset": offset,
    }

    for index, term in enumerate(
        search_terms
    ):
        parameter_name = f"term_{index}"

        term_conditions.append(
            f"""
            INSTR(
                LOWER(c.`content`),
                :{parameter_name}
            ) > 0
            """
        )

        parameters[parameter_name] = term

    conditions = [
        (
            "("
            + " AND ".join(term_conditions)
            + ")"
        ),
        "d.`status` = 'processed'",
    ]

    if document_code is not None:
        conditions.append(
            "d.`document_code` = :document_code"
        )
        parameters["document_code"] = (
            document_code
        )

    where_clause = (
        "WHERE " + " AND ".join(conditions)
    )

    count_statement = text(
        f"""
        SELECT COUNT(*) AS `total`
        FROM `{chunks_table}` AS c
        INNER JOIN `{documents_table}` AS d
            ON d.`id` = c.`document_id`
        {where_clause}
        """
    )

    search_statement = text(
        f"""
        SELECT
            d.`document_code`,
            d.`original_name`,
            d.`mime_type`,
            c.`chunk_index`,
            c.`content`,
            c.`token_count`,
            d.`created_at`
                AS `document_created_at`
        FROM `{chunks_table}` AS c
        INNER JOIN `{documents_table}` AS d
            ON d.`id` = c.`document_id`
        {where_clause}
        ORDER BY
            d.`id` DESC,
            c.`chunk_index` ASC
        LIMIT :limit
        OFFSET :offset
        """
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        total = connection.execute(
            count_statement,
            parameters,
        ).scalar_one()

        rows = connection.execute(
            search_statement,
            parameters,
        ).mappings().all()

    results = []

    for row in rows:
        result = dict(row)
        content = result.pop("content")

        # Pakai kata yang benar-benar ditemukan agar
        # penanda snippet tetap bekerja.
        snippet_query = next(
            (
                term
                for term in search_terms
                if term in content.lower()
            ),
            search_terms[0],
        )

        result["snippet"] = (
            create_search_snippet(
                content,
                snippet_query,
            )
        )

        results.append(result)

    return {
        "database_id": database_id,
        "query": query,
        "search_terms": search_terms,
        "document_code": document_code,
        "results": results,
        "pagination": {
            "total": int(total),
            "limit": limit,
            "offset": offset,
            "returned": len(results),
        },
    }