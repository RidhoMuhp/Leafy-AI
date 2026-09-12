from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ValidationError

from app.skills.database import (
    CountRowsParameters,
    DescribeTableParameters,
    ListTablesParameters,
    ReadTableParameters,
    count_rows,
    describe_table,
    list_tables,
    read_table,
)
from app.skills.system import (
    ServiceStatusParameters,
    service_status,
)
from app.skills.clients import (
    CreateClientParameters,
    GetClientParameters,
    ListClientsParameters,
    create_client,
    get_client,
    list_clients,
)


SkillHandler = Callable[..., dict[str, Any]]


class UnknownSkillError(Exception):
    pass


class InvalidSkillParametersError(Exception):
    pass


SKILL_REGISTRY: dict[str, dict[str, Any]] = {
    
    "create_client": {
        "handler": create_client,
        "parameter_model": CreateClientParameters,
        "description": (
            "Membuat data klien baru dengan client_code unik"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "describe_table": {
        "handler": describe_table,
        "parameter_model": DescribeTableParameters,
        "description": "Menampilkan struktur tabel terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    "read_table": {
        "handler": read_table,
        "parameter_model": ReadTableParameters,
        "description": "Membaca data dari tabel terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    "count_rows": {
        "handler": count_rows,
        "parameter_model": CountRowsParameters,
        "description": "Menghitung jumlah baris tabel terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "list_clients": {
        "handler": list_clients,
        "parameter_model": ListClientsParameters,
        "description": (
            "Menampilkan daftar klien dengan filter "
            "pencarian, status, dan kota"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
        
    "get_client": {
        "handler": get_client,
        "parameter_model": GetClientParameters,
        "description": (
            "Menampilkan detail satu klien "
            "berdasarkan client_id"
        ),
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
    
    "service_status": {
        "handler": service_status,
        "parameter_model": ServiceStatusParameters,
        "description": "Memeriksa status Python skill service",
        "roles": {"user", "admin", "superadmin"},
        "inject_role": False,
    },
    "list_tables": {
        "handler": list_tables,
        "parameter_model": ListTablesParameters,
        "description": "Menampilkan tabel dari database terdaftar",
        "roles": {"admin", "superadmin"},
        "inject_role": True,
    },
}


def list_available_skills(role: str) -> list[dict[str, str]]:
    normalized_role = normalize_role(role)
    available_skills: list[dict[str, str]] = []

    for name, skill in SKILL_REGISTRY.items():
        if normalized_role in skill["roles"]:
            available_skills.append(
                {
                    "name": name,
                    "description": skill["description"],
                }
            )

    return available_skills


def execute_skill(
    skill_name: str,
    role: str,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    normalized_role = normalize_role(role)
    skill = SKILL_REGISTRY.get(skill_name)

    if skill is None:
        raise UnknownSkillError

    if normalized_role not in skill["roles"]:
        raise PermissionError

    parameter_model: type[BaseModel] = skill["parameter_model"]

    try:
        validated = parameter_model.model_validate(parameters)
    except ValidationError as error:
        raise InvalidSkillParametersError from error

    handler: SkillHandler = skill["handler"]
    validated_parameters = validated.model_dump()

    if skill["inject_role"]:
        return handler(
            role=normalized_role,
            **validated_parameters,
        )

    return handler(**validated_parameters)


def normalize_role(role: str) -> str:
    allowed_roles = {"user", "admin", "superadmin"}
    normalized_role = role.strip().lower()

    if normalized_role not in allowed_roles:
        raise PermissionError

    return normalized_role