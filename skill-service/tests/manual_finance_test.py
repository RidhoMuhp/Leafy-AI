from datetime import date
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import text

from app.config import get_settings
from app.database.connection import database_transaction


BASE_URL = "http://127.0.0.1:8000"
DATABASE_ID = "leafy_core"
ACTOR_ID = "c" * 64
TEST_DATE = date(2099, 12, 30)

settings = get_settings()

headers = {
    "x-leafy-internal-key":
        settings.leafy_internal_key,
}

results: list[dict[str, Any]] = []
created_transaction_codes: list[str] = []


def execute_skill(
    client: httpx.Client,
    skill: str,
    parameters: dict[str, Any],
    role: str = "superadmin",
    actor_id: str | None = ACTOR_ID,
) -> httpx.Response:
    payload = {
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


def record_test(
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
            "test": name,
            "expected": expected,
            "actual": response.status_code,
            "pass": passed,
            "detail": str(detail)[:160],
        }
    )


def summary_parameters() -> dict[str, Any]:
    date_value = TEST_DATE.isoformat()

    return {
        "database_id": DATABASE_ID,
        "start_date": date_value,
        "end_date": date_value,
    }


def get_summary(
    client: httpx.Client,
) -> httpx.Response:
    return execute_skill(
        client,
        "get_finance_summary",
        summary_parameters(),
    )


def cleanup_transactions() -> None:
    if not created_transaction_codes:
        return

    parameters = {
        f"code_{index}": code
        for index, code in enumerate(
            created_transaction_codes
        )
    }

    placeholders = ", ".join(
        f":code_{index}"
        for index in range(
            len(created_transaction_codes)
        )
    )

    statement = text(
        f"""
        DELETE FROM `finance_transactions`
        WHERE `transaction_code`
            IN ({placeholders})
        """
    )

    with database_transaction(
        DATABASE_ID,
        "superadmin",
    ) as connection:
        connection.execute(
            statement,
            parameters,
        )


def print_results() -> None:
    print()
    print(
        f"{'Test':39} "
        f"{'Expected':8} "
        f"{'Actual':6} "
        f"{'Pass':5}"
    )
    print("-" * 67)

    for item in results:
        print(
            f"{item['test'][:39]:39} "
            f"{item['expected']:8} "
            f"{item['actual']:6} "
            f"{str(item['pass']):5}"
        )

        if not item["pass"]:
            print(
                f"  Detail: {item['detail']}"
            )

    passed = sum(
        1
        for item in results
        if item["pass"]
    )

    print()
    print(
        f"Result: {passed}/{len(results)} PASS"
    )

    if passed != len(results):
        raise SystemExit(1)


def main() -> None:
    try:
        with httpx.Client(
            base_url=BASE_URL,
            timeout=30,
        ) as client:
            health = client.get("/health")

            record_test(
                "Health",
                200,
                health,
            )

            categories = execute_skill(
                client,
                "list_finance_categories",
                {
                    "database_id":
                        DATABASE_ID,
                },
            )

            categories_valid = False

            if categories.status_code == 200:
                category_result = (
                    categories.json()["result"]
                )
                category_codes = {
                    item["category_code"]
                    for item in category_result[
                        "categories"
                    ]
                }

                categories_valid = {
                    "service_income",
                    "internet",
                    "operations",
                    "sales",
                }.issubset(category_codes)

            record_test(
                "List finance categories",
                200,
                categories,
                categories_valid,
            )

            baseline_response = get_summary(
                client
            )

            baseline_valid = (
                baseline_response.status_code
                == 200
            )

            baseline_income = Decimal("0")
            baseline_expense = Decimal("0")
            baseline_count = 0

            if baseline_valid:
                baseline = baseline_response.json()[
                    "result"
                ]
                baseline_income = Decimal(
                    str(
                        baseline[
                            "total_income"
                        ]
                    )
                )
                baseline_expense = Decimal(
                    str(
                        baseline[
                            "total_expense"
                        ]
                    )
                )
                baseline_count = int(
                    baseline[
                        "transaction_count"
                    ]
                )

            record_test(
                "Finance baseline summary",
                200,
                baseline_response,
                baseline_valid,
            )

            income_response = execute_skill(
                client,
                "record_income",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "service_income",
                    "amount": 500000,
                    "description":
                        "Finance beta test income",
                    "transaction_date":
                        TEST_DATE.isoformat(),
                    "counterparty":
                        "Leafy Beta Test",
                    "payment_method":
                        "bank_transfer",
                    "reference_number":
                        "TEST-INCOME-001",
                    "notes":
                        "Akan dibersihkan oleh test",
                },
            )

            income_valid = False

            if income_response.status_code == 200:
                income_result = (
                    income_response.json()[
                        "result"
                    ]
                )
                transaction = income_result[
                    "transaction"
                ]

                created_transaction_codes.append(
                    transaction[
                        "transaction_code"
                    ]
                )

                income_valid = (
                    transaction[
                        "transaction_type"
                    ] == "income"
                    and Decimal(
                        str(transaction["amount"])
                    ) == Decimal("500000")
                    and transaction[
                        "category_code"
                    ] == "service_income"
                )

            record_test(
                "Record income valid",
                200,
                income_response,
                income_valid,
            )

            expense_response = execute_skill(
                client,
                "record_expense",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "internet",
                    "amount": 75000,
                    "description":
                        "Finance beta test expense",
                    "transaction_date":
                        TEST_DATE.isoformat(),
                    "counterparty":
                        "Leafy Beta Test",
                    "payment_method":
                        "cash",
                    "reference_number":
                        "TEST-EXPENSE-001",
                    "notes":
                        "Akan dibersihkan oleh test",
                },
            )

            expense_valid = False

            if expense_response.status_code == 200:
                expense_result = (
                    expense_response.json()[
                        "result"
                    ]
                )
                transaction = expense_result[
                    "transaction"
                ]

                created_transaction_codes.append(
                    transaction[
                        "transaction_code"
                    ]
                )

                expense_valid = (
                    transaction[
                        "transaction_type"
                    ] == "expense"
                    and Decimal(
                        str(transaction["amount"])
                    ) == Decimal("75000")
                    and transaction[
                        "category_code"
                    ] == "internet"
                )

            record_test(
                "Record expense valid",
                200,
                expense_response,
                expense_valid,
            )

            type_mismatch = execute_skill(
                client,
                "record_income",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "internet",
                    "amount": 10000,
                    "description":
                        "Invalid category type",
                    "transaction_date":
                        TEST_DATE.isoformat(),
                },
            )

            record_test(
                "Category type mismatch",
                422,
                type_mismatch,
            )

            unknown_category = execute_skill(
                client,
                "record_expense",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "unknown_category",
                    "amount": 10000,
                    "description":
                        "Unknown category",
                    "transaction_date":
                        TEST_DATE.isoformat(),
                },
            )

            record_test(
                "Unknown finance category",
                404,
                unknown_category,
            )

            client_not_found = execute_skill(
                client,
                "record_income",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "sales",
                    "amount": 10000,
                    "description":
                        "Missing client test",
                    "transaction_date":
                        TEST_DATE.isoformat(),
                    "client_id": 999999999,
                },
            )

            record_test(
                "Finance client not found",
                404,
                client_not_found,
            )

            wrong_role = execute_skill(
                client,
                "record_income",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "sales",
                    "amount": 10000,
                    "description":
                        "Unauthorized finance test",
                },
                role="user",
            )

            record_test(
                "Finance wrong role",
                403,
                wrong_role,
            )

            missing_actor = execute_skill(
                client,
                "record_income",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "sales",
                    "amount": 10000,
                    "description":
                        "Missing actor test",
                },
                actor_id=None,
            )

            record_test(
                "Finance missing actor",
                422,
                missing_actor,
            )

            invalid_amount = execute_skill(
                client,
                "record_expense",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "operations",
                    "amount": -1000,
                    "description":
                        "Invalid amount test",
                },
            )

            record_test(
                "Invalid finance amount",
                422,
                invalid_amount,
            )

            forbidden_parameter = execute_skill(
                client,
                "record_expense",
                {
                    "database_id":
                        DATABASE_ID,
                    "category_code":
                        "operations",
                    "amount": 10000,
                    "description":
                        "Forbidden parameter test",
                    "raw_sql":
                        "DROP TABLE finance_transactions",
                },
            )

            record_test(
                "Finance forbidden parameter",
                422,
                forbidden_parameter,
            )

            invalid_period = execute_skill(
                client,
                "get_finance_summary",
                {
                    "database_id":
                        DATABASE_ID,
                    "start_date":
                        "2099-12-31",
                    "end_date":
                        "2099-12-01",
                },
            )

            record_test(
                "Invalid finance period",
                422,
                invalid_period,
            )

            transactions_response = (
                execute_skill(
                    client,
                    "list_finance_transactions",
                    {
                        "database_id":
                            DATABASE_ID,
                        "start_date":
                            TEST_DATE.isoformat(),
                        "end_date":
                            TEST_DATE.isoformat(),
                        "status": "posted",
                        "limit": 100,
                        "offset": 0,
                    },
                )
            )

            transactions_valid = False

            if (
                transactions_response.status_code
                == 200
            ):
                transactions = (
                    transactions_response.json()[
                        "result"
                    ]["transactions"]
                )

                returned_codes = {
                    transaction[
                        "transaction_code"
                    ]
                    for transaction
                    in transactions
                }

                transactions_valid = set(
                    created_transaction_codes
                ).issubset(returned_codes)

            record_test(
                "List finance transactions",
                200,
                transactions_response,
                transactions_valid,
            )

            final_summary_response = (
                get_summary(client)
            )

            final_summary_valid = False

            if (
                final_summary_response.status_code
                == 200
            ):
                final_summary = (
                    final_summary_response.json()[
                        "result"
                    ]
                )

                final_income = Decimal(
                    str(
                        final_summary[
                            "total_income"
                        ]
                    )
                )
                final_expense = Decimal(
                    str(
                        final_summary[
                            "total_expense"
                        ]
                    )
                )
                final_net = Decimal(
                    str(
                        final_summary[
                            "net_cashflow"
                        ]
                    )
                )
                final_count = int(
                    final_summary[
                        "transaction_count"
                    ]
                )

                final_summary_valid = (
                    final_income
                    - baseline_income
                    == Decimal("500000")
                    and final_expense
                    - baseline_expense
                    == Decimal("75000")
                    and final_net
                    - (
                        baseline_income
                        - baseline_expense
                    )
                    == Decimal("425000")
                    and final_count
                    - baseline_count
                    == 2
                )

            record_test(
                "Finance summary calculation",
                200,
                final_summary_response,
                final_summary_valid,
            )

    finally:
        cleanup_transactions()

    print_results()


if __name__ == "__main__":
    main()