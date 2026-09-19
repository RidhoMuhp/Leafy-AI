from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
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
ACTOR_ID = "a" * 64
WITA = timezone(timedelta(hours=8))

results = []
client_ids = []
transaction_ids = []


def add_result(name, expected, actual, detail=""):
    results.append(
        {
            "name": name,
            "expected": expected,
            "actual": actual,
            "pass": expected == actual,
            "detail": detail,
        }
    )


def execute(
    client,
    skill,
    parameters,
    role="superadmin",
    actor_id=None,
):
    payload = {
        "skill": skill,
        "role": role,
        "parameters": parameters,
    }

    if actor_id is not None:
        payload["actor_id"] = actor_id

    return client.post("/execute", json=payload)


def require_200(name, response):
    add_result(
        name,
        200,
        response.status_code,
        response.text,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"{name} gagal: {response.text}"
        )

    return response.json()["result"]


def decimal_value(value):
    return Decimal(str(value))

def int_value(value):
    return int(value or 0)

def cleanup():
    if transaction_ids:
        statement = (
            text(
                """
                DELETE FROM finance_transactions
                WHERE id IN :ids
                """
            )
            .bindparams(
                bindparam("ids", expanding=True)
            )
        )

        with database_transaction(
            DATABASE_ID,
            "superadmin",
        ) as connection:
            connection.execute(
                statement,
                {"ids": transaction_ids},
            )

    if client_ids:
        delete_outreach = (
            text(
                """
                DELETE FROM outreach_logs
                WHERE client_id IN :ids
                """
            )
            .bindparams(
                bindparam("ids", expanding=True)
            )
        )

        delete_clients = (
            text(
                """
                DELETE FROM clients
                WHERE id IN :ids
                """
            )
            .bindparams(
                bindparam("ids", expanding=True)
            )
        )

        with database_transaction(
            DATABASE_ID,
            "superadmin",
        ) as connection:
            connection.execute(
                delete_outreach,
                {"ids": client_ids},
            )
            connection.execute(
                delete_clients,
                {"ids": client_ids},
            )


def print_results():
    print()
    print(
        f"{'Test':<42} "
        f"{'Expected':<15} "
        f"{'Actual':<15} Pass"
    )
    print("-" * 84)

    for item in results:
        print(
            f"{item['name']:<42} "
            f"{str(item['expected']):<15} "
            f"{str(item['actual']):<15} "
            f"{item['pass']}"
        )

        if not item["pass"]:
            print(f"  Detail: {item['detail']}")

    passed = sum(item["pass"] for item in results)

    print()
    print(f"Result: {passed}/{len(results)} PASS")


def main():
    settings = get_settings()
    today = datetime.now(WITA).date()
    today_text = today.isoformat()

    contacted_at = datetime.combine(
        today,
        time(hour=9),
    ).replace(
        tzinfo=WITA,
    ).isoformat()

    follow_up_at = datetime.combine(
        today,
        time(hour=10),
    ).replace(
        tzinfo=WITA,
    ).isoformat()

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

            skills_response = client.get(
                "/skills",
                params={"role": "superadmin"},
            )

            skill_names = (
                {
                    item["name"]
                    for item in skills_response.json()[
                        "skills"
                    ]
                }
                if skills_response.status_code == 200
                else set()
            )

            add_result(
                "Summary skill registered",
                True,
                (
                    "get_daily_business_summary"
                    in skill_names
                ),
                skills_response.text,
            )

            wrong_role = execute(
                client,
                "get_daily_business_summary",
                {
                    "database_id": DATABASE_ID,
                    "summary_date": today_text,
                },
                role="user",
            )

            add_result(
                "Summary wrong role",
                403,
                wrong_role.status_code,
                wrong_role.text,
            )

            invalid_date = execute(
                client,
                "get_daily_business_summary",
                {
                    "database_id": DATABASE_ID,
                    "summary_date": "17-09-2026",
                },
            )

            add_result(
                "Summary invalid date",
                422,
                invalid_date.status_code,
                invalid_date.text,
            )

            forbidden_parameter = execute(
                client,
                "get_daily_business_summary",
                {
                    "database_id": DATABASE_ID,
                    "summary_date": today_text,
                    "raw_sql": "SELECT * FROM clients",
                },
            )

            add_result(
                "Summary forbidden parameter",
                422,
                forbidden_parameter.status_code,
                forbidden_parameter.text,
            )

            baseline = require_200(
                "Baseline summary",
                execute(
                    client,
                    "get_daily_business_summary",
                    {
                        "database_id": DATABASE_ID,
                        "summary_date": today_text,
                    },
                ),
            )

            create_result = require_200(
                "Create disposable client",
                execute(
                    client,
                    "create_client",
                    {
                        "database_id": DATABASE_ID,
                        "client_code":
                            f"SUMMARY-{unique}",
                        "name":
                            "Daily Summary Test Client",
                        "business_type": "test",
                        "city": "Makassar",
                        "source":
                            "manual_summary_test",
                        "status": "prospect",
                        "notes":
                            "Disposable summary test",
                    },
                ),
            )

            client_id = create_result["client"]["id"]
            client_ids.append(client_id)

            outreach_result = require_200(
                "Record disposable outreach",
                execute(
                    client,
                    "record_outreach",
                    {
                        "database_id": DATABASE_ID,
                        "client_id": client_id,
                        "channel": "whatsapp",
                        "direction": "outbound",
                        "message_summary":
                            "Daily summary test",
                        "outcome": "no_response",
                        "contacted_at": contacted_at,
                        "follow_up_at": follow_up_at,
                    },
                ),
            )

            add_result(
                "Outreach changes status",
                "follow_up",
                outreach_result["client"][
                    "current_status"
                ],
            )

            income_result = require_200(
                "Record disposable income",
                execute(
                    client,
                    "record_income",
                    {
                        "database_id": DATABASE_ID,
                        "category_code":
                            "service_income",
                        "amount": "123456.00",
                        "description":
                            "Daily summary test income",
                        "transaction_date": today_text,
                        "client_id": client_id,
                    },
                    actor_id=ACTOR_ID,
                ),
            )

            transaction_ids.append(
                income_result["transaction"]["id"]
            )

            expense_result = require_200(
                "Record disposable expense",
                execute(
                    client,
                    "record_expense",
                    {
                        "database_id": DATABASE_ID,
                        "category_code": "internet",
                        "amount": "23456.00",
                        "description":
                            "Daily summary test expense",
                        "transaction_date": today_text,
                    },
                    actor_id=ACTOR_ID,
                ),
            )

            transaction_ids.append(
                expense_result["transaction"]["id"]
            )

            summary = require_200(
                "Final daily summary",
                execute(
                    client,
                    "get_daily_business_summary",
                    {
                        "database_id": DATABASE_ID,
                        "summary_date": today_text,
                    },
                ),
            )

            add_result(
                "Summary date",
                today_text,
                str(summary["summary_date"]),
            )

            add_result(
                "Total clients increased",
                int_value(
                    baseline["clients"]["total_clients"]
                ) + 1,
                int_value(
                    summary["clients"]["total_clients"]
                ),
            )

            add_result(
                "New clients increased",
                int_value(
                    baseline["clients"]["new_clients"]
                ) + 1,
                int_value(
                    summary["clients"]["new_clients"]
                ),
            )

            add_result(
                "Outreach count increased",
                int_value(
                    baseline["outreach"]["outreach_count"]
                ) + 1,
                int_value(
                    summary["outreach"]["outreach_count"]
                ),
            )

            baseline_finance = baseline["finance"]
            final_finance = summary["finance"]

            add_result(
                "Income increased",
                Decimal("123456.00"),
                (
                    decimal_value(
                        final_finance["total_income"]
                    )
                    - decimal_value(
                        baseline_finance["total_income"]
                    )
                ),
            )

            add_result(
                "Expense increased",
                Decimal("23456.00"),
                (
                    decimal_value(
                        final_finance["total_expense"]
                    )
                    - decimal_value(
                        baseline_finance["total_expense"]
                    )
                ),
            )

            add_result(
                "Net cashflow increased",
                Decimal("100000.00"),
                (
                    decimal_value(
                        final_finance["net_cashflow"]
                    )
                    - decimal_value(
                        baseline_finance["net_cashflow"]
                    )
                ),
            )

            add_result(
                "Transaction count increased",
                int_value(
                    baseline_finance["transaction_count"]
                ) + 2,
                int_value(
                    final_finance["transaction_count"]
                ),
            )

            followup_client_ids = {
                item["client_id"]
                for item in summary["outreach"][
                    "followups_due"
                ]
            }

            add_result(
                "Disposable follow-up listed",
                True,
                client_id in followup_client_ids,
            )

            action_types = {
                item["type"]
                for item in summary["action_items"]
            }

            add_result(
                "Follow-up action generated",
                True,
                "followups_due" in action_types,
            )

    finally:
        try:
            cleanup()

            add_result(
                "Cleanup disposable records",
                True,
                True,
            )
        except Exception as error:
            add_result(
                "Cleanup disposable records",
                True,
                False,
                repr(error),
            )

        print_results()


if __name__ == "__main__":
    main()