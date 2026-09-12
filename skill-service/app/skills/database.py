from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from app.database.connection import database_connection
from app.database.registry import get_database_config
from app.database.tables import (
    get_table_definition,
    list_allowed_tables,
)



class DatabaseTargetParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    database_id: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )


class ListTablesParameters(DatabaseTargetParameters):
    pass


class TableTargetParameters(DatabaseTargetParameters):
    table_id: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )


class DescribeTableParameters(TableTargetParameters):
    pass


class CountRowsParameters(TableTargetParameters):
    pass


class ReadTableParameters(TableTargetParameters):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100_000)


def list_tables(
    role: str,
    database_id: str,
) -> dict[str, Any]:
    config = get_database_config(database_id, role)

    allowed_tables = list_allowed_tables(
        database_id,
        role,
    )

    physical_to_table_id = {
        definition.physical_name: table_id
        for table_id, definition
        in allowed_tables.items()
    }

    statement = text(
        """
        SELECT TABLE_NAME
        FROM information_schema.tables
        WHERE table_schema = :database_name
          AND table_type = 'BASE TABLE'
        ORDER BY TABLE_NAME
        """
    )

    with database_connection(
        database_id,
        role,
    ) as connection:
        rows = connection.execute(
            statement,
            {
                "database_name":
                    config.database_name,
            },
        ).mappings().all()

    tables = [
        physical_to_table_id[row["TABLE_NAME"]]
        for row in rows
        if row["TABLE_NAME"]
        in physical_to_table_id
    ]

    return {
        "database_id": database_id,
        "tables": tables,
        "count": len(tables),
    }


def describe_table(
    role: str,
    database_id: str,
    table_id: str,
) -> dict[str, Any]:
    config = get_database_config(database_id, role)
    table = get_table_definition(database_id, table_id, role)

    statement = text(
        """
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_KEY
        FROM information_schema.columns
        WHERE table_schema = :database_name
          AND table_name = :table_name
        ORDER BY ORDINAL_POSITION
        """
    )

    with database_connection(database_id, role) as connection:
        rows = connection.execute(
            statement,
            {
                "database_name": config.database_name,
                "table_name": table.physical_name,
            },
        ).mappings().all()

    allowed_columns = set(table.readable_columns)

    columns = [
        {
            "name": row["COLUMN_NAME"],
            "type": row["DATA_TYPE"],
            "nullable": row["IS_NULLABLE"] == "YES",
            "key": row["COLUMN_KEY"] or None,
        }
        for row in rows
        if row["COLUMN_NAME"] in allowed_columns
    ]

    return {
        "database_id": database_id,
        "table_id": table_id,
        "columns": columns,
        "count": len(columns),
    }


def read_table(
    role: str,
    database_id: str,
    table_id: str,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    get_database_config(database_id, role)
    table = get_table_definition(database_id, table_id, role)

    column_sql = ", ".join(
        f"`{column}`"
        for column in table.readable_columns
    )

    statement = text(
        f"""
        SELECT {column_sql}
        FROM `{table.physical_name}`
        ORDER BY `{table.default_order_column}` DESC
        LIMIT :limit
        OFFSET :offset
        """
    )

    with database_connection(database_id, role) as connection:
        rows = connection.execute(
            statement,
            {
                "limit": limit,
                "offset": offset,
            },
        ).mappings().all()

    return {
        "database_id": database_id,
        "table_id": table_id,
        "rows": [dict(row) for row in rows],
        "count": len(rows),
        "limit": limit,
        "offset": offset,
    }


def count_rows(
    role: str,
    database_id: str,
    table_id: str,
) -> dict[str, Any]:
    get_database_config(database_id, role)
    table = get_table_definition(database_id, table_id, role)

    statement = text(
        f"""
        SELECT COUNT(*) AS total
        FROM `{table.physical_name}`
        """
    )

    with database_connection(database_id, role) as connection:
        total = connection.execute(statement).scalar_one()

    return {
        "database_id": database_id,
        "table_id": table_id,
        "count": int(total),
    }