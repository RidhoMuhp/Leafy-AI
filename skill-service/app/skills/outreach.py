from datetime import (
    date,
    datetime,
    time,
    timedelta,
    timezone,
)
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import text

from app.database.connection import (
    database_connection,
    database_transaction,
)
from app.database.registry import get_database_config
from app.database.tables import get_table_definition
from app.skills.clients import ClientNotFoundError

APP_TIMEZONE = timezone(
    timedelta(hours=8)
)

class OutreachDatabaseParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    database_id: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )


class RecordOutreachParameters(
    OutreachDatabaseParameters
):
    client_id: int = Field(ge=1)
    channel: Literal[
        "whatsapp",
        "phone",
        "email",
        "instagram",
        "linkedin",
        "other",
    ]
    direction: Literal[
        "outbound",
        "inbound",
    ] = "outbound"
    message_summary: str | None = Field(
        default=None,
        min_length=1,
        max_length=2000,
    )
    outcome: Literal[
        "no_response",
        "replied",
        "interested",
        "follow_up",
        "converted",
        "not_interested",
        "invalid_contact",
    ]
    contacted_at: datetime | None = None
    follow_up_at: datetime | None = None

    @field_validator("message_summary")
    @classmethod
    def normalize_summary(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "Ringkasan tidak boleh kosong"
            )

        return normalized

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.follow_up_at is None:
            return self

        contacted_at = (
            self.contacted_at
            or datetime.now(APP_TIMEZONE)
        )

        normalized_contacted = normalize_datetime(
            contacted_at
        )
        normalized_follow_up = normalize_datetime(
            self.follow_up_at
        )

        if normalized_follow_up <= normalized_contacted:
            raise ValueError(
                "Waktu follow-up harus setelah outreach"
            )

        return self


class FindFollowupsParameters(
    OutreachDatabaseParameters
):
    due_date: date | None = None
    city: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    limit: int = Field(default=20, ge=1, le=100)

    @field_validator("city")
    @classmethod
    def normalize_city(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "Kota tidak boleh kosong"
            )

        return normalized


OUTCOME_STATUS_MAP = {
    "replied": "contacted",
    "interested": "qualified",
    "follow_up": "follow_up",
    "converted": "won",
    "not_interested": "lost",
}


CLIENT_STATUS_RANK = {
    "prospect": 0,
    "lead": 1,
    "contacted": 2,
    "follow_up": 3,
    "qualified": 4,
    "won": 5,
}


TERMINAL_CLIENT_STATUSES = {
    "won",
    "lost",
}


def resolve_client_status(
    current_status: str,
    outcome: str,
    has_follow_up: bool,
) -> str:
    if current_status in TERMINAL_CLIENT_STATUSES:
        return current_status

    if outcome == "invalid_contact":
        return current_status

    if outcome == "no_response":
        candidate_status = (
            "follow_up"
            if has_follow_up
            else "contacted"
        )
    else:
        candidate_status = OUTCOME_STATUS_MAP[
            outcome
        ]

    if candidate_status == "lost":
        return "lost"

    current_rank = CLIENT_STATUS_RANK.get(
        current_status,
        0,
    )
    candidate_rank = CLIENT_STATUS_RANK[
        candidate_status
    ]

    if candidate_rank < current_rank:
        return current_status

    return candidate_status


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value

    return value.astimezone(
        APP_TIMEZONE
    ).replace(tzinfo=None)

def record_outreach(
    role: str,
    database_id: str,
    client_id: int,
    channel: str,
    direction: str,
    message_summary: str | None,
    outcome: str,
    contacted_at: datetime | None,
    follow_up_at: datetime | None,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    clients_table = get_table_definition(
        database_id,
        "clients",
        role,
    )
    outreach_table = get_table_definition(
        database_id,
        "outreach_logs",
        role,
    )

    normalized_contacted_at = normalize_datetime(
        contacted_at or datetime.now(APP_TIMEZONE)
    )

    normalized_follow_up_at = (
        normalize_datetime(follow_up_at)
        if follow_up_at is not None
        else None
    )



    client_statement = text(
        f"""
        SELECT
            `id`,
            `client_code`,
            `name`,
            `status`
        FROM `{clients_table.physical_name}`
        WHERE `id` = :client_id
        LIMIT 1
        FOR UPDATE
        """
    )

    insert_statement = text(
        f"""
        INSERT INTO `{outreach_table.physical_name}` (
            `client_id`,
            `channel`,
            `direction`,
            `message_summary`,
            `outcome`,
            `contacted_at`,
            `follow_up_at`
        )
        VALUES (
            :client_id,
            :channel,
            :direction,
            :message_summary,
            :outcome,
            :contacted_at,
            :follow_up_at
        )
        """
    )

    update_client_statement = text(
        f"""
        UPDATE `{clients_table.physical_name}`
        SET `status` = :status
        WHERE `id` = :client_id
        """
    )

    outreach_statement = text(
        f"""
        SELECT
            `id`,
            `client_id`,
            `channel`,
            `direction`,
            `message_summary`,
            `outcome`,
            `contacted_at`,
            `follow_up_at`,
            `created_at`
        FROM `{outreach_table.physical_name}`
        WHERE `id` = :outreach_id
        LIMIT 1
        """
    )

    with database_transaction(
        database_id,
        role,
    ) as connection:
        client = connection.execute(
            client_statement,
            {"client_id": client_id},
        ).mappings().first()

        if client is None:
            raise ClientNotFoundError
        
        new_client_status = resolve_client_status(
            current_status=client["status"],
            outcome=outcome,
            has_follow_up=(
                normalized_follow_up_at is not None
            ),
        )

        status_changed = (
            new_client_status != client["status"]
        )

        insert_result = connection.execute(
            insert_statement,
            {
                "client_id": client_id,
                "channel": channel,
                "direction": direction,
                "message_summary": message_summary,
                "outcome": outcome,
                "contacted_at":
                    normalized_contacted_at,
                "follow_up_at":
                    normalized_follow_up_at,
            },
        )

        outreach_id = insert_result.lastrowid

        if status_changed:
            connection.execute(
                update_client_statement,
                {
                    "client_id": client_id,
                    "status": new_client_status,
                },
            )

        outreach = connection.execute(
            outreach_statement,
            {"outreach_id": outreach_id},
        ).mappings().first()

    return {
        "database_id": database_id,
        "timezone": "WITA",
        "client": {
            "id": client["id"],
            "client_code": client["client_code"],
            "name": client["name"],
            "previous_status": client["status"],
            "current_status": new_client_status,
            "status_changed": status_changed,
            },
        "outreach": dict(outreach),
        "recorded": True,
    }


def find_followups(
    role: str,
    database_id: str,
    due_date: date | None,
    city: str | None,
    limit: int,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    clients_table = get_table_definition(
        database_id,
        "clients",
        role,
    )
    outreach_table = get_table_definition(
        database_id,
        "outreach_logs",
        role,
    )

    selected_date = (
        due_date
        or datetime.now(APP_TIMEZONE).date()
    )

    due_before = datetime.combine(
        selected_date + timedelta(days=1),
        time.min,
    )

    conditions = [
        "`o`.`follow_up_at` IS NOT NULL",
        "`o`.`follow_up_at` < :due_before",
        "`c`.`status` NOT IN ('won', 'lost')",
    ]

    parameters: dict[str, Any] = {
        "due_before": due_before,
        "limit": limit,
    }

    if city is not None:
        conditions.append("`c`.`city` = :city")
        parameters["city"] = city

    where_clause = " AND ".join(conditions)

    statement = text(
        f"""
        SELECT
            `c`.`id` AS `client_id`,
            `c`.`client_code`,
            `c`.`name`,
            `c`.`business_type`,
            `c`.`phone`,
            `c`.`city`,
            `c`.`status`,
            `o`.`id` AS `outreach_id`,
            `o`.`channel`,
            `o`.`outcome`,
            `o`.`message_summary`,
            `o`.`contacted_at`,
            `o`.`follow_up_at`
        FROM `{clients_table.physical_name}` AS `c`
        INNER JOIN `{outreach_table.physical_name}` AS `o`
            ON `o`.`client_id` = `c`.`id`
        INNER JOIN (
            SELECT
                `client_id`,
                MAX(`id`) AS `latest_outreach_id`
            FROM `{outreach_table.physical_name}`
            GROUP BY `client_id`
        ) AS `latest`
            ON `latest`.`latest_outreach_id`
                = `o`.`id`
        WHERE {where_clause}
        ORDER BY
            `o`.`follow_up_at` ASC,
            `c`.`id` ASC
        LIMIT :limit
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
        "timezone": "WITA",
        "due_date": selected_date,
        "followups": [
            dict(row)
            for row in rows
        ],
        "count": len(rows),
        "limit": limit,
    }