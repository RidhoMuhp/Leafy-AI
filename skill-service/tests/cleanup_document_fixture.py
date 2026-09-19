import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text


SKILL_SERVICE_ROOT = (
    Path(__file__).resolve().parents[1]
)

sys.path.insert(
    0,
    str(SKILL_SERVICE_ROOT),
)

load_dotenv(
    SKILL_SERVICE_ROOT / ".env",
    override=False,
)


from app.database.connection import database_transaction



if len(sys.argv) != 2:
    raise SystemExit(
        "Document code wajib diberikan"
    )

document_code = sys.argv[1].strip()

if not re.fullmatch(
    r"DOC-[A-Z0-9]{20}",
    document_code,
):
    raise SystemExit(
        "Document code tidak valid"
    )


with database_transaction(
    "leafy_core",
    "superadmin",
) as connection:
    document_id = connection.execute(
        text(
            """
            SELECT `id`
            FROM `knowledge_documents`
            WHERE `document_code` = :document_code
            LIMIT 1
            """
        ),
        {
            "document_code": document_code,
        },
    ).scalar_one_or_none()

    if document_id is not None:
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


print("Cleanup document fixture: PASS")