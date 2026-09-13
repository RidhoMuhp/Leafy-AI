from typing import Any, Literal
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.database.connection import (
    database_connection,
    database_transaction,
)
from app.database.registry import get_database_config
from app.database.tables import get_table_definition

class ClientDeleteRestrictedError(Exception):
    pass

class InvalidConfirmationError(Exception):
    pass

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

class UpdateClientParameters(ClientDatabaseParameters):
    client_id: int = Field(ge=1)
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )
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
    notes: str | None = Field(default=None)

    @field_validator(
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

    @model_validator(mode="after")
    def validate_update_fields(self):
        update_fields = (
            self.name,
            self.business_type,
            self.phone,
            self.email,
            self.city,
            self.source,
            self.notes,
        )

        if all(value is None for value in update_fields):
            raise ValueError(
                "Minimal satu field harus diperbarui"
            )

        return self


class UpdateClientStatusParameters(
    ClientDatabaseParameters
):
    client_id: int = Field(ge=1)
    status: Literal[
        "prospect",
        "lead",
        "contacted",
        "follow_up",
    ]

class PreviewDeleteClientParameters(
    ClientDatabaseParameters
):
    client_id: int = Field(ge=1)


class ConfirmDeleteClientParameters(
    ClientDatabaseParameters
):
    action_id: str = Field(
        min_length=36,
        max_length=36,
        pattern=(
            r"^[0-9a-f]{8}-"
            r"[0-9a-f]{4}-"
            r"[0-9a-f]{4}-"
            r"[0-9a-f]{4}-"
            r"[0-9a-f]{12}$"
        ),
    )
    confirmation_token: str = Field(
        min_length=32,
        max_length=200,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

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
    
def update_client(
    role: str,
    database_id: str,
    client_id: int,
    name: str | None,
    business_type: str | None,
    phone: str | None,
    email: str | None,
    city: str | None,
    source: str | None,
    notes: str | None,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    table = get_table_definition(
        database_id,
        "clients",
        role,
    )

    supplied_fields = {
        "name": name,
        "business_type": business_type,
        "phone": phone,
        "email": email,
        "city": city,
        "source": source,
        "notes": notes,
    }

    update_fields = {
        key: value
        for key, value in supplied_fields.items()
        if value is not None
    }

    assignments = ", ".join(
        f"`{field}` = :{field}"
        for field in update_fields
    )

    update_statement = text(
        f"""
        UPDATE `{table.physical_name}`
        SET {assignments}
        WHERE `id` = :client_id
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
        **update_fields,
        "client_id": client_id,
    }

    with database_transaction(
        database_id,
        role,
    ) as connection:
        connection.execute(
            update_statement,
            parameters,
        )

        row = connection.execute(
            select_statement,
            {"client_id": client_id},
        ).mappings().first()

        if row is None:
            raise ClientNotFoundError

    return {
        "database_id": database_id,
        "client": dict(row),
        "updated": True,
    }

def update_client_status(
    role: str,
    database_id: str,
    client_id: int,
    status: str,
) -> dict[str, Any]:
    get_database_config(database_id, role)

    table = get_table_definition(
        database_id,
        "clients",
        role,
    )

    update_statement = text(
        f"""
        UPDATE `{table.physical_name}`
        SET `status` = :status
        WHERE `id` = :client_id
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

    with database_transaction(
        database_id,
        role,
    ) as connection:
        connection.execute(
            update_statement,
            {
                "client_id": client_id,
                "status": status,
            },
        )

        row = connection.execute(
            select_statement,
            {"client_id": client_id},
        ).mappings().first()

        if row is None:
            raise ClientNotFoundError

    return {
        "database_id": database_id,
        "client": dict(row),
        "updated": True,
    }
    
def preview_delete_client(
    role: str,
    actor_id: str,
    database_id: str,
    client_id: int,
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
    pending_table = get_table_definition(
        database_id,
        "pending_actions",
        role,
    )

    client_statement = text(
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
        FROM `{clients_table.physical_name}`
        WHERE `id` = :client_id
        LIMIT 1
        """
    )

    outreach_statement = text(
        f"""
        SELECT COUNT(*)
        FROM `{outreach_table.physical_name}`
        WHERE `client_id` = :client_id
        """
    )

    cancel_statement = text(
        f"""
        UPDATE `{pending_table.physical_name}`
        SET `status` = 'cancelled'
        WHERE `requested_by` = :actor_id
          AND `action_type` = 'delete_client'
          AND `database_id` = :database_id
          AND `resource_id` = :resource_id
          AND `status` = 'pending'
        """
    )

    insert_statement = text(
        f"""
        INSERT INTO `{pending_table.physical_name}` (
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
            :actor_id,
            'delete_client',
            :database_id,
            :resource_id,
            :payload_json,
            :confirmation_token_hash,
            'pending',
            :expires_at
        )
        """
    )

    action_id = str(uuid.uuid4())
    confirmation_token = secrets.token_urlsafe(32)
    confirmation_token_hash = hashlib.sha256(
        confirmation_token.encode("utf-8")
    ).hexdigest()

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=10)
    ).replace(tzinfo=None)

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

        outreach_count = connection.execute(
            outreach_statement,
            {"client_id": client_id},
        ).scalar_one()

        if outreach_count > 0:
            raise ClientDeleteRestrictedError

        client_snapshot = dict(client)

        connection.execute(
            cancel_statement,
            {
                "actor_id": actor_id,
                "database_id": database_id,
                "resource_id": str(client_id),
            },
        )

        connection.execute(
            insert_statement,
            {
                "action_id": action_id,
                "actor_id": actor_id,
                "database_id": database_id,
                "resource_id": str(client_id),
                "payload_json": json.dumps(
                    client_snapshot,
                    default=str,
                    ensure_ascii=False,
                ),
                "confirmation_token_hash":
                    confirmation_token_hash,
                "expires_at": expires_at,
            },
        )

    return {
        "database_id": database_id,
        "action_id": action_id,
        "confirmation_token": confirmation_token,
        "expires_at": expires_at,
        "client": client_snapshot,
        "outreach_count": outreach_count,
        "requires_confirmation": True,
    }


def confirm_delete_client(
    role: str,
    actor_id: str,
    database_id: str,
    action_id: str,
    confirmation_token: str,
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
    pending_table = get_table_definition(
        database_id,
        "pending_actions",
        role,
    )

    action_statement = text(
        f"""
        SELECT
            `action_id`,
            `requested_by`,
            `action_type`,
            `database_id`,
            `resource_id`,
            `confirmation_token_hash`,
            `status`,
            `expires_at`
        FROM `{pending_table.physical_name}`
        WHERE `action_id` = :action_id
        LIMIT 1
        FOR UPDATE
        """
    )

    client_statement = text(
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
        FROM `{clients_table.physical_name}`
        WHERE `id` = :client_id
        LIMIT 1
        FOR UPDATE
        """
    )

    outreach_statement = text(
        f"""
        SELECT COUNT(*)
        FROM `{outreach_table.physical_name}`
        WHERE `client_id` = :client_id
        """
    )

    delete_statement = text(
        f"""
        DELETE FROM `{clients_table.physical_name}`
        WHERE `id` = :client_id
        """
    )

    complete_statement = text(
        f"""
        UPDATE `{pending_table.physical_name}`
        SET
            `status` = 'completed',
            `confirmed_at` = :confirmed_at
        WHERE `action_id` = :action_id
          AND `status` = 'pending'
        """
    )

    supplied_hash = hashlib.sha256(
        confirmation_token.encode("utf-8")
    ).hexdigest()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    with database_transaction(
        database_id,
        role,
    ) as connection:
        pending_action = connection.execute(
            action_statement,
            {"action_id": action_id},
        ).mappings().first()

        if pending_action is None:
            raise InvalidConfirmationError

        valid_identity = secrets.compare_digest(
            pending_action["requested_by"],
            actor_id,
        )
        valid_token = secrets.compare_digest(
            pending_action["confirmation_token_hash"],
            supplied_hash,
        )

        if (
            not valid_identity
            or not valid_token
            or pending_action["action_type"]
                != "delete_client"
            or pending_action["database_id"]
                != database_id
            or pending_action["status"] != "pending"
            or pending_action["expires_at"] <= now
        ):
            raise InvalidConfirmationError

        try:
            client_id = int(
                pending_action["resource_id"]
            )
        except (TypeError, ValueError) as error:
            raise InvalidConfirmationError from error

        client = connection.execute(
            client_statement,
            {"client_id": client_id},
        ).mappings().first()

        if client is None:
            raise ClientNotFoundError

        outreach_count = connection.execute(
            outreach_statement,
            {"client_id": client_id},
        ).scalar_one()

        if outreach_count > 0:
            raise ClientDeleteRestrictedError

        connection.execute(
            delete_statement,
            {"client_id": client_id},
        )

        connection.execute(
            complete_statement,
            {
                "action_id": action_id,
                "confirmed_at": now,
            },
        )

    return {
        "database_id": database_id,
        "deleted": True,
        "client": dict(client),
        "action_id": action_id,
    }