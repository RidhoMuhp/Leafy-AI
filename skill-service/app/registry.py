from collections.abc import Callable
from typing import Any

from app.skills.system import service_status


SkillHandler = Callable[..., dict[str, Any]]


SKILL_REGISTRY: dict[str, dict[str, Any]] = {
    "service_status": {
        "handler": service_status,
        "description": "Memeriksa status Python skill service",
        "roles": {"user", "admin", "superadmin"},
    },
}


def list_available_skills(role: str) -> list[dict[str, Any]]:
    normalized_role = normalize_role(role)
    available_skills = []

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
        raise ValueError(f"Skill '{skill_name}' tidak terdaftar")

    if normalized_role not in skill["roles"]:
        raise PermissionError(
            f"Role '{normalized_role}' tidak boleh menjalankan "
            f"skill '{skill_name}'"
        )

    handler: SkillHandler = skill["handler"]
    return handler(**parameters)


def normalize_role(role: str) -> str:
    allowed_roles = {"user", "admin", "superadmin"}

    if role not in allowed_roles:
        return "user"

    return role