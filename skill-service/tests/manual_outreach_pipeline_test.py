from datetime import datetime
from pathlib import Path
import sys

import httpx
from sqlalchemy import bindparam, text

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1]),
)

from app.config import get_settings
from app.database.connection import database_transaction


BASE_URL = "http://127.0.0.1:8000"
DATABASE_ID = "leafy_core"
ROLE = "superadmin"

results: list[dict] = []
created_client_ids: list[int] = []


def add_result(
    name: str,
    expected,
    actual,
    detail="",
):
    results.append(
        {
            "test": name,
            "expected": expected,
            "actual": actual,
            "pass": expected == actual,
            "detail": detail,
        }
    )


def execute_skill(
    client: httpx.Client,
    skill: str,
    parameters: dict,
):
    return client.post(
        "/execute",
        json={
            "skill": skill,
            "role": ROLE,
            "parameters": parameters,
        },
    )


def create_client(
    client: httpx.Client,
    code: str,
) -> int:
    response = execute_skill(
        client,
        "create_client",
        {
            "database_id": DATABASE_ID,
            "client_code": code,
            "name": f"Pipeline Test {code}",
            "business_type": "test",
            "city": "Makassar",
            "source": "manual_pipeline_test",
            "status": "prospect",
            "notes": "Disposable test data",
        },
    )

    add_result(
        f"Create {code}",
        200,
        response.status_code,
        response.text,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"Gagal membuat disposable client: {code}"
        )

    client_id = response.json()["result"]["client"]["id"]
    created_client_ids.append(client_id)

    return client_id


def record_outreach(
    client: httpx.Client,
    client_id: int,
    outcome: str,
    expected_status: str,
    expected_changed: bool,
    follow_up_at: str | None = None,
):
    parameters = {
        "database_id": DATABASE_ID,
        "client_id": client_id,
        "channel": "whatsapp",
        "direction": "outbound",
        "message_summary": (
            f"Pipeline test outcome {outcome}"
        ),
        "outcome": outcome,
    }

    if follow_up_at is not None:
        parameters["follow_up_at"] = follow_up_at

    response = execute_skill(
        client,
        "record_outreach",
        parameters,
    )

    if response.status_code != 200:
        add_result(
            f"{outcome} request",
            200,
            response.status_code,
            response.text,
        )
        return

    result = response.json()["result"]
    actual_status = result["client"]["current_status"]
    actual_changed = result["client"]["status_changed"]

    add_result(
        f"{outcome} status",
        expected_status,
        actual_status,
        response.text,
    )

    add_result(
        f"{outcome} status_changed",
        expected_changed,
        actual_changed,
        response.text,
    )

    detail_response = execute_skill(
        client,
        "get_client",
        {
            "database_id": DATABASE_ID,
            "client_id": client_id,
        },
    )

    actual_persisted_status = (
        detail_response.json()["result"]["client"]["status"]
        if detail_response.status_code == 200
        else f"HTTP {detail_response.status_code}"
    )

    add_result(
        f"{outcome} persisted",
        expected_status,
        actual_persisted_status,
        detail_response.text,
    )


def count_test_outreach() -> int:
    if not created_client_ids:
        return 0

    statement = (
        text(
            """
            SELECT COUNT(*)
            FROM outreach_logs
            WHERE client_id IN :client_ids
            """
        )
        .bindparams(
            bindparam(
                "client_ids",
                expanding=True,
            )
        )
    )

    with database_transaction(
        DATABASE_ID,
        ROLE,
    ) as connection:
        return connection.execute(
            statement,
            {
                "client_ids": created_client_ids,
            },
        ).scalar_one()


def cleanup():
    if not created_client_ids:
        return

    delete_outreach = (
        text(
            """
            DELETE FROM outreach_logs
            WHERE client_id IN :client_ids
            """
        )
        .bindparams(
            bindparam(
                "client_ids",
                expanding=True,
            )
        )
    )

    delete_clients = (
        text(
            """
            DELETE FROM clients
            WHERE id IN :client_ids
            """
        )
        .bindparams(
            bindparam(
                "client_ids",
                expanding=True,
            )
        )
    )

    with database_transaction(
        DATABASE_ID,
        ROLE,
    ) as connection:
        connection.execute(
            delete_outreach,
            {
                "client_ids": created_client_ids,
            },
        )
        connection.execute(
            delete_clients,
            {
                "client_ids": created_client_ids,
            },
        )


def print_results():
    print()
    print(
        f"{'Test':<42} "
        f"{'Expected':<14} "
        f"{'Actual':<14} "
        f"Pass"
    )
    print("-" * 82)

    for item in results:
        print(
            f"{item['test']:<42} "
            f"{str(item['expected']):<14} "
            f"{str(item['actual']):<14} "
            f"{item['pass']}"
        )

        if not item["pass"]:
            print(
                f"  Detail: {item['detail']}"
            )

    passed = sum(
        item["pass"]
        for item in results
    )

    print()
    print(
        f"Result: {passed}/{len(results)} PASS"
    )


def main():
    settings = get_settings()
    unique = datetime.now().strftime(
        "%Y%m%d%H%M%S%f"
    )

    headers = {
        "x-leafy-internal-key":
            settings.leafy_internal_key,
    }

    try:
        with httpx.Client(
            base_url=BASE_URL,
            headers=headers,
            timeout=20,
        ) as client:
            health = client.get("/health")

            add_result(
                "Health",
                200,
                health.status_code,
                health.text,
            )

            first_id = create_client(
                client,
                f"PIPE-A-{unique}",
            )
            second_id = create_client(
                client,
                f"PIPE-B-{unique}",
            )
            third_id = create_client(
                client,
                f"PIPE-C-{unique}",
            )

            # Prospect → contacted
            record_outreach(
                client,
                first_id,
                outcome="no_response",
                expected_status="contacted",
                expected_changed=True,
            )

            # Contacted → qualified
            record_outreach(
                client,
                first_id,
                outcome="interested",
                expected_status="qualified",
                expected_changed=True,
            )

            # Qualified tidak boleh turun
            record_outreach(
                client,
                first_id,
                outcome="replied",
                expected_status="qualified",
                expected_changed=False,
            )

            # Qualified → won
            record_outreach(
                client,
                first_id,
                outcome="converted",
                expected_status="won",
                expected_changed=True,
            )

            # Won adalah status terminal
            record_outreach(
                client,
                first_id,
                outcome="not_interested",
                expected_status="won",
                expected_changed=False,
            )

            # No response dengan jadwal → follow_up
            record_outreach(
                client,
                second_id,
                outcome="no_response",
                expected_status="follow_up",
                expected_changed=True,
                follow_up_at="2099-12-31T10:00:00+08:00",
            )

            # Invalid contact tidak otomatis lost
            record_outreach(
                client,
                third_id,
                outcome="invalid_contact",
                expected_status="prospect",
                expected_changed=False,
            )

            # Penolakan eksplisit → lost
            record_outreach(
                client,
                third_id,
                outcome="not_interested",
                expected_status="lost",
                expected_changed=True,
            )

            # Lost adalah status terminal
            record_outreach(
                client,
                third_id,
                outcome="converted",
                expected_status="lost",
                expected_changed=False,
            )

            outreach_count = count_test_outreach()

            add_result(
                "All outreach stored for audit",
                9,
                outreach_count,
            )

    finally:
        try:
            cleanup()
            add_result(
                "Cleanup disposable data",
                True,
                True,
            )
        except Exception as error:
            add_result(
                "Cleanup disposable data",
                True,
                False,
                repr(error),
            )

        print_results()


if __name__ == "__main__":
    main()