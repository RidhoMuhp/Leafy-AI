import os
import re
from dataclasses import dataclass

from app.database.errors import (
    DatabaseAccessDeniedError,
    DatabaseConfigurationError,
    UnknownDatabaseError,
)


SAFE_DATABASE_NAME = re.compile(r"^[A-Za-z0-9_]+$")


@dataclass(frozen=True)
class DatabaseDefinition:
    env_prefix: str
    allowed_roles: frozenset[str]


@dataclass(frozen=True)
class DatabaseConfig:
    database_id: str
    host: str
    port: int
    database_name: str
    username: str
    password: str


DATABASE_REGISTRY: dict[str, DatabaseDefinition] = {
    "leafy_core": DatabaseDefinition(
        env_prefix="LEAFY_DB_LEAFY_CORE",
        allowed_roles=frozenset(
            {"user", "admin", "superadmin"}
        ),
    ),
}


def list_registered_databases(role: str) -> list[str]:
    return [
        database_id
        for database_id, definition in DATABASE_REGISTRY.items()
        if role in definition.allowed_roles
    ]


def get_database_config(
    database_id: str,
    role: str,
) -> DatabaseConfig:
    definition = DATABASE_REGISTRY.get(database_id)

    if definition is None:
        raise UnknownDatabaseError

    if role not in definition.allowed_roles:
        raise DatabaseAccessDeniedError

    prefix = definition.env_prefix

    host = _required_env(f"{prefix}_HOST")
    database_name = _required_env(f"{prefix}_NAME")
    username = _required_env(f"{prefix}_USER")
    password = _required_env(f"{prefix}_PASSWORD")
    port_value = _required_env(f"{prefix}_PORT")

    try:
        port = int(port_value)
    except ValueError as error:
        raise DatabaseConfigurationError from error

    if not 1 <= port <= 65535:
        raise DatabaseConfigurationError

    if not SAFE_DATABASE_NAME.fullmatch(database_name):
        raise DatabaseConfigurationError

    return DatabaseConfig(
        database_id=database_id,
        host=host,
        port=port,
        database_name=database_name,
        username=username,
        password=password,
    )


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value:
        raise DatabaseConfigurationError

    return value