from datetime import date
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import text

from app.config import get_settings
from app.database.connection import database_transaction


BASE_URL = "http://127.0.0.1:8000"
DATABASE_ID = "leafy_core"
ACTOR_ID = "d" * 64
OTHER_ACTOR_ID = "e" * 64
TEST_DATE = date(2099, 12, 29)

settings = get_settings()

headers = {
    "x-leafy-internal-key":
        settings.leafy_internal_key,
}

results: list[dict[str, Any]] = []
transaction_id: int | None = None
transaction_code: str | None = None
action_ids: list[str] = []


def execute_skill(
    client: httpx.Client,
    skill: str,
    parameters: dict[str, Any],
    role: str = "superadmin",
    actor_id: str | None = ACTOR_ID,
) -> httpx.Response:
    payload: dict[str, Any] = {
        "skill": skill,
        "role": role,
        "parameters": parameters,
    }

    if actor_id is not None:
        payload["actor_id"] = actor_id

    return client.post(
        "/execute",
        headers=headers,
        json=payload,
    )


def add_result(
    name: str,
    expected: int,
    response: httpx.Response,
    condition: bool = True,
) -> None:
    passed = (
        response.status_code == expected
        and condition
    )

    try:
        detail = response.json()
    except Exception:
        detail = response.text

    results.append(
        {
            "name": name,
            "expected": expected,
            "actual": response.status_code,
            "pass": passed,
            "detail": str(detail)[:180],
        }
    )


def get_summary(
    client: httpx.Client,
) -> httpx.Response:
    return execute_skill(
        client,
        "get_finance_summary",
        {
            "database_id": DATABASE_ID,
            "start_date": TEST_DATE.isoformat(),
            "end_date": TEST_DATE.isoformat(),
        },
    )


def cleanup() -> None:
    global transaction_id

    with database_transaction(
        DATABASE_ID,
        "superadmin",
    ) as connection:
        for action_id in action_ids:
            connection.execute(
                text(
                    """
                    DELETE FROM `pending_actions`
                    WHERE `action_id` = :action_id
                      AND `action_type`
                        = 'void_finance_transaction'
                    """
                ),
                {
                    "action_id": action_id,
                },
            )

        if transaction_id is not None:
            connection.execute(
                text(
                    """
                    DELETE FROM `finance_transactions`
                    WHERE `id` = :transaction_id
                      AND `created_by` = :created_by
                    """
                ),
                {
                    "transaction_id": transaction_id,
                    "created_by": ACTOR_ID,
                },
            )


def print_results() -> None:
    print()
    print(
        f"{'Test':40} "
        f"{'Expected':8} "
        f"{'Actual':6} "
        f"{'Pass':5}"
    )
    print("-" * 68)

    for item in results:
        print(
            f"{item['name'][:40]:40} "
            f"{item['expected']:8} "
            f"{item['actual']:6} "
            f"{str(item['pass']):5}"
        )

        if not item["pass"]:
            print(
                f"  Detail: {item['detail']}"
            )

    passed = sum(
        1 for item in results
        if item["pass"]
    )

    print()
    print(
        f"Result: {passed}/{len(results)} PASS"
    )

    if passed != len(results):
        raise SystemExit(1)


def main() -> None:
    global transaction_id
    global transaction_code

    try:
        with httpx.Client(
            base_url=BASE_URL,
            timeout=30,
        ) as client:
            health = client.get("/health")

            add_result(
                "Health",
                200,
                health,
            )

            baseline_response = get_summary(client)
            baseline_net = Decimal("0")
            baseline_count = 0
            baseline_valid = False

            if baseline_response.status_code == 200:
                baseline = baseline_response.json()[
                    "result"
                ]
                baseline_net = Decimal(
                    str(baseline["net_cashflow"])
                )
                baseline_count = int(
                    baseline["transaction_count"]
                )
                baseline_valid = True

            add_result(
                "Baseline summary",
                200,
                baseline_response,
                baseline_valid,
            )

            create_response = execute_skill(
                client,
                "record_income",
                {
                    "database_id": DATABASE_ID,
                    "category_code":
                        "service_income",
                    "amount": 300000,
                    "description":
                        "Disposable finance void test",
                    "transaction_date":
                        TEST_DATE.isoformat(),
                    "counterparty":
                        "Leafy Test Suite",
                    "payment_method":
                        "bank_transfer",
                    "notes":
                        "Akan dibersihkan otomatis",
                },
            )

            create_valid = False

            if create_response.status_code == 200:
                transaction = (
                    create_response.json()[
                        "result"
                    ]["transaction"]
                )

                transaction_id = int(
                    transaction["id"]
                )
                transaction_code = transaction[
                    "transaction_code"
                ]

                create_valid = (
                    transaction["status"]
                    == "posted"
                    and Decimal(
                        str(transaction["amount"])
                    ) == Decimal("300000")
                )

            add_result(
                "Create disposable transaction",
                200,
                create_response,
                create_valid,
            )

            if transaction_id is None:
                print_results()
                return

            detail_response = execute_skill(
                client,
                "get_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                },
            )

            detail_valid = False

            if detail_response.status_code == 200:
                detail = detail_response.json()[
                    "result"
                ]["transaction"]

                detail_valid = (
                    detail["id"] == transaction_id
                    and detail[
                        "transaction_code"
                    ] == transaction_code
                    and detail["status"]
                    == "posted"
                )

            add_result(
                "Get finance transaction",
                200,
                detail_response,
                detail_valid,
            )

            summary_posted = get_summary(client)
            summary_posted_valid = False

            if summary_posted.status_code == 200:
                value = summary_posted.json()[
                    "result"
                ]

                summary_posted_valid = (
                    Decimal(
                        str(value["net_cashflow"])
                    ) - baseline_net
                    == Decimal("300000")
                    and int(
                        value["transaction_count"]
                    ) - baseline_count
                    == 1
                )

            add_result(
                "Posted included in summary",
                200,
                summary_posted,
                summary_posted_valid,
            )

            missing_actor = execute_skill(
                client,
                "preview_void_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                    "reason":
                        "Pengujian tanpa actor",
                },
                actor_id=None,
            )

            add_result(
                "Preview without actor",
                422,
                missing_actor,
            )

            wrong_role = execute_skill(
                client,
                "preview_void_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                    "reason":
                        "Pengujian role salah",
                },
                role="admin",
            )

            add_result(
                "Preview wrong role",
                403,
                wrong_role,
            )

            not_found = execute_skill(
                client,
                "preview_void_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id": 999999999,
                    "reason":
                        "Transaksi tidak tersedia",
                },
            )

            add_result(
                "Preview transaction not found",
                404,
                not_found,
            )

            forbidden = execute_skill(
                client,
                "preview_void_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                    "reason":
                        "Percobaan parameter terlarang",
                    "raw_sql":
                        "DELETE FROM finance_transactions",
                },
            )

            add_result(
                "Preview forbidden parameter",
                422,
                forbidden,
            )

            preview_response = execute_skill(
                client,
                "preview_void_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                    "reason":
                        "Transaksi dibuat untuk pengujian",
                },
            )

            preview_result = None
            preview_valid = False

            if preview_response.status_code == 200:
                preview_result = (
                    preview_response.json()[
                        "result"
                    ]
                )

                action_ids.append(
                    preview_result["action_id"]
                )

                preview_valid = (
                    preview_result[
                        "transaction"
                    ]["id"] == transaction_id
                    and bool(
                        preview_result[
                            "confirmation_token"
                        ]
                    )
                    and preview_result["reason"]
                    == (
                        "Transaksi dibuat "
                        "untuk pengujian"
                    )
                )

            add_result(
                "Preview void valid",
                200,
                preview_response,
                preview_valid,
            )

            if preview_result is None:
                print_results()
                return

            confirmation_parameters = {
                "database_id": DATABASE_ID,
                "action_id":
                    preview_result["action_id"],
                "confirmation_token":
                    preview_result[
                        "confirmation_token"
                    ],
            }

            wrong_token = execute_skill(
                client,
                "confirm_void_finance_transaction",
                {
                    **confirmation_parameters,
                    "confirmation_token":
                        "x" * 43,
                },
            )

            add_result(
                "Wrong confirmation token",
                400,
                wrong_token,
            )

            different_requester = execute_skill(
                client,
                "confirm_void_finance_transaction",
                confirmation_parameters,
                actor_id=OTHER_ACTOR_ID,
            )

            add_result(
                "Different requester",
                400,
                different_requester,
            )

            confirm_response = execute_skill(
                client,
                "confirm_void_finance_transaction",
                confirmation_parameters,
            )

            confirm_valid = False

            if confirm_response.status_code == 200:
                confirmed = (
                    confirm_response.json()[
                        "result"
                    ]
                )

                confirm_valid = (
                    confirmed["voided"] is True
                    and confirmed[
                        "transaction"
                    ]["status"] == "void"
                    and confirmed[
                        "transaction"
                    ]["void_reason"]
                    == (
                        "Transaksi dibuat "
                        "untuk pengujian"
                    )
                )

            add_result(
                "Confirm void valid",
                200,
                confirm_response,
                confirm_valid,
            )

            replay_response = execute_skill(
                client,
                "confirm_void_finance_transaction",
                confirmation_parameters,
            )

            add_result(
                "Replay confirmation",
                400,
                replay_response,
            )

            void_detail_response = execute_skill(
                client,
                "get_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                },
            )

            void_detail_valid = False

            if (
                void_detail_response.status_code
                == 200
            ):
                void_detail = (
                    void_detail_response.json()[
                        "result"
                    ]["transaction"]
                )

                void_detail_valid = (
                    void_detail["status"] == "void"
                    and void_detail["void_reason"]
                    == (
                        "Transaksi dibuat "
                        "untuk pengujian"
                    )
                    and void_detail["voided_at"]
                    is not None
                )

            add_result(
                "Transaction remains as audit",
                200,
                void_detail_response,
                void_detail_valid,
            )

            preview_again = execute_skill(
                client,
                "preview_void_finance_transaction",
                {
                    "database_id": DATABASE_ID,
                    "transaction_id":
                        transaction_id,
                    "reason":
                        "Percobaan void kedua kali",
                },
            )

            add_result(
                "Preview already void",
                409,
                preview_again,
            )

            summary_void = get_summary(client)
            summary_void_valid = False

            if summary_void.status_code == 200:
                value = summary_void.json()[
                    "result"
                ]

                summary_void_valid = (
                    Decimal(
                        str(value["net_cashflow"])
                    ) == baseline_net
                    and int(
                        value["transaction_count"]
                    ) == baseline_count
                )

            add_result(
                "Void excluded from summary",
                200,
                summary_void,
                summary_void_valid,
            )

            list_void_response = execute_skill(
                client,
                "list_finance_transactions",
                {
                    "database_id": DATABASE_ID,
                    "status": "void",
                    "start_date":
                        TEST_DATE.isoformat(),
                    "end_date":
                        TEST_DATE.isoformat(),
                    "limit": 100,
                    "offset": 0,
                },
            )

            list_void_valid = False

            if list_void_response.status_code == 200:
                transactions = (
                    list_void_response.json()[
                        "result"
                    ]["transactions"]
                )

                list_void_valid = any(
                    item["id"] == transaction_id
                    and item["status"] == "void"
                    for item in transactions
                )

            add_result(
                "List void transactions",
                200,
                list_void_response,
                list_void_valid,
            )

    finally:
        cleanup()

    print_results()


if __name__ == "__main__":
    main()