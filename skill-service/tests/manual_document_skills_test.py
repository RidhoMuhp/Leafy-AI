import sys
from pathlib import Path
from uuid import uuid4

import httpx
from sqlalchemy import text

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1]),
)

from app.config import get_settings
from app.database.connection import database_transaction


BASE_URL = "http://127.0.0.1:8000"
DATABASE_ID = "leafy_core"
ROLE = "superadmin"

settings = get_settings()

HEADERS = {
    "x-leafy-internal-key":
        settings.leafy_internal_key,
}

MARKER = f"leafy-search-{uuid4().hex}"
FILE_NAME = f"document-skill-{uuid4().hex}.txt"

TEST_CONTENT = (
    "Laporan Operasional Leafy AI\n\n"
    f"Kode pengujian unik: {MARKER}\n"
    "Stok kritis memerlukan pemeriksaan oleh manager.\n"
    "Invoice pelanggan harus diperiksa sebelum jatuh tempo.\n"
    "Setiap tindakan sensitif membutuhkan approval manusia.\n"
)


results: list[dict] = []
document_code: str | None = None
document_id: int | None = None


def record(
    name: str,
    expected,
    actual,
) -> None:
    passed = expected == actual

    results.append(
        {
            "name": name,
            "expected": expected,
            "actual": actual,
            "passed": passed,
        }
    )


def execute_skill(
    skill: str,
    parameters: dict,
    role: str = ROLE,
) -> httpx.Response:
    return httpx.post(
        f"{BASE_URL}/execute",
        headers=HEADERS,
        json={
            "skill": skill,
            "role": role,
            "parameters": parameters,
        },
        timeout=30.0,
    )


def cleanup_fixture() -> None:
    global document_id

    if document_id is None:
        return

    with database_transaction(
        DATABASE_ID,
        ROLE,
    ) as connection:
        connection.execute(
            text(
                """
                DELETE FROM `knowledge_chunks`
                WHERE `document_id` = :document_id
                """
            ),
            {
                "document_id": document_id,
            },
        )

        connection.execute(
            text(
                """
                DELETE FROM `knowledge_documents`
                WHERE `id` = :document_id
                """
            ),
            {
                "document_id": document_id,
            },
        )


try:
    health_response = httpx.get(
        f"{BASE_URL}/health",
        timeout=10.0,
    )

    record(
        "Health",
        200,
        health_response.status_code,
    )

    skills_response = httpx.get(
        f"{BASE_URL}/skills",
        headers=HEADERS,
        params={"role": ROLE},
        timeout=10.0,
    )

    record(
        "List available skills",
        200,
        skills_response.status_code,
    )

    skill_names = {
        item["name"]
        for item in (
            skills_response.json().get(
                "skills",
                [],
            )
            if skills_response.status_code == 200
            else []
        )
    }

    record(
        "list_documents registered",
        True,
        "list_documents" in skill_names,
    )

    record(
        "get_document registered",
        True,
        "get_document" in skill_names,
    )

    record(
        "search_knowledge registered",
        True,
        "search_knowledge" in skill_names,
    )

    ingest_response = httpx.post(
        f"{BASE_URL}/documents/ingest",
        headers=HEADERS,
        data={
            "role": ROLE,
            "database_id": DATABASE_ID,
        },
        files={
            "file": (
                FILE_NAME,
                TEST_CONTENT.encode("utf-8"),
                "text/plain",
            ),
        },
        timeout=30.0,
    )

    record(
        "Ingest fixture",
        200,
        ingest_response.status_code,
    )

    if ingest_response.status_code != 200:
        raise RuntimeError(
            "Fixture gagal dibuat: "
            f"{ingest_response.text}"
        )

    ingest_result = (
        ingest_response.json()["result"]
    )
    fixture_document = ingest_result["document"]

    document_code = fixture_document[
        "document_code"
    ]
    document_id = fixture_document["id"]

    record(
        "Fixture document code",
        True,
        document_code.startswith("DOC-"),
    )

    list_response = execute_skill(
        "list_documents",
        {
            "database_id": DATABASE_ID,
            "limit": 20,
            "offset": 0,
        },
    )

    record(
        "List documents status",
        200,
        list_response.status_code,
    )

    list_result = (
        list_response.json().get("result", {})
        if list_response.status_code == 200
        else {}
    )

    listed_documents = list_result.get(
        "documents",
        [],
    )

    record(
        "Fixture listed",
        True,
        any(
            item.get("document_code")
            == document_code
            for item in listed_documents
        ),
    )

    record(
        "List pagination available",
        True,
        isinstance(
            list_result.get("pagination"),
            dict,
        ),
    )

    list_search_response = execute_skill(
        "list_documents",
        {
            "database_id": DATABASE_ID,
            "search": FILE_NAME,
            "limit": 10,
            "offset": 0,
        },
    )

    record(
        "List search status",
        200,
        list_search_response.status_code,
    )

    list_search_result = (
        list_search_response.json().get(
            "result",
            {},
        )
        if list_search_response.status_code == 200
        else {}
    )

    record(
        "List search finds fixture",
        True,
        any(
            item.get("document_code")
            == document_code
            for item in list_search_result.get(
                "documents",
                [],
            )
        ),
    )

    list_status_response = execute_skill(
        "list_documents",
        {
            "database_id": DATABASE_ID,
            "status": "processed",
            "limit": 20,
            "offset": 0,
        },
    )

    record(
        "List status filter",
        200,
        list_status_response.status_code,
    )

    get_response = execute_skill(
        "get_document",
        {
            "database_id": DATABASE_ID,
            "document_code": document_code,
        },
    )

    record(
        "Get document status",
        200,
        get_response.status_code,
    )

    get_result = (
        get_response.json().get("result", {})
        if get_response.status_code == 200
        else {}
    )

    record(
        "Get correct document",
        document_code,
        get_result.get(
            "document",
            {},
        ).get("document_code"),
    )

    record(
        "Get document chunk count",
        True,
        get_result.get(
            "document",
            {},
        ).get("chunk_count", 0) >= 1,
    )

    record(
        "Get document preview",
        True,
        MARKER in (
            get_result.get(
                "preview",
                {},
            ).get("content", "")
            if get_result.get("preview")
            else ""
        ),
    )

    missing_response = execute_skill(
        "get_document",
        {
            "database_id": DATABASE_ID,
            "document_code":
                "DOC-AAAAAAAAAAAAAAAAAAAA",
        },
    )

    record(
        "Missing document",
        404,
        missing_response.status_code,
    )

    search_response = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text": MARKER,
            "limit": 5,
            "offset": 0,
        },
    )

    record(
        "Search knowledge status",
        200,
        search_response.status_code,
    )

    search_result = (
        search_response.json().get("result", {})
        if search_response.status_code == 200
        else {}
    )

    search_items = search_result.get(
        "results",
        [],
    )

    record(
        "Search returns result",
        True,
        len(search_items) >= 1,
    )

    record(
        "Search correct document",
        True,
        any(
            item.get("document_code")
            == document_code
            for item in search_items
        ),
    )

    record(
        "Search original name",
        True,
        any(
            item.get("original_name")
            == FILE_NAME
            for item in search_items
        ),
    )

    record(
        "Search chunk index",
        True,
        all(
            isinstance(
                item.get("chunk_index"),
                int,
            )
            for item in search_items
        ),
    )

    record(
        "Search snippet marker",
        True,
        any(
            MARKER in item.get(
                "snippet",
                "",
            )
            for item in search_items
        ),
    )

    filtered_search_response = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text": "approval manusia",
            "document_code": document_code,
            "limit": 5,
            "offset": 0,
        },
    )

    record(
        "Filtered search status",
        200,
        filtered_search_response.status_code,
    )

    filtered_result = (
        filtered_search_response.json().get(
            "result",
            {},
        )
        if filtered_search_response.status_code == 200
        else {}
    )

    record(
        "Filtered search document",
        True,
        all(
            item.get("document_code")
            == document_code
            for item in filtered_result.get(
                "results",
                [],
            )
        )
        and len(
            filtered_result.get(
                "results",
                [],
            )
        ) >= 1,
    )

    empty_search_response = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text":
                "kata-yang-tidak-tersedia-"
                + uuid4().hex,
            "limit": 5,
            "offset": 0,
        },
    )

    record(
        "Empty search status",
        200,
        empty_search_response.status_code,
    )

    empty_result = (
        empty_search_response.json().get(
            "result",
            {},
        )
        if empty_search_response.status_code == 200
        else {}
    )

    record(
        "Empty search result",
        0,
        len(empty_result.get("results", [])),
    )

    wrong_role_list = execute_skill(
        "list_documents",
        {
            "database_id": DATABASE_ID,
        },
        role="user",
    )

    record(
        "List wrong role",
        403,
        wrong_role_list.status_code,
    )

    wrong_role_get = execute_skill(
        "get_document",
        {
            "database_id": DATABASE_ID,
            "document_code": document_code,
        },
        role="user",
    )

    record(
        "Get wrong role",
        403,
        wrong_role_get.status_code,
    )

    wrong_role_search = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text": MARKER,
        },
        role="user",
    )

    record(
        "Search wrong role",
        403,
        wrong_role_search.status_code,
    )

    extra_parameter_response = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text": MARKER,
            "raw_sql":
                "SELECT * FROM knowledge_chunks",
        },
    )

    record(
        "Unknown parameter rejected",
        422,
        extra_parameter_response.status_code,
    )

    short_query_response = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text": "a",
        },
    )

    record(
        "Short query rejected",
        422,
        short_query_response.status_code,
    )

    excessive_limit_response = execute_skill(
        "search_knowledge",
        {
            "database_id": DATABASE_ID,
            "search_text": MARKER,
            "limit": 21,
        },
    )

    record(
        "Excessive limit rejected",
        422,
        excessive_limit_response.status_code,
    )

    invalid_database_response = execute_skill(
        "search_knowledge",
        {
            "database_id":
                "leafy_core;drop_table",
            "search_text": MARKER,
        },
    )

    record(
        "Invalid database ID rejected",
        422,
        invalid_database_response.status_code,
    )

    unknown_database_response = execute_skill(
        "search_knowledge",
        {
            "database_id":
                "unknown_database",
            "search_text": MARKER,
        },
    )

    record(
        "Unknown database",
        400,
        unknown_database_response.status_code,
    )

finally:
    cleanup_fixture()

    cleanup_document_count = None
    cleanup_chunk_count = None

    if document_id is not None:
        with database_transaction(
            DATABASE_ID,
            ROLE,
        ) as connection:
            cleanup_document_count = (
                connection.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM `knowledge_documents`
                        WHERE `id` = :document_id
                        """
                    ),
                    {
                        "document_id":
                            document_id,
                    },
                ).scalar_one()
            )

            cleanup_chunk_count = (
                connection.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM `knowledge_chunks`
                        WHERE `document_id` = :document_id
                        """
                    ),
                    {
                        "document_id":
                            document_id,
                    },
                ).scalar_one()
            )

        record(
            "Cleanup knowledge_documents",
            0,
            cleanup_document_count,
        )

        record(
            "Cleanup knowledge_chunks",
            0,
            cleanup_chunk_count,
        )


print()
print(
    f"{'Test':<42}"
    f"{'Expected':<18}"
    f"{'Actual':<18}"
    "Pass"
)
print("-" * 86)

for result in results:
    print(
        f"{result['name']:<42}"
        f"{str(result['expected']):<18}"
        f"{str(result['actual']):<18}"
        f"{result['passed']}"
    )

passed_count = sum(
    1
    for result in results
    if result["passed"]
)

print()
print(
    f"Result: {passed_count}/{len(results)} "
    "PASS"
)

if passed_count != len(results):
    raise SystemExit(1)