from contextlib import contextmanager
from functools import lru_cache
from typing import Iterator

from sqlalchemy import URL, Connection, Engine, create_engine, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.database.errors import DatabaseConnectionError
from app.database.registry import get_database_config


@lru_cache(maxsize=20)
def get_database_engine(
    database_id: str,
    role: str,
) -> Engine:
    config = get_database_config(
        database_id=database_id,
        role=role,
    )

    database_url = URL.create(
        drivername="mysql+pymysql",
        username=config.username,
        password=config.password,
        host=config.host,
        port=config.port,
        database=config.database_name,
        query={"charset": "utf8mb4"},
    )

    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=5,
        max_overflow=5,
        future=True,
    )


@contextmanager
def database_connection(
    database_id: str,
    role: str,
) -> Iterator[Connection]:
    engine = get_database_engine(
        database_id=database_id,
        role=role,
    )

    try:
        with engine.connect() as connection:
            yield connection
    except SQLAlchemyError as error:
        raise DatabaseConnectionError from error


@contextmanager
def database_transaction(
    database_id: str,
    role: str,
) -> Iterator[Connection]:
    engine = get_database_engine(
        database_id=database_id,
        role=role,
    )

    try:
        with engine.begin() as connection:
            yield connection
    except IntegrityError:
        raise
    except SQLAlchemyError as error:
        raise DatabaseConnectionError from error


def test_database_connection(
    database_id: str,
    role: str,
) -> bool:
    with database_connection(database_id, role) as connection:
        result = connection.execute(
            text("SELECT 1 AS connection_test")
        ).scalar_one()

    return result == 1