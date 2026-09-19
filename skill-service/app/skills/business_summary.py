from datetime import (
    date,
    datetime,
    time,
    timedelta,
    timezone,
)
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from app.database.connection import database_connection
from app.database.registry import get_database_config
from app.database.tables import get_table_definition
from app.skills.finance import get_finance_summary


WITA = timezone(timedelta(hours=8))


def current_wita_date() -> date:
    return datetime.now(WITA).date()


class DailyBusinessSummaryParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    database_id: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    summary_date: date = Field(
        default_factory=current_wita_date,
    )


def get_daily_business_summary(
    role: str,
    database_id: str,
    summary_date: date,
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

    day_start = datetime.combine(
        summary_date,
        time.min,
    )
    next_day = day_start + timedelta(days=1)

    client_summary_statement = text(
        f"""
        SELECT
            COUNT(*) AS total_clients,
            COALESCE(
                SUM(
                    CASE
                        WHEN `created_at` >= :day_start
                         AND `created_at` < :next_day
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS new_clients,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'prospect'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS prospects,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'lead'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS leads,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'contacted'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS contacted,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'follow_up'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS follow_up,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'qualified'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS qualified,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'won'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS won,
            COALESCE(
                SUM(
                    CASE
                        WHEN `status` = 'lost'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS lost
        FROM `{clients_table.physical_name}`
        """
    )

    uncontacted_statement = text(
        f"""
        SELECT COUNT(*) AS client_count
        FROM `{clients_table.physical_name}` AS client
        WHERE client.`status` NOT IN ('won', 'lost')
          AND NOT EXISTS (
              SELECT 1
              FROM `{outreach_table.physical_name}` AS outreach
              WHERE outreach.`client_id` = client.`id`
          )
        """
    )

    outreach_summary_statement = text(
        f"""
        SELECT
            COUNT(*) AS outreach_count,
            COUNT(DISTINCT `client_id`)
                AS contacted_client_count
        FROM `{outreach_table.physical_name}`
        WHERE `contacted_at` >= :day_start
          AND `contacted_at` < :next_day
        """
    )

    outreach_outcome_statement = text(
        f"""
        SELECT
            `outcome`,
            COUNT(*) AS outreach_count
        FROM `{outreach_table.physical_name}`
        WHERE `contacted_at` >= :day_start
          AND `contacted_at` < :next_day
        GROUP BY `outcome`
        ORDER BY outreach_count DESC, `outcome` ASC
        """
    )

    followups_statement = text(
        f"""
        SELECT
            client.`id` AS client_id,
            client.`client_code`,
            client.`name`,
            client.`phone`,
            client.`city`,
            client.`status`,
            outreach.`id` AS outreach_id,
            outreach.`channel`,
            outreach.`outcome`,
            outreach.`message_summary`,
            outreach.`contacted_at`,
            outreach.`follow_up_at`
        FROM `{clients_table.physical_name}` AS client
        INNER JOIN `{outreach_table.physical_name}` AS outreach
            ON outreach.`client_id` = client.`id`
        INNER JOIN (
            SELECT
                `client_id`,
                MAX(`id`) AS latest_outreach_id
            FROM `{outreach_table.physical_name}`
            GROUP BY `client_id`
        ) AS latest
            ON latest.`latest_outreach_id`
                = outreach.`id`
        WHERE outreach.`follow_up_at` IS NOT NULL
          AND outreach.`follow_up_at` < :next_day
          AND client.`status` NOT IN ('won', 'lost')
        ORDER BY
            outreach.`follow_up_at` ASC,
            client.`id` ASC
        LIMIT 20
        """
    )

    parameters = {
        "day_start": day_start,
        "next_day": next_day,
    }

    with database_connection(
        database_id,
        role,
    ) as connection:
        client_summary = connection.execute(
            client_summary_statement,
            parameters,
        ).mappings().one()

        uncontacted_count = connection.execute(
            uncontacted_statement,
        ).scalar_one()

        outreach_summary = connection.execute(
            outreach_summary_statement,
            parameters,
        ).mappings().one()

        outcome_rows = connection.execute(
            outreach_outcome_statement,
            parameters,
        ).mappings().all()

        followup_rows = connection.execute(
            followups_statement,
            parameters,
        ).mappings().all()

    finance = get_finance_summary(
        role=role,
        database_id=database_id,
        start_date=summary_date,
        end_date=summary_date,
    )

    followups_due = [
        dict(row)
        for row in followup_rows
    ]

    action_items: list[dict[str, Any]] = []

    if followups_due:
        action_items.append(
            {
                "type": "followups_due",
                "priority": "high",
                "count": len(followups_due),
                "message": (
                    f"{len(followups_due)} klien "
                    "perlu ditindaklanjuti"
                ),
            }
        )

    if uncontacted_count:
        action_items.append(
            {
                "type": "clients_without_outreach",
                "priority": "medium",
                "count": uncontacted_count,
                "message": (
                    f"{uncontacted_count} klien aktif "
                    "belum memiliki riwayat outreach"
                ),
            }
        )

    if finance["net_cashflow"] < 0:
        action_items.append(
            {
                "type": "negative_cashflow",
                "priority": "high",
                "amount": abs(
                    finance["net_cashflow"]
                ),
                "currency": finance["currency"],
                "message": (
                    "Arus kas bersih hari ini negatif"
                ),
            }
        )

    return {
        "database_id": database_id,
        "timezone": "WITA",
        "summary_date": summary_date,
        "clients": {
            **dict(client_summary),
            "without_outreach": uncontacted_count,
        },
        "outreach": {
            "outreach_count":
                outreach_summary["outreach_count"],
            "contacted_client_count":
                outreach_summary[
                    "contacted_client_count"
                ],
            "outcome_breakdown": [
                dict(row)
                for row in outcome_rows
            ],
            "followups_due_count":
                len(followups_due),
            "followups_due": followups_due,
        },
        "finance": finance,
        "action_items": action_items,
        "action_item_count": len(action_items),
    }