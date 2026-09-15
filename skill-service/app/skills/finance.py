from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal
from uuid import uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import text
import hashlib
import hmac
import json
import re
import secrets
from app.database.connection import (
    database_connection,
    database_transaction,
)
from app.database.registry import get_database_config
from app.database.tables import get_table_definition
from app.skills.clients import ClientNotFoundError


WITA = timezone(timedelta(hours=8))
FINANCE_CONFIRMATION_MINUTES = 10

def current_wita_date() -> date:
    return datetime.now(WITA).date()


class FinanceCategoryNotFoundError(Exception):
    pass


class FinanceCategoryTypeMismatchError(Exception):
    pass

class FinanceTransactionNotFoundError(Exception):
    pass


class FinanceTransactionAlreadyVoidError(Exception):
    pass


class FinanceVoidConfirmationError(Exception):
    pass

class FinanceDatabaseParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    database_id: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )


class ListFinanceCategoriesParameters(
    FinanceDatabaseParameters
):
    transaction_type: Literal[
        "income",
        "expense",
    ] | None = None


class RecordFinanceTransactionParameters(
    FinanceDatabaseParameters
):
    category_code: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    amount: Decimal = Field(
        gt=0,
        max_digits=15,
        decimal_places=2,
    )
    description: str = Field(
        min_length=1,
        max_length=255,
    )
    transaction_date: date = Field(
        default_factory=current_wita_date
    )
    client_id: int | None = Field(
        default=None,
        ge=1,
    )
    counterparty: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )
    payment_method: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
        pattern=r"^[a-z][a-z0-9_-]*$",
    )
    reference_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    notes: str | None = Field(default=None)

    @field_validator(
        "category_code",
        "description",
        "counterparty",
        "payment_method",
        "reference_number",
        "notes",
        mode="before",
    )
    @classmethod
    def normalize_text(
        cls,
        value: Any,
    ) -> Any:
        if value is None:
            return None

        if not isinstance(value, str):
            return value

        normalized = value.strip()

        if not normalized:
            return None

        return normalized


class ListFinanceTransactionsParameters(
    FinanceDatabaseParameters
):
    transaction_type: Literal[
        "income",
        "expense",
    ] | None = None
    category_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    client_id: int | None = Field(
        default=None,
        ge=1,
    )
    status: Literal[
        "posted",
        "void",
    ] | None = None
    start_date: date | None = None
    end_date: date | None = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(
        default=0,
        ge=0,
        le=100_000,
    )

    @model_validator(mode="after")
    def validate_period(self):
        if (
            self.start_date
            and self.end_date
            and self.end_date < self.start_date
        ):
            raise ValueError(
                "end_date tidak boleh sebelum start_date"
            )

        return self


class GetFinanceSummaryParameters(
    FinanceDatabaseParameters
):
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_period(self):
        if (
            self.start_date
            and self.end_date
            and self.end_date < self.start_date
        ):
            raise ValueError(
                "end_date tidak boleh sebelum start_date"
            )

        return self


class GetFinanceTransactionParameters(
    FinanceDatabaseParameters
):
    transaction_id: int = Field(ge=1)


class PreviewVoidFinanceTransactionParameters(
    FinanceDatabaseParameters
):
    transaction_id: int = Field(ge=1)
    reason: str = Field(
        min_length=5,
        max_length=255,
    )

    @field_validator("reason")
    @classmethod
    def normalize_reason(
        cls,
        value: str,
    ) -> str:
        normalized = value.strip()

        if len(normalized) < 5:
            raise ValueError(
                "Alasan void terlalu pendek"
            )

        return normalized


class ConfirmVoidFinanceTransactionParameters(
    FinanceDatabaseParameters
):
    action_id: str = Field(
        pattern=(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-"
            r"[0-9a-f]{4}-[0-9a-f]{4}-"
            r"[0-9a-f]{12}$"
        ),
    )
    confirmation_token: str = Field(
        min_length=32,
        max_length=100,
    )


def list_finance_categories(
    role: str,
    database_id: str,
    transaction_type: str | None,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    table = get_table_definition(
        database_id,
        "finance_categories",
        role,
    )

    conditions = ["`is_active` = TRUE"]
    parameters: dict[str, Any] = {}

    if transaction_type:
        conditions.append(
            "`transaction_type` = :transaction_type"
        )
        parameters["transaction_type"] = (
            transaction_type
        )

    statement = text(
        f"""
        SELECT
            `id`,
            `category_code`,
            `name`,
            `transaction_type`,
            `is_active`
        FROM `{table.physical_name}`
        WHERE {" AND ".join(conditions)}
        ORDER BY
            `transaction_type`,
            `name`
        """
    )

    with database_connection(
        database_id,
        role,
    ) as connection:
        rows = connection.execute(
            statement,
            parameters,
        ).mappings().all()

    return {
        "database_id": database_id,
        "transaction_type": transaction_type,
        "categories": [
            dict(row)
            for row in rows
        ],
        "count": len(rows),
    }


def record_finance_transaction(
    role: str,
    actor_id: str,
    database_id: str,
    transaction_type: str,
    category_code: str,
    amount: Decimal,
    description: str,
    transaction_date: date,
    client_id: int | None,
    counterparty: str | None,
    payment_method: str | None,
    reference_number: str | None,
    notes: str | None,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    transaction_table = get_table_definition(
        database_id,
        "finance_transactions",
        role,
    )
    category_table = get_table_definition(
        database_id,
        "finance_categories",
        role,
    )
    client_table = get_table_definition(
        database_id,
        "clients",
        role,
    )

    transaction_code = (
        "FIN-"
        + transaction_date.strftime("%Y%m%d")
        + "-"
        + uuid4().hex[:12].upper()
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        category = connection.execute(
            text(
                f"""
                SELECT
                    `id`,
                    `category_code`,
                    `name`,
                    `transaction_type`
                FROM `{category_table.physical_name}`
                WHERE `category_code` = :category_code
                  AND `is_active` = TRUE
                LIMIT 1
                """
            ),
            {
                "category_code": category_code,
            },
        ).mappings().first()

        if category is None:
            raise FinanceCategoryNotFoundError

        if (
            category["transaction_type"]
            != transaction_type
        ):
            raise FinanceCategoryTypeMismatchError

        client = None

        if client_id is not None:
            client = connection.execute(
                text(
                    f"""
                    SELECT
                        `id`,
                        `client_code`,
                        `name`
                    FROM `{client_table.physical_name}`
                    WHERE `id` = :client_id
                    LIMIT 1
                    """
                ),
                {
                    "client_id": client_id,
                },
            ).mappings().first()

            if client is None:
                raise ClientNotFoundError

        connection.execute(
            text(
                f"""
                INSERT INTO `{
                    transaction_table.physical_name
                }` (
                    `transaction_code`,
                    `transaction_type`,
                    `category_id`,
                    `client_id`,
                    `counterparty`,
                    `description`,
                    `amount`,
                    `currency`,
                    `transaction_date`,
                    `payment_method`,
                    `reference_number`,
                    `status`,
                    `notes`,
                    `created_by`
                )
                VALUES (
                    :transaction_code,
                    :transaction_type,
                    :category_id,
                    :client_id,
                    :counterparty,
                    :description,
                    :amount,
                    'IDR',
                    :transaction_date,
                    :payment_method,
                    :reference_number,
                    'posted',
                    :notes,
                    :created_by
                )
                """
            ),
            {
                "transaction_code":
                    transaction_code,
                "transaction_type":
                    transaction_type,
                "category_id": category["id"],
                "client_id": client_id,
                "counterparty": counterparty,
                "description": description,
                "amount": amount,
                "transaction_date":
                    transaction_date,
                "payment_method":
                    payment_method,
                "reference_number":
                    reference_number,
                "notes": notes,
                "created_by": actor_id,
            },
        )

        transaction = connection.execute(
            text(
                f"""
                SELECT
                    transaction.`id`,
                    transaction.`transaction_code`,
                    transaction.`transaction_type`,
                    category.`category_code`,
                    category.`name` AS `category_name`,
                    transaction.`client_id`,
                    transaction.`counterparty`,
                    transaction.`description`,
                    transaction.`amount`,
                    transaction.`currency`,
                    transaction.`transaction_date`,
                    transaction.`payment_method`,
                    transaction.`reference_number`,
                    transaction.`status`,
                    transaction.`notes`,
                    transaction.`created_at`,
                    transaction.`updated_at`
                FROM `{
                    transaction_table.physical_name
                }` AS transaction
                INNER JOIN `{
                    category_table.physical_name
                }` AS category
                    ON category.`id`
                        = transaction.`category_id`
                WHERE transaction.`transaction_code`
                    = :transaction_code
                LIMIT 1
                """
            ),
            {
                "transaction_code":
                    transaction_code,
            },
        ).mappings().first()

    return {
        "database_id": database_id,
        "transaction": dict(transaction),
        "client": (
            dict(client)
            if client is not None
            else None
        ),
        "created": True,
    }


def record_income(
    role: str,
    actor_id: str,
    **parameters,
) -> dict[str, Any]:
    return record_finance_transaction(
        role=role,
        actor_id=actor_id,
        transaction_type="income",
        **parameters,
    )


def record_expense(
    role: str,
    actor_id: str,
    **parameters,
) -> dict[str, Any]:
    return record_finance_transaction(
        role=role,
        actor_id=actor_id,
        transaction_type="expense",
        **parameters,
    )


def list_finance_transactions(
    role: str,
    database_id: str,
    transaction_type: str | None,
    category_code: str | None,
    client_id: int | None,
    status: str | None,
    start_date: date | None,
    end_date: date | None,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    transaction_table = get_table_definition(
        database_id,
        "finance_transactions",
        role,
    )
    category_table = get_table_definition(
        database_id,
        "finance_categories",
        role,
    )

    conditions: list[str] = []
    parameters: dict[str, Any] = {
        "limit": limit,
        "offset": offset,
    }

    if transaction_type:
        conditions.append(
            "transaction.`transaction_type` "
            "= :transaction_type"
        )
        parameters["transaction_type"] = (
            transaction_type
        )

    if category_code:
        conditions.append(
            "category.`category_code` "
            "= :category_code"
        )
        parameters["category_code"] = category_code

    if client_id is not None:
        conditions.append(
            "transaction.`client_id` = :client_id"
        )
        parameters["client_id"] = client_id

    if status:
        conditions.append(
            "transaction.`status` = :status"
        )
        parameters["status"] = status

    if start_date:
        conditions.append(
            "transaction.`transaction_date` "
            ">= :start_date"
        )
        parameters["start_date"] = start_date

    if end_date:
        conditions.append(
            "transaction.`transaction_date` "
            "<= :end_date"
        )
        parameters["end_date"] = end_date

    where_clause = (
        "WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    statement = text(
        f"""
        SELECT
            transaction.`id`,
            transaction.`transaction_code`,
            transaction.`transaction_type`,
            category.`category_code`,
            category.`name` AS `category_name`,
            transaction.`client_id`,
            transaction.`counterparty`,
            transaction.`description`,
            transaction.`amount`,
            transaction.`currency`,
            transaction.`transaction_date`,
            transaction.`payment_method`,
            transaction.`reference_number`,
            transaction.`status`,
            transaction.`notes`,
            transaction.`created_at`,
            transaction.`updated_at`
        FROM `{
            transaction_table.physical_name
        }` AS transaction
        INNER JOIN `{
            category_table.physical_name
        }` AS category
            ON category.`id`
                = transaction.`category_id`
        {where_clause}
        ORDER BY
            transaction.`transaction_date` DESC,
            transaction.`id` DESC
        LIMIT :limit
        OFFSET :offset
        """
    )

    with database_connection(
        database_id,
        role,
    ) as connection:
        rows = connection.execute(
            statement,
            parameters,
        ).mappings().all()

    return {
        "database_id": database_id,
        "transactions": [
            dict(row)
            for row in rows
        ],
        "count": len(rows),
        "filters": {
            "transaction_type":
                transaction_type,
            "category_code": category_code,
            "client_id": client_id,
            "status": status,
            "start_date": start_date,
            "end_date": end_date,
        },
        "limit": limit,
        "offset": offset,
    }


def get_finance_summary(
    role: str,
    database_id: str,
    start_date: date | None,
    end_date: date | None,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    transaction_table = get_table_definition(
        database_id,
        "finance_transactions",
        role,
    )
    category_table = get_table_definition(
        database_id,
        "finance_categories",
        role,
    )

    conditions = [
        "transaction.`status` = 'posted'"
    ]
    parameters: dict[str, Any] = {}

    if start_date:
        conditions.append(
            "transaction.`transaction_date` "
            ">= :start_date"
        )
        parameters["start_date"] = start_date

    if end_date:
        conditions.append(
            "transaction.`transaction_date` "
            "<= :end_date"
        )
        parameters["end_date"] = end_date

    where_clause = (
        "WHERE " + " AND ".join(conditions)
    )

    summary_statement = text(
        f"""
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN `transaction_type`
                            = 'income'
                        THEN `amount`
                        ELSE 0
                    END
                ),
                0
            ) AS `total_income`,
            COALESCE(
                SUM(
                    CASE
                        WHEN `transaction_type`
                            = 'expense'
                        THEN `amount`
                        ELSE 0
                    END
                ),
                0
            ) AS `total_expense`,
            COUNT(*) AS `transaction_count`
        FROM `{transaction_table.physical_name}`
        AS transaction
        {where_clause}
        """
    )

    category_statement = text(
        f"""
        SELECT
            transaction.`transaction_type`,
            category.`category_code`,
            category.`name` AS `category_name`,
            SUM(transaction.`amount`) AS `total`,
            COUNT(*) AS `transaction_count`
        FROM `{
            transaction_table.physical_name
        }` AS transaction
        INNER JOIN `{
            category_table.physical_name
        }` AS category
            ON category.`id`
                = transaction.`category_id`
        {where_clause}
        GROUP BY
            transaction.`transaction_type`,
            category.`category_code`,
            category.`name`
        ORDER BY
            transaction.`transaction_type`,
            `total` DESC
        """
    )

    with database_connection(
        database_id,
        role,
    ) as connection:
        summary = connection.execute(
            summary_statement,
            parameters,
        ).mappings().one()

        category_rows = connection.execute(
            category_statement,
            parameters,
        ).mappings().all()

    total_income = Decimal(
        summary["total_income"]
    )
    total_expense = Decimal(
        summary["total_expense"]
    )

    return {
        "database_id": database_id,
        "currency": "IDR",
        "period": {
            "start_date": start_date,
            "end_date": end_date,
        },
        "total_income": total_income,
        "total_expense": total_expense,
        "net_cashflow":
            total_income - total_expense,
        "transaction_count":
            summary["transaction_count"],
        "category_breakdown": [
            dict(row)
            for row in category_rows
        ],
    }
    
def get_finance_transaction(
    role: str,
    database_id: str,
    transaction_id: int,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    transaction_table = get_table_definition(
        database_id,
        "finance_transactions",
        role,
    )
    category_table = get_table_definition(
        database_id,
        "finance_categories",
        role,
    )

    statement = text(
        f"""
        SELECT
            transaction.`id`,
            transaction.`transaction_code`,
            transaction.`transaction_type`,
            category.`category_code`,
            category.`name` AS `category_name`,
            transaction.`client_id`,
            transaction.`counterparty`,
            transaction.`description`,
            transaction.`amount`,
            transaction.`currency`,
            transaction.`transaction_date`,
            transaction.`payment_method`,
            transaction.`reference_number`,
            transaction.`status`,
            transaction.`void_reason`,
            transaction.`voided_at`,
            transaction.`notes`,
            transaction.`created_at`,
            transaction.`updated_at`
        FROM `{transaction_table.physical_name}`
            AS transaction
        INNER JOIN `{category_table.physical_name}`
            AS category
            ON category.`id`
                = transaction.`category_id`
        WHERE transaction.`id` = :transaction_id
        LIMIT 1
        """
    )

    with database_connection(
        database_id,
        role,
    ) as connection:
        transaction = connection.execute(
            statement,
            {
                "transaction_id": transaction_id,
            },
        ).mappings().first()

    if transaction is None:
        raise FinanceTransactionNotFoundError

    return {
        "database_id": database_id,
        "transaction": dict(transaction),
    }
    
def preview_void_finance_transaction(
    role: str,
    actor_id: str,
    database_id: str,
    transaction_id: int,
    reason: str,
) -> dict[str, Any]:
    if role != "superadmin":
        raise PermissionError

    if not re.fullmatch(
        r"^[a-f0-9]{64}$",
        actor_id,
    ):
        raise PermissionError

    get_database_config(database_id, role)

    transaction_table = get_table_definition(
        database_id,
        "finance_transactions",
        role,
    )
    category_table = get_table_definition(
        database_id,
        "finance_categories",
        role,
    )
    pending_table = get_table_definition(
        database_id,
        "pending_actions",
        role,
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        transaction = connection.execute(
            text(
                f"""
                SELECT
                    transaction.`id`,
                    transaction.`transaction_code`,
                    transaction.`transaction_type`,
                    category.`category_code`,
                    category.`name`
                        AS `category_name`,
                    transaction.`counterparty`,
                    transaction.`description`,
                    transaction.`amount`,
                    transaction.`currency`,
                    transaction.`transaction_date`,
                    transaction.`status`
                FROM `{
                    transaction_table.physical_name
                }` AS transaction
                INNER JOIN `{
                    category_table.physical_name
                }` AS category
                    ON category.`id`
                        = transaction.`category_id`
                WHERE transaction.`id`
                    = :transaction_id
                LIMIT 1
                """
            ),
            {
                "transaction_id": transaction_id,
            },
        ).mappings().first()

        if transaction is None:
            raise FinanceTransactionNotFoundError

        if transaction["status"] == "void":
            raise FinanceTransactionAlreadyVoidError

        action_id = str(uuid4())
        confirmation_token = secrets.token_urlsafe(32)

        confirmation_token_hash = hashlib.sha256(
            confirmation_token.encode("utf-8")
        ).hexdigest()

        now = datetime.now(timezone.utc).replace(
            tzinfo=None
        )
        expires_at = now + timedelta(
            minutes=FINANCE_CONFIRMATION_MINUTES
        )

        payload = {
            "transaction_id": transaction_id,
            "transaction_code":
                transaction["transaction_code"],
            "reason": reason,
        }

        connection.execute(
            text(
                f"""
                INSERT INTO `{
                    pending_table.physical_name
                }` (
                    `action_id`,
                    `requested_by`,
                    `action_type`,
                    `database_id`,
                    `resource_id`,
                    `payload_json`,
                    `confirmation_token_hash`,
                    `status`,
                    `expires_at`
                )
                VALUES (
                    :action_id,
                    :requested_by,
                    'void_finance_transaction',
                    :database_id,
                    :resource_id,
                    :payload_json,
                    :confirmation_token_hash,
                    'pending',
                    :expires_at
                )
                """
            ),
            {
                "action_id": action_id,
                "requested_by": actor_id,
                "database_id": database_id,
                "resource_id":
                    str(transaction_id),
                "payload_json":
                    json.dumps(payload),
                "confirmation_token_hash":
                    confirmation_token_hash,
                "expires_at": expires_at,
            },
        )

    return {
        "database_id": database_id,
        "transaction": dict(transaction),
        "reason": reason,
        "action_id": action_id,
        "confirmation_token":
            confirmation_token,
        "expires_at": expires_at.isoformat(),
    }
    
def confirm_void_finance_transaction(
    role: str,
    actor_id: str,
    database_id: str,
    action_id: str,
    confirmation_token: str,
) -> dict[str, Any]:
    if role != "superadmin":
        raise PermissionError

    if not re.fullmatch(
        r"^[a-f0-9]{64}$",
        actor_id,
    ):
        raise PermissionError

    get_database_config(database_id, role)

    transaction_table = get_table_definition(
        database_id,
        "finance_transactions",
        role,
    )
    pending_table = get_table_definition(
        database_id,
        "pending_actions",
        role,
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        pending = connection.execute(
            text(
                f"""
                SELECT
                    `id`,
                    `requested_by`,
                    `payload_json`,
                    `confirmation_token_hash`,
                    `status`,
                    `expires_at`
                FROM `{pending_table.physical_name}`
                WHERE `action_id` = :action_id
                  AND `action_type`
                    = 'void_finance_transaction'
                  AND `database_id` = :database_id
                LIMIT 1
                FOR UPDATE
                """
            ),
            {
                "action_id": action_id,
                "database_id": database_id,
            },
        ).mappings().first()

        now = datetime.now(timezone.utc).replace(
            tzinfo=None
        )

        if (
            pending is None
            or pending["requested_by"] != actor_id
            or pending["status"] != "pending"
            or pending["expires_at"] <= now
        ):
            raise FinanceVoidConfirmationError

        supplied_hash = hashlib.sha256(
            confirmation_token.encode("utf-8")
        ).hexdigest()

        if not hmac.compare_digest(
            supplied_hash,
            pending["confirmation_token_hash"],
        ):
            raise FinanceVoidConfirmationError

        payload = json.loads(
            pending["payload_json"]
        )

        transaction = connection.execute(
            text(
                f"""
                SELECT
                    `id`,
                    `transaction_code`,
                    `transaction_type`,
                    `description`,
                    `amount`,
                    `currency`,
                    `status`
                FROM `{
                    transaction_table.physical_name
                }`
                WHERE `id` = :transaction_id
                LIMIT 1
                FOR UPDATE
                """
            ),
            {
                "transaction_id":
                    payload["transaction_id"],
            },
        ).mappings().first()

        if transaction is None:
            raise FinanceTransactionNotFoundError

        if transaction["status"] == "void":
            raise FinanceTransactionAlreadyVoidError

        connection.execute(
            text(
                f"""
                UPDATE `{
                    transaction_table.physical_name
                }`
                SET
                    `status` = 'void',
                    `void_reason` = :void_reason,
                    `voided_at` = :voided_at,
                    `voided_by` = :voided_by,
                    `updated_by` = :updated_by
                WHERE `id` = :transaction_id
                  AND `status` = 'posted'
                """
            ),
            {
                "void_reason":
                    payload["reason"],
                "voided_at": now,
                "voided_by": actor_id,
                "updated_by": actor_id,
                "transaction_id":
                    transaction["id"],
            },
        )

        connection.execute(
            text(
                f"""
                UPDATE `{pending_table.physical_name}`
                SET
                    `status` = 'confirmed',
                    `confirmed_at` = :confirmed_at
                WHERE `id` = :pending_id
                """
            ),
            {
                "confirmed_at": now,
                "pending_id": pending["id"],
            },
        )

    return {
        "database_id": database_id,
        "transaction": {
            **dict(transaction),
            "status": "void",
            "void_reason": payload["reason"],
            "voided_at": now,
        },
        "voided": True,
    }
    
