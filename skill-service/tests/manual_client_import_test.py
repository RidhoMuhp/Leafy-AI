from datetime import datetime
from io import BytesIO

import httpx
from openpyxl import Workbook

from app.config import get_settings


BASE_URL = "http://127.0.0.1:8000"
ACTOR_ID = "a" * 64
OTHER_ACTOR_ID = "b" * 64

settings = get_settings()

headers = {
    "x-leafy-internal-key":
        settings.leafy_internal_key,
}

timestamp = datetime.now().strftime(
    "%Y%m%d%H%M%S"
)

csv_codes = [
    f"IMPORT-{timestamp}-001",
    f"IMPORT-{timestamp}-002",
]

xlsx_code = f"IMPORT-{timestamp}-003"

results: list[dict] = []


def record_test(
    name: str,
    expected: int,
    response: httpx.Response,
    condition: bool = True,
):
    actual = response.status_code
    passed = actual == expected and condition

    try:
        detail = response.json()
    except Exception:
        detail = response.text

    results.append(
        {
            "test": name,
            "expected": expected,
            "actual": actual,
            "pass": passed,
            "detail": str(detail)[:120],
        }
    )

    return passed


def preview_file(
    client: httpx.Client,
    file_name: str,
    content: bytes,
    mime_type: str,
    role: str = "superadmin",
    actor_id: str = ACTOR_ID,
):
    return client.post(
        "/imports/clients/preview",
        headers=headers,
        data={
            "role": role,
            "actor_id": actor_id,
            "database_id": "leafy_core",
        },
        files={
            "file": (
                file_name,
                content,
                mime_type,
            ),
        },
    )


def execute_skill(
    client: httpx.Client,
    skill: str,
    parameters: dict,
    role: str = "superadmin",
    actor_id: str = ACTOR_ID,
):
    return client.post(
        "/execute",
        headers=headers,
        json={
            "skill": skill,
            "role": role,
            "actor_id": actor_id,
            "parameters": parameters,
        },
    )


def make_csv() -> bytes:
    content = (
        "client_code,name,business_type,"
        "phone,email,city,source,status,notes\n"
        f"{csv_codes[0]},Beta Rental Import,"
        "rental_car,081234567890,"
        "beta-rental@example.invalid,"
        "Makassar,whatsapp_import,lead,"
        "Data pengujian impor CSV\n"
        f"{csv_codes[1]},Beta Klinik Import,"
        "clinic,,beta-klinik@example.invalid,"
        "Gowa,whatsapp_import,prospect,"
        "Data pengujian impor CSV\n"
        f"{csv_codes[1]},Duplicate In File,"
        "clinic,,,Gowa,whatsapp_import,"
        "prospect,Duplikat dalam file\n"
        "INVALID CODE!,Invalid Client,"
        "other,,,Makassar,whatsapp_import,"
        "prospect,Harus ditolak\n"
    )

    return content.encode("utf-8")


def make_xlsx() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "clients"

    sheet.append(
        [
            "client_code",
            "name",
            "business_type",
            "phone",
            "email",
            "city",
            "source",
            "status",
            "notes",
        ]
    )

    sheet.append(
        [
            xlsx_code,
            "Beta Course Import",
            "course",
            "081298765432",
            "beta-course@example.invalid",
            "Makassar",
            "whatsapp_import",
            "lead",
            "Data pengujian impor XLSX",
        ]
    )

    output = BytesIO()
    workbook.save(output)
    workbook.close()

    return output.getvalue()


def print_results():
    print()
    print(
        f"{'Test':38} "
        f"{'Expected':8} "
        f"{'Actual':6} "
        f"{'Pass':5}"
    )
    print("-" * 65)

    for item in results:
        print(
            f"{item['test'][:38]:38} "
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


def main():
    csv_content = make_csv()
    xlsx_content = make_xlsx()

    with httpx.Client(
        base_url=BASE_URL,
        timeout=30,
    ) as client:
        health = client.get("/health")

        if not record_test(
            "Health",
            200,
            health,
        ):
            print_results()

        invalid_header = preview_file(
            client,
            "invalid.csv",
            b"wrong_column,name\nX,Invalid\n",
            "text/csv",
        )

        record_test(
            "Invalid CSV header",
            422,
            invalid_header,
        )

        unsupported = preview_file(
            client,
            "clients.txt",
            b"client_code,name\nX,Invalid\n",
            "text/plain",
        )

        record_test(
            "Unsupported extension",
            422,
            unsupported,
        )

        wrong_role = preview_file(
            client,
            "clients.csv",
            csv_content,
            "text/csv",
            role="admin",
        )

        record_test(
            "Preview wrong role",
            403,
            wrong_role,
        )

        csv_preview = preview_file(
            client,
            "clients.csv",
            csv_content,
            "text/csv",
        )

        csv_preview_ok = False
        csv_result = None

        if csv_preview.status_code == 200:
            csv_result = csv_preview.json()[
                "result"
            ]
            summary = csv_result["summary"]

            csv_preview_ok = (
                summary["total_rows"] == 4
                and summary["new_rows"] == 2
                and summary[
                    "duplicate_file_rows"
                ] == 1
                and summary[
                    "invalid_rows"
                ] == 1
                and bool(
                    csv_result["action_id"]
                )
                and bool(
                    csv_result[
                        "confirmation_token"
                    ]
                )
            )

        record_test(
            "CSV preview valid",
            200,
            csv_preview,
            csv_preview_ok,
        )

        xlsx_preview = preview_file(
            client,
            "clients.xlsx",
            xlsx_content,
            (
                "application/vnd.openxmlformats-"
                "officedocument.spreadsheetml.sheet"
            ),
        )

        xlsx_preview_ok = False
        xlsx_result = None

        if xlsx_preview.status_code == 200:
            xlsx_result = xlsx_preview.json()[
                "result"
            ]
            summary = xlsx_result["summary"]

            xlsx_preview_ok = (
                summary["total_rows"] == 1
                and summary["new_rows"] == 1
                and summary["invalid_rows"] == 0
                and bool(
                    xlsx_result["action_id"]
                )
            )

        record_test(
            "XLSX preview valid",
            200,
            xlsx_preview,
            xlsx_preview_ok,
        )

        if csv_result:
            confirmation_parameters = {
                "database_id": "leafy_core",
                "action_id":
                    csv_result["action_id"],
                "confirmation_token":
                    csv_result[
                        "confirmation_token"
                    ],
            }

            wrong_token = execute_skill(
                client,
                "confirm_client_import",
                {
                    **confirmation_parameters,
                    "confirmation_token":
                        "x" * 43,
                },
            )

            record_test(
                "Wrong confirmation token",
                400,
                wrong_token,
            )

            different_actor = execute_skill(
                client,
                "confirm_client_import",
                confirmation_parameters,
                actor_id=OTHER_ACTOR_ID,
            )

            record_test(
                "Different requester",
                400,
                different_actor,
            )

            confirm_csv = execute_skill(
                client,
                "confirm_client_import",
                confirmation_parameters,
            )

            confirm_csv_ok = False

            if confirm_csv.status_code == 200:
                imported = confirm_csv.json()[
                    "result"
                ]

                confirm_csv_ok = (
                    imported[
                        "imported_count"
                    ] == 2
                    and set(
                        imported[
                            "imported_client_codes"
                        ]
                    ) == set(csv_codes)
                )

            record_test(
                "Confirm CSV import",
                200,
                confirm_csv,
                confirm_csv_ok,
            )

            replay = execute_skill(
                client,
                "confirm_client_import",
                confirmation_parameters,
            )

            record_test(
                "Replay confirmation",
                400,
                replay,
            )

        if xlsx_result:
            confirm_xlsx = execute_skill(
                client,
                "confirm_client_import",
                {
                    "database_id": "leafy_core",
                    "action_id":
                        xlsx_result["action_id"],
                    "confirmation_token":
                        xlsx_result[
                            "confirmation_token"
                        ],
                },
            )

            confirm_xlsx_ok = False

            if confirm_xlsx.status_code == 200:
                imported = confirm_xlsx.json()[
                    "result"
                ]

                confirm_xlsx_ok = (
                    imported[
                        "imported_count"
                    ] == 1
                    and imported[
                        "imported_client_codes"
                    ] == [xlsx_code]
                )

            record_test(
                "Confirm XLSX import",
                200,
                confirm_xlsx,
                confirm_xlsx_ok,
            )

        duplicate_preview = preview_file(
            client,
            "clients.csv",
            csv_content,
            "text/csv",
        )

        duplicate_ok = False

        if duplicate_preview.status_code == 200:
            duplicate_result = (
                duplicate_preview.json()[
                    "result"
                ]
            )
            summary = duplicate_result[
                "summary"
            ]

            duplicate_ok = (
                summary["new_rows"] == 0
                and summary[
                    "existing_rows"
                ] == 2
                and duplicate_result[
                    "action_id"
                ] is None
                and duplicate_result[
                    "confirmation_token"
                ] is None
            )

        record_test(
            "Existing clients detected",
            200,
            duplicate_preview,
            duplicate_ok,
        )

    print_results()

    print()
    print("Imported test client codes:")
    for code in [
        *csv_codes,
        xlsx_code,
    ]:
        print(f"- {code}")


if __name__ == "__main__":
    main()