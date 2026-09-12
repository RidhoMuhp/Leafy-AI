from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.database.connection import (
    database_connection,
    database_transaction,
)
from app.database.registry import get_database_config
from app.database.tables import get_table_definition


class ClientNotFoundError(Exception):
    pass

class ClientAlreadyExistsError(Exception):
    pass

class ClientDatabaseParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    database_id: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
    )


class ListClientsParameters(ClientDatabaseParameters):
    search: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    status: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
        pattern=r"^[a-z][a-z0-9_-]*$",
    )
    city: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100_000)


class GetClientParameters(ClientDatabaseParameters):
    client_id: int = Field(ge=1)
    
class CreateClientParameters(ClientDatabaseParameters):
    client_code: str = Field(
        min_length=1,
        max_length=50,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
    )
    name: str = Field(min_length=1, max_length=150)
    business_type: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    phone: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )
    email: str | None = Field(
        default=None,
        min_length=3,
        max_length=255,
    )
    city: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    source: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    status: Literal[
        "prospect",
        "lead",
        "contacted",
        "follow_up",
    ] = "prospect"
    notes: str | None = Field(default=None)

    @field_validator(
        "client_code",
        "name",
        "business_type",
        "phone",
        "email",
        "city",
        "source",
        "notes",
    )
    @classmethod
    def normalize_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            raise ValueError("Nilai tidak boleh kosong")

        return normalized

def list_clients(
    role: str,
    database_id: str,
    search: str | None,
    status: str | None,
    city: str | None,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    table = get_table_definition(
        database_id,
        "clients",
        role,
    )

    conditions: list[str] = []
    query_parameters: dict[str, Any] = {
        "limit": limit,
        "offset": offset,
    }

    if search:
        normalized_search = search.strip()

        conditions.append(
            """
            (
                `name` LIKE :search
                OR `client_code` LIKE :search
                OR `business_type` LIKE :search
            )
            """
        )
        query_parameters["search"] = (
            f"%{normalized_search}%"
        )

    if status:
        conditions.append("`status` = :status")
        query_parameters["status"] = status

    if city:
        conditions.append("`city` = :city")
        query_parameters["city"] = city.strip()

    where_clause = (
        "WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    statement = text(
        f"""
        SELECT
            `id`,
            `client_code`,
            `name`,
            `business_type`,
            `phone`,
            `email`,
            `city`,
            `source`,
            `status`,
            `notes`,
            `created_at`,
            `updated_at`
        FROM `{table.physical_name}`
        {where_clause}
        ORDER BY `{table.default_order_column}` DESC
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
            query_parameters,
        ).mappings().all()

    return {
        "database_id": database_id,
        "clients": [dict(row) for row in rows],
        "count": len(rows),
        "filters": {
            "search": search,
            "status": status,
            "city": city,
        },
        "limit": limit,
        "offset": offset,
    }


def get_client(
    role: str,
    database_id: str,
    client_id: int,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    table = get_table_definition(
        database_id,
        "clients",
        role,
    )

    statement = text(
        f"""
        SELECT
            `id`,
            `client_code`,
            `name`,
            `business_type`,
            `phone`,
            `email`,
            `city`,
            `source`,
            `status`,
            `notes`,
            `created_at`,
            `updated_at`
        FROM `{table.physical_name}`
        WHERE `id` = :client_id
        LIMIT 1
        """
    )

    with database_connection(
        database_id,
        role,
    ) as connection:
        row = connection.execute(
            statement,
            {
                "client_id": client_id,
            },
        ).mappings().first()

    if row is None:
        raise ClientNotFoundError

    return {
        "database_id": database_id,
        "client": dict(row),
    }
    
def create_client(
    role: str,
    database_id: str,
    client_code: str,
    name: str,
    business_type: str | None,
    phone: str | None,
    email: str | None,
    city: str | None,
    source: str | None,
    status: str,
    notes: str | None,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    table = get_table_definition(
        database_id,
        "clients",
        role,
    )

    insert_statement = text(
        f"""
        INSERT INTO `{table.physical_name}` (
            `client_code`,
            `name`,
            `business_type`,
            `phone`,
            `email`,
            `city`,
            `source`,
            `status`,
            `notes`
        )
        VALUES (
            :client_code,
            :name,
            :business_type,
            :phone,
            :email,
            :city,
            :source,
            :status,
            :notes
        )
        """
    )

    select_statement = text(
        f"""
        SELECT
            `id`,
            `client_code`,
            `name`,
            `business_type`,
            `phone`,
            `email`,
            `city`,
            `source`,
            `status`,
            `notes`,
            `created_at`,
            `updated_at`
        FROM `{table.physical_name}`
        WHERE `id` = :client_id
        LIMIT 1
        """
    )

    parameters = {
        "client_code": client_code,
        "name": name,
        "business_type": business_type,
        "phone": phone,
        "email": email,
        "city": city,
        "source": source,
        "status": status,
        "notes": notes,
    }

    try:
        with database_transaction(
            database_id,
            role,
        ) as connection:
            result = connection.execute(
                insert_statement,
                parameters,
            )

            client_id = result.lastrowid

            row = connection.execute(
                select_statement,
                {"client_id": client_id},
            ).mappings().first()

            if row is None:
                raise RuntimeError(
                    "Created client could not be retrieved"
                )

    except IntegrityError as error:
        mysql_error_code = getattr(
            error.orig,
            "args",
            [None],
        )[0]

        if mysql_error_code == 1062:
            raise ClientAlreadyExistsError from error

        raise

    return {
        "database_id": database_id,
        "client": dict(row),
        "created": True,
    }